"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { parseAliasesInput } from "@/lib/denominationAliases";

export async function createDenomination(formData: FormData) {
  await requireAuth();

  const label = String(formData.get("label") ?? "").trim();
  const value = Number(formData.get("value"));
  const usableForPurchase = formData.get("usableForPurchase") === "1";
  const usableForTournament = formData.get("usableForTournament") === "1";
  const aliases = parseAliasesInput(String(formData.get("aliases") ?? ""));
  if (!label || !Number.isFinite(value)) {
    throw new Error("入力内容が正しくありません。");
  }

  const supabase = getSupabaseClient();
  const { data: last, error: lastError } = await supabase
    .from("denominations")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (lastError) throw lastError;
  const nextSortOrder = (last[0]?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("denominations").insert({
    label,
    value,
    sort_order: nextSortOrder,
    usable_for_purchase: usableForPurchase,
    usable_for_tournament: usableForTournament,
    aliases,
  });
  if (error) throw error;

  revalidatePath("/settings/denominations");
  revalidatePath("/");
}

export async function updateDenomination(formData: FormData) {
  await requireAuth();

  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const value = Number(formData.get("value"));
  const usableForPurchase = formData.get("usableForPurchase") === "1";
  const usableForTournament = formData.get("usableForTournament") === "1";
  const aliases = parseAliasesInput(String(formData.get("aliases") ?? ""));
  if (!id || !label || !Number.isFinite(value)) {
    throw new Error("入力内容が正しくありません。");
  }

  const { error } = await getSupabaseClient()
    .from("denominations")
    .update({
      label,
      value,
      usable_for_purchase: usableForPurchase,
      usable_for_tournament: usableForTournament,
      aliases,
    })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/settings/denominations");
  revalidatePath("/");
}

async function swapSortOrder(
  idA: string,
  sortOrderA: number,
  idB: string,
  sortOrderB: number,
) {
  const supabase = getSupabaseClient();
  const { error: errorA } = await supabase
    .from("denominations")
    .update({ sort_order: sortOrderB })
    .eq("id", idA);
  if (errorA) throw errorA;

  const { error: errorB } = await supabase
    .from("denominations")
    .update({ sort_order: sortOrderA })
    .eq("id", idB);
  if (errorB) throw errorB;
}

async function moveDenomination(id: string, direction: "up" | "down") {
  const { data: denominations, error } = await getSupabaseClient()
    .from("denominations")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const index = denominations.findIndex((d) => d.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= denominations.length) return;

  await swapSortOrder(
    denominations[index].id,
    denominations[index].sort_order,
    denominations[targetIndex].id,
    denominations[targetIndex].sort_order,
  );

  revalidatePath("/settings/denominations");
  revalidatePath("/");
}

export async function moveDenominationUp(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await moveDenomination(id, "up");
}

export async function moveDenominationDown(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await moveDenomination(id, "down");
}

export async function deleteDenomination(formData: FormData) {
  await requireAuth();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await getSupabaseClient()
    .from("denominations")
    .delete()
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/settings/denominations");
  revalidatePath("/");
}
