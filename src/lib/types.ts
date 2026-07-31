export type Denomination = {
  id: string;
  label: string;
  value: number;
  sort_order: number;
  usable_for_purchase: boolean;
  usable_for_tournament: boolean;
  // トーナメントのアドオン欄の種類選択に出すかどうか
  usable_for_addon: boolean;
  // チャット入力（例:「ダイバー トーナメントターボ」）でこの額面を選ぶための別名キーワード
  aliases: string[];
};

export type Customer = {
  id: string;
  name: string;
  note: string | null;
  checked_in_at: string | null;
  created_at: string;
};

export type TransactionCategory =
  | "purchase"
  | "table_out"
  | "table_in"
  | "tournament"
  // プライズ獲得。額面を問わず点数のみ扱う（table_out/table_inと同様）
  | "prize"
  // 他システムからの移行や手入力による残高調整。バイイン/アウト集計には含めない
  | "adjustment"
  // トーナメントの現金エントリー分の記録用。保有チップ・レーキ計算には一切影響しない
  | "cash_entry";

export type ChipTransaction = {
  id: string;
  customer_id: string;
  // purchase/tournament は額面必須、table_out/table_in は null（点数のみ扱う）
  denomination_id: string | null;
  category: TransactionCategory;
  // purchase/tournament: 額面の枚数 / table_out/table_in: 点数そのもの
  quantity: number;
  created_at: string;
};

export type Visit = {
  id: string;
  customer_id: string;
  checked_in_at: string;
};

// トーナメントの「回」。同じ営業日に複数のトーナメントが並行して立つ場合に、
// エントリー・種類・プライズ計算を回ごとに独立させるための単位。
// 種類（denomination_id/addon_denomination_id）は開始時に固定し、途中で変えない。
export type Tournament = {
  id: string;
  label: string;
  denomination_id: string | null;
  addon_denomination_id: string | null;
  created_at: string;
};

export type TournamentEntry = {
  id: string;
  // この行が属するトーナメントの回。バックフィル前の古いデータ以外では常に値が入る想定
  tournament_id: string | null;
  name: string;
  // NAME欄が客一覧の名前と一致した場合に解決される客ID。取引の紐付けに使う
  // （一致しない場合はnullで、この行からは取引を作らない）。
  customer_id: string | null;
  entry_fee: number;
  cash_amount: number;
  // 現金エントリー分を取引履歴に記録するためのcash_entry取引。保有チップには影響しない
  cash_transaction_id: string | null;
  // chip_countに、選ばれた種類（denomination_id）のvalueを掛けて計算した点数
  chip_amount: number;
  // チップ欄に入力された「チップを使ってエントリーした回数」そのもの
  chip_count: number;
  // 額面設定（denominations）の「トーナメントで使う」項目のうち、この行で使ったもの
  denomination_id: string | null;
  // このチップ回数から作られたchip_transactions行。次回保存時の二重登録防止・更新用
  chip_transaction_id: string | null;
  ticket_amount: number;
  // アドオンの現金分。cash_amountと同様、記録のみで保有チップには影響しない
  addon_cash_amount: number;
  addon_cash_transaction_id: string | null;
  // addon_countに、選ばれたアドオン種類のvalueを掛けて計算した点数
  addon_amount: number;
  // アドオン欄に入力された回数そのもの
  addon_count: number;
  // 額面設定（denominations）の「アドオンで使う」項目のうち、この行で使ったもの
  addon_denomination_id: string | null;
  addon_transaction_id: string | null;
  // 大会終了前はnull（未確定）
  rank: number | null;
  prize_amount: number;
  prize_transaction_id: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  kind: "user" | "reply";
  text: string;
  ok: boolean | null;
  warning: boolean | null;
  command_id: string;
  transaction_id: string | null;
  cancelled: boolean;
  // 送信したスタッフの名前（ログイン時に入力）。システム生成の返信はnull
  sender_name: string | null;
  // 登録した取引の種別。取引を伴うreply行だけ入る（吹き出しの色分けに使う）
  category: TransactionCategory | null;
  created_at: string;
};
