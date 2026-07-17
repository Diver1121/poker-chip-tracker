"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/require-auth";
import { insertChipTransaction } from "@/lib/transactions";
import { getCustomers, getDenominations } from "@/lib/data";
import { parseChatCommand } from "@/lib/chatCommand";
import { getSupabaseClient } from "@/lib/supabase";
import { appendChatMessage, formatTransactionSummary } from "@/lib/chatLog";

export type ChatCommandState =
  | { ok: boolean; message: string; warning?: boolean; commandId?: string }
  | null;

// チャット風の一行入力（例:「ダイバー　購入300」）から取引を登録する。
// 客名/種別/額面のどれかが曖昧・未一致の場合は自動選択せず、エラーメッセージを返す。
export async function recordChatTransaction(
  _prevState: ChatCommandState,
  formData: FormData,
): Promise<ChatCommandState> {
  const senderName = await requireAuth();

  const text = String(formData.get("text") ?? "").trim();
  const commandId = String(formData.get("commandId") ?? "") || crypto.randomUUID();
  if (!text) {
    return { ok: false, message: "入力してください。" };
  }

  await appendChatMessage(commandId, "user", text, { senderName });

  const [customers, denominations] = await Promise.all([
    getCustomers(),
    getDenominations(),
  ]);

  const parsed = parseChatCommand(text, customers, denominations);
  if (!parsed.ok) {
    await appendChatMessage(commandId, "reply", parsed.error, { ok: false });
    revalidatePath("/chat");
    return { ok: false, message: parsed.error, commandId };
  }

  let transactionId: string;
  try {
    transactionId = await insertChipTransaction({
      customerId: parsed.customerId,
      denominationId: parsed.denominationId ?? "",
      category: parsed.category,
      quantity: parsed.quantity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登録に失敗しました。";
    await appendChatMessage(commandId, "reply", message, { ok: false });
    revalidatePath("/chat");
    return { ok: false, message, commandId };
  }

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.customerId}`);
  revalidatePath("/transactions");

  const detail = formatTransactionSummary({
    customerName: parsed.customerName,
    category: parsed.category,
    denominationLabel: parsed.denominationLabel,
    quantity: parsed.quantity,
  });

  const warning = parsed.customerMatchType === "partial";
  const message = warning
    ? `⚠️ 「${parsed.customerQuery}」を「${parsed.customerName}」として登録しました。名前を確認してください。${detail}`
    : detail;

  await appendChatMessage(commandId, "reply", message, { ok: true, warning, transactionId });
  revalidatePath("/chat");

  return { ok: true, warning, message, commandId };
}

// チャットの入力を取消する。紐づく取引があれば削除して残高を戻し、
// 対応するメッセージ2行（発言＋返信）を取消済みにする。
export async function cancelChatCommand(commandId: string) {
  await requireAuth();
  if (!commandId) return;

  const supabase = getSupabaseClient();

  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("id, transaction_id")
    .eq("command_id", commandId);
  if (error) throw error;
  if (!rows || rows.length === 0) return;

  const transactionId = rows.find((r) => r.transaction_id)?.transaction_id ?? null;
  let customerId: string | null = null;

  if (transactionId) {
    const { data: transaction, error: transactionError } = await supabase
      .from("chip_transactions")
      .select("customer_id")
      .eq("id", transactionId)
      .maybeSingle();
    if (transactionError) throw transactionError;
    customerId = transaction?.customer_id ?? null;

    const { error: deleteError } = await supabase
      .from("chip_transactions")
      .delete()
      .eq("id", transactionId);
    if (deleteError) throw deleteError;
  }

  const { error: updateError } = await supabase
    .from("chat_messages")
    .update({ cancelled: true })
    .eq("command_id", commandId);
  if (updateError) throw updateError;

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/customers");
  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/transactions");
  revalidatePath("/chat");
}
