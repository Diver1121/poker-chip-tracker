"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { insertChipTransaction } from "@/lib/transactions";
import { computeLastVisitByCustomer } from "@/lib/balances";
import { isPastRetention } from "@/lib/retention";

export async function createCustomer(formData: FormData) {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!name) return;

  const supabase = getSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("customers")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    redirect("/customers?error=duplicate");
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({ name, note: note || null })
    .select()
    .single();
  if (error) throw error;

  // 他システムからの移行時などに、登録と同時に現在の保有点数を記録する
  // （adjustment: 額面を問わない残高調整。バイイン/アウトの集計には含めない）
  const initialPoints = Number(formData.get("initialPoints"));
  if (Number.isInteger(initialPoints) && initialPoints > 0) {
    await insertChipTransaction({
      customerId: customer.id,
      denominationId: "",
      category: "adjustment",
      quantity: initialPoints,
    });
  }

  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/board");
}

export async function updateCustomerName(formData: FormData) {
  await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!customerId || !name) return;

  const supabase = getSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("customers")
    .select("id")
    .eq("name", name)
    .neq("id", customerId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    redirect(`/customers/${customerId}?error=duplicate`);
  }

  const { error } = await supabase
    .from("customers")
    .update({ name })
    .eq("id", customerId);
  if (error) throw error;

  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/customers/${customerId}`);
}

// 客本体を削除する前に、その客の取引に紐づくチャットログも一緒に消す
// （/transactionsの個別取引削除と同じ考え方。取引はcustomers削除のcascadeで消える）
async function deleteCustomerAndRelatedData(customerId: string) {
  const supabase = getSupabaseClient();

  const { data: txRows, error: txError } = await supabase
    .from("chip_transactions")
    .select("id")
    .eq("customer_id", customerId);
  if (txError) throw txError;

  const transactionIds = (txRows ?? []).map((row) => row.id);
  if (transactionIds.length > 0) {
    const { error: chatError } = await supabase
      .from("chat_messages")
      .delete()
      .in("transaction_id", transactionIds);
    if (chatError) throw chatError;
  }

  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) throw error;
}

export async function deleteCustomer(formData: FormData) {
  await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) return;

  await deleteCustomerAndRelatedData(customerId);

  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/transactions");
  revalidatePath("/chat");
}

// チップ保有期間（来店最終日から1年）を過ぎた客をスタッフの確認操作で削除する。
// フォームの値を信用せず、削除直前にサーバー側で改めて1年経過を確認してから消す
// （日付計算のミスや古い画面からの誤操作で、対象外の客が消えるのを防ぐため）。
export async function deleteExpiredCustomer(formData: FormData) {
  await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) return;

  const supabase = getSupabaseClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, created_at")
    .eq("id", customerId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) return;

  const { data: visits, error: visitsError } = await supabase
    .from("visits")
    .select("id, customer_id, checked_in_at")
    .eq("customer_id", customerId);
  if (visitsError) throw visitsError;

  const lastVisitByCustomer = computeLastVisitByCustomer(visits ?? []);
  const lastVisit = lastVisitByCustomer.get(customerId) ?? customer.created_at;

  if (!isPastRetention(lastVisit)) {
    // 何らかの理由（画面が古い等）で対象外になっていた場合は何もしない
    return;
  }

  await deleteCustomerAndRelatedData(customerId);

  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/transactions");
  revalidatePath("/chat");
}
