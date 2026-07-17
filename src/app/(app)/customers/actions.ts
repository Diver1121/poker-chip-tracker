"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { insertChipTransaction } from "@/lib/transactions";

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

export async function deleteCustomer(formData: FormData) {
  await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) return;

  const { error } = await getSupabaseClient()
    .from("customers")
    .delete()
    .eq("id", customerId);
  if (error) throw error;

  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/transactions");
}
