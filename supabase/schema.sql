-- チップ保有数管理アプリ用スキーマ
-- Supabaseの SQL Editor でこのファイルの内容をそのまま実行してください。

create table if not exists denominations (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value integer not null,
  sort_order integer not null default 0,
  -- 購入/トーナメント使用のどちらの選択肢に出すかを個別に設定できる
  usable_for_purchase boolean not null default true,
  usable_for_tournament boolean not null default true,
  -- チャット入力（例:「ダイバー トーナメントターボ」）でこの額面を選ぶための別名キーワード
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 既存テーブルに対しては上のcreate tableが実行されないため、こちらで追加する
alter table denominations add column if not exists aliases text[] not null default '{}';

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists chip_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  -- purchase/tournament: 額面ごとの枚数を記録するため必須
  -- table_out/table_in/prize/adjustment: 額面を問わず合計点数のみ扱うため null
  denomination_id uuid references denominations(id) on delete restrict,
  -- purchase: 購入(+) / table_out: テーブルへ持ち出し(-)
  -- table_in: テーブルからカウント(+) / tournament: トーナメント使用(-)
  -- prize: プライズ獲得(+)
  -- adjustment: 他システムからの移行・残高調整(+)。バイイン/アウトの集計には含めない
  category text not null check (category in ('purchase', 'table_out', 'table_in', 'tournament', 'prize', 'adjustment')),
  -- purchase/tournament: 額面の枚数 / table_out/table_in/prize/adjustment: 点数そのもの
  -- table_in（アウト）だけは0（全部負けて手元に残らなかった場合）を許可する
  -- tournament（トーナメント使用）は入力ミスの訂正用にマイナスを許可する（0は不可）
  quantity integer not null check (
    (category = 'table_in' and quantity >= 0)
    or
    (category = 'tournament' and quantity <> 0)
    or
    (category not in ('table_in', 'tournament') and quantity > 0)
  ),
  created_at timestamptz not null default now(),
  constraint chip_transactions_denomination_by_category check (
    (category in ('purchase', 'tournament') and denomination_id is not null)
    or
    (category in ('table_out', 'table_in', 'prize', 'adjustment') and denomination_id is null)
  )
);

create index if not exists chip_transactions_customer_id_idx on chip_transactions(customer_id);
create index if not exists chip_transactions_denomination_id_idx on chip_transactions(denomination_id);

-- 来店頻度グラフ用の来店ログ。来店中ボードでチェックインするたびに1行追加する
-- （customers.checked_in_atは退店で消えるため、履歴として別テーブルに残す）
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  checked_in_at timestamptz not null default now()
);

create index if not exists visits_customer_id_idx on visits(customer_id);
create index if not exists visits_checked_in_at_idx on visits(checked_in_at);

-- チャット入力欄の履歴。「営業終了・まとめて退店」ボタンが押されるまで残す
-- （checkOutAllCustomers実行時にまとめて削除する）
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('user', 'reply')),
  text text not null,
  ok boolean,
  warning boolean,
  -- 1回の入力（客の発言＋返信の2行）を紐付けるためのグループID。取消の単位になる。
  command_id uuid not null default gen_random_uuid(),
  -- この入力から作られたchip_transactionsの行。取消時にこれを削除して残高を戻す。
  transaction_id uuid references chip_transactions(id) on delete set null,
  cancelled boolean not null default false,
  -- 送信したスタッフの名前（ログイン時に入力）。システム生成の返信はnull
  sender_name text,
  -- 登録した取引の種別（購入・バイイン等）。取引を伴うreply行だけ入る。
  -- チャット上で種別ごとに吹き出しの色を変えるために使う。
  category text,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx on chat_messages(created_at);
create index if not exists chat_messages_command_id_idx on chat_messages(command_id);

-- 既存テーブルに対しては上のcreate tableが実行されないため、こちらで追加する
alter table chat_messages add column if not exists command_id uuid not null default gen_random_uuid();
alter table chat_messages add column if not exists transaction_id uuid references chip_transactions(id) on delete set null;
alter table chat_messages add column if not exists cancelled boolean not null default false;
alter table chat_messages add column if not exists sender_name text;
alter table chat_messages add column if not exists category text;
create index if not exists chat_messages_command_id_idx on chat_messages(command_id);

-- 店舗全体の設定を1行だけ持つテーブル。
-- last_closed_at:「営業終了・まとめて退店」を最後に押した日時。
-- 来店ボードの保有表示（客ごとの額面バッジ・保有合計）はこの日時以降の取引だけで計算する
-- （取引ログ自体は削除しない。過去の履歴は/transactions等でずっと参照できる）。
create table if not exists shop_settings (
  id boolean primary key default true,
  last_closed_at timestamptz,
  constraint shop_settings_singleton check (id)
);

insert into shop_settings (id) values (true) on conflict (id) do nothing;

