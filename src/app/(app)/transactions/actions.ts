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
  if (!id) return;

  const supabase = getSupabaseClient();

  // チャットからこの取引を作った吹き出しも一緒に消す（取引を消した後だと
  // chat_messages.transaction_idがon delete set nullでnullになり辿れなくなるため先に削除する）
  const { error: chatError } = await supabase
    .from("chat_messages")
    .delete()
    .eq("transaction_id", id);
  if (chatError) throw chatError;

  const { error } = await supabase.from("chip_transactions").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/customers");
  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/transactions");
  revalidatePath("/chat");
}
