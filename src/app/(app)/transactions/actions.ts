"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { insertChipTransaction } from "@/lib/transactions";
import { fromJstDatetimeLocal } from "@/lib/businessDay";

export async function createTransaction(formData: FormData) {
  await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  const denominationId = String(formData.get("denominationId") ?? "");
  const category = String(formData.get("category") ?? "");
  const quantity = Number(formData.get("quantity"));

  await insertChipTransaction({ customerId, denominationId, category, quantity });

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/transactions");

  redirect(`/customers/${customerId}`);
}

export async function updateTransactionDate(formData: FormData) {
  await requireAuth();

  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  const createdAtLocal = String(formData.get("createdAt") ?? "");
  if (!id || !createdAtLocal) {
    throw new Error("入力内容が正しくありません。");
  }

  const createdAtIso = fromJstDatetimeLocal(createdAtLocal);
  if (Number.isNaN(new Date(createdAtIso).getTime())) {
    throw new Error("日時の形式が正しくありません。");
  }

  const { error } = await getSupabaseClient()
    .from("chip_transactions")
    .update({ created_at: createdAtIso })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/customers");
  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/transactions");
  revalidatePath("/stats");
}

export async function deleteTransaction(formData: FormData) {
  await requireAuth();

  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  // 下のor()フィルタに生文字列として組み込むため、形式を確認しておく
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;

  const supabase = getSupabaseClient();

  // チャットからこの取引を作った吹き出しも一緒に消す（取引を消した後だと
  // chat_messages.transaction_idがon delete set nullでnullになり辿れなくなるため先に削除する）
  const { error: chatError } = await supabase
    .from("chat_messages")
    .delete()
    .eq("transaction_id", id);
  if (chatError) throw chatError;

  // トーナメント表からこの取引が作られていた場合、行の回数・点数表示も一緒に0へ戻す
  // （*_transaction_idはon delete set nullで自動的にnullになるが、chip_count等の
  // 表示用の数値列は別途リセットしないと古い数値が残ってしまうため）。
  const { data: linkedEntries, error: linkedEntriesError } = await supabase
    .from("tournament_entries")
    .select("id, chip_transaction_id, addon_transaction_id, prize_transaction_id, cash_transaction_id")
    .or(
      `chip_transaction_id.eq.${id},addon_transaction_id.eq.${id},prize_transaction_id.eq.${id},cash_transaction_id.eq.${id}`,
    );
  if (linkedEntriesError) throw linkedEntriesError;

  for (const entry of linkedEntries ?? []) {
    const resetFields: Record<string, number | null> = {};
    if (entry.chip_transaction_id === id) {
      resetFields.chip_count = 0;
      resetFields.chip_amount = 0;
      resetFields.chip_transaction_id = null;
    }
    if (entry.addon_transaction_id === id) {
      resetFields.addon_count = 0;
      resetFields.addon_amount = 0;
      resetFields.addon_transaction_id = null;
    }
    if (entry.prize_transaction_id === id) {
      resetFields.prize_amount = 0;
      resetFields.prize_transaction_id = null;
    }
    if (entry.cash_transaction_id === id) {
      resetFields.cash_amount = 0;
      resetFields.cash_transaction_id = null;
    }
    const { error: resetError } = await supabase
      .from("tournament_entries")
      .update(resetFields)
      .eq("id", entry.id);
    if (resetError) throw resetError;
  }

  const { error } = await supabase.from("chip_transactions").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/customers");
  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/transactions");
  revalidatePath("/chat");
  if ((linkedEntries ?? []).length > 0) {
    revalidatePath("/tournament");
    revalidatePath("/stats");
  }
}