-- MTT（トーナメント）のエントリーシート。紙のエントリーシートをそのまま置き換える想定。
-- 客の名前は自由記述（客一覧との連携はしない。同一営業日内の一覧として管理する）。
create table if not exists tournament_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entry_fee integer not null default 0,
  cash_amount integer not null default 0,
  chip_amount integer not null default 0,
  ticket_amount integer not null default 0,
  addon_amount integer not null default 0,
  -- 順位・獲得は大会終了後に分かるため、順位はnull（未確定）を許可する
  rank integer,
  prize_amount integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tournament_entries_created_at_idx on tournament_entries(created_at);

-- トーナメントの「種類」は額面設定（denominations）の「トーナメントで使う」項目をそのまま流用する。
-- エントリーシートの一番上でどの項目を使ったかを選ぶと、新しい行のチップ欄の初期値に使われる。
alter table tournament_entries add column if not exists denomination_id uuid references denominations(id) on delete set null;

-- 過去バージョンで作った専用テーブル・列（未使用のため削除）
-- tournament_typesへの外部キー制約がある列を先に消してからでないとテーブルをdropできない
alter table tournament_entries drop column if exists tournament_type_id;
alter table tournament_entries drop column if exists chip_units;
drop table if exists tournament_types;

-- 額面設定の項目のうち「アドオン専用」の項目を分けて選べるようにする
-- （トーナメントの種類選択とは別に、アドオンの種類選択に出す）。
alter table denominations add column if not exists usable_for_addon boolean not null default false;

-- 既存データの一括反映: ラベルに"Add-on"を含む項目を暫定的にアドオン扱いにする
-- （実際にどれをアドオンにするかは額面設定画面のチェックボックスで調整可能）。
update denominations set usable_for_addon = true where label ilike '%add-on%';

-- チップ欄は点数を直接入力するのではなく「チップを使ってエントリーした回数」を入力する。
-- chip_countが入力値、chip_amountはchip_count×(選ばれた種類のvalue)をサーバー側で計算した点数。
alter table tournament_entries add column if not exists chip_count integer not null default 0;

-- アドオン欄も同様に、点数ではなく回数を入力する。
-- addon_countが入力値、addon_amountはaddon_count×(選ばれたアドオン種類のvalue)をサーバー側で計算した点数。
alter table tournament_entries add column if not exists addon_count integer not null default 0;
alter table tournament_entries add column if not exists addon_denomination_id uuid references denominations(id) on delete set null;

-- 来店中ボードの「トーナメント使用」「プライズ獲得」ボタンの代わりに、このページの
-- チップ回数・アドオン回数・獲得欄から直接chip_transactionsを作る（来店ボードの保有表示・
-- 取引履歴に反映される）。customer_idが解決できた行だけ取引を作る（名前が客一覧と一致しない
-- 行は記録だけ残り、取引は作られない）。
-- *_transaction_idは、保存し直すたびに二重登録しないための紐付け
-- （既存の取引を更新し、回数が0に戻ったら取引ごと削除する）。
alter table tournament_entries add column if not exists customer_id uuid references customers(id) on delete set null;
alter table tournament_entries add column if not exists chip_transaction_id uuid references chip_transactions(id) on delete set null;
alter table tournament_entries add column if not exists addon_transaction_id uuid references chip_transactions(id) on delete set null;
alter table tournament_entries add column if not exists prize_transaction_id uuid references chip_transactions(id) on delete set null;

-- 現金エントリー欄を取引履歴に記録として残すためのカテゴリ。保有チップは増減させない
-- （sign=0。src/lib/transactionCategory.tsのCATEGORY_INFO参照）。
alter table chip_transactions drop constraint if exists chip_transactions_category_check;
alter table chip_transactions add constraint chip_transactions_category_check
  check (category in ('purchase', 'table_out', 'table_in', 'tournament', 'prize', 'adjustment', 'cash_entry'));

alter table chip_transactions drop constraint if exists chip_transactions_denomination_by_category;
alter table chip_transactions add constraint chip_transactions_denomination_by_category check (
  (category in ('purchase', 'tournament') and denomination_id is not null)
  or
  (category in ('table_out', 'table_in', 'prize', 'adjustment', 'cash_entry') and denomination_id is null)
);

alter table tournament_entries add column if not exists cash_transaction_id uuid references chip_transactions(id) on delete set null;

-- 「営業終了・まとめて退店」の誤操作対策。チャットは削除ではなくアーカイブにして、
-- 直前の1回だけ取り消せるようにする（src/app/(app)/board/actions.tsのundoLastCheckOut参照）。
alter table chat_messages add column if not exists archived_at timestamptz;
alter table shop_settings add column if not exists previous_closed_at timestamptz;
alter table shop_settings add column if not exists close_undoable boolean not null default false;
