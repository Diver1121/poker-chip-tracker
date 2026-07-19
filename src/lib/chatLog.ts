import { getSupabaseClient } from "@/lib/supabase";
import { categoryLabel, quantityUnitLabel } from "@/lib/transactionCategory";
import type { TransactionCategory } from "@/lib/types";

// チャットの吹き出しをDBに残す。チャット画面から打った内容だけでなく、
// 来店ボードでの手入力もここを通して記録する。どちらから登録しても
// チャットに同じ形式で残るので、二重登録に気づきやすくなる。
// 「営業終了・まとめて退店」が押される（board側のcheckOutAllCustomers）か、
// 個別に取消されるまで消えない。
export async function appendChatMessage(
  commandId: string,
  kind: "user" | "reply",
  text: string,
  extra?: {
    ok?: boolean;
    warning?: boolean;
    transactionId?: string;
    senderName?: string;
    category?: TransactionCategory;
  },
) {
  const { error } = await getSupabaseClient().from("chat_messages").insert({
    command_id: commandId,
    kind,
    text,
    ok: extra?.ok ?? null,
    warning: extra?.warning ?? null,
    transaction_id: extra?.transactionId ?? null,
    sender_name: extra?.senderName ?? null,
    category: extra?.category ?? null,
  });
  if (error) throw error;
}

export function formatTransactionSummary({
  customerName,
  category,
  denominationLabel,
  quantity,
}: {
  customerName: string;
  category: TransactionCategory;
  denominationLabel?: string | null;
  quantity: number;
}) {
  return `${customerName} / ${categoryLabel(category)}${
    denominationLabel ? ` / ${denominationLabel}` : ""
  } / ${quantity}${quantityUnitLabel(category)} を登録しました`;
}
