export type Denomination = {
  id: string;
  label: string;
  value: number;
  sort_order: number;
  usable_for_purchase: boolean;
  usable_for_tournament: boolean;
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
  | "adjustment";

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
