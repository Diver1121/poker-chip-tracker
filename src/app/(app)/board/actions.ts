"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { insertChipTransaction } from "@/lib/transactions";
import { fromJstDatetimeLocal } from "@/lib/businessDay";
import { getCustomer, getDenomination } from "@/lib/data";
import { isTransactionCategory } from "@/lib/transactionCategory";
import { appendChatMessage, formatTransactionSummary } from "@/lib/chatLog";

export async function checkInCustomer(formData: FormData) {
  await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) return;

  const now = new Date().toISOString();
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("customers")
    .update({ checked_in_at: now })
    .eq("id", customerId);
  if (error) throw error;

  // 来店頻度グラフ用に、退店しても消えない来店ログを別途残す
  const { error: visitError } = await supabase
    .from("visits")
    .insert({ customer_id: customerId, checked_in_at: now });
  if (visitError) throw visitError;

  revalidatePath("/board");
  revalidatePath("/stats");
}

// 間違えてチェックインした場合の取消。通常の退店と違い、
// 来店頻度グラフに使うvisitsのログも一緒に削除する。
export async function undoCheckIn(formData: FormData) {
  await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) return;

  const supabase = getSupabaseClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("checked_in_at")
    .eq("id", customerId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer?.checked_in_at) return;

  const { error: visitError } = await supabase
    .from("visits")
    .delete()
    .eq("customer_id", customerId)
    .eq("checked_in_at", customer.checked_in_at);
  if (visitError) throw visitError;

  const { error } = await supabase
    .from("customers")
    .update({ checked_in_at: null })
    .eq("id", customerId);
  if (error) throw error;

  revalidatePath("/board");
  revalidatePath("/stats");
}

export async function checkOutAllCustomers() {
  await requireAuth();

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("customers")
    .update({ checked_in_at: null })
    .not("checked_in_at", "is", null);
  if (error) throw error;

  // チャットの吹き出しは営業終了のタイミングでまとめて消す
  const { error: chatError } = await supabase
    .from("chat_messages")
    .delete()
    .not("id", "is", null);
  if (chatError) throw chatError;

  revalidatePath("/board");
  revalidatePath("/chat");
}

export async function recordBoardTransaction(formData: FormData) {
  const senderName = await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  const denominationId = String(formData.get("denominationId") ?? "");
  const category = String(formData.get("category") ?? "");
  const quantity = Number(formData.get("quantity"));
  const createdAtLocal = String(formData.get("createdAt") ?? "");
  const createdAt = createdAtLocal ? fromJstDatetimeLocal(createdAtLocal) : undefined;

  const transactionId = await insertChipTransaction({
    customerId,
    denominationId,
    category,
    quantity,
    createdAt,
  });

  // 来店ボードの手入力もチャットに残す。チャットからでも手入力からでも
  // 同じ場所に記録が並ぶので、二重登録に気づきやすくなる。
  if (isTransactionCategory(category)) {
    const [customer, denomination] = await Promise.all([
      getCustomer(customerId),
      denominationId ? getDenomination(denominationId) : Promise.resolve(null),
    ]);
    const summary = formatTransactionSummary({
      customerName: customer?.name ?? "(不明な客)",
      category,
      denominationLabel: denomination?.label,
      quantity,
    });
    await appendChatMessage(crypto.randomUUID(), "reply", `${summary}（来店ボードから入力）`, {
      ok: true,
      transactionId,
      senderName,
      category,
    });
  }

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/transactions");
  revalidatePath("/chat");
}
