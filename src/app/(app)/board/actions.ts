"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { insertChipTransaction } from "@/lib/transactions";
import { businessDateKey, fromJstDatetimeLocal } from "@/lib/businessDay";
import { getAllVisits, getCustomer, getCustomers } from "@/lib/data";

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

  const { data: settingsRow, error: settingsFetchError } = await supabase
    .from("shop_settings")
    .select("last_closed_at")
    .eq("id", true)
    .maybeSingle();
  if (settingsFetchError) throw settingsFetchError;

  const closedAt = new Date().toISOString();

  // レーキグラフは、まだプレイ中で未回収のチップを「レーキ」と誤表示しないよう
  // この時刻より前の当日分だけを確定表示する（/statsのgetShopSettingsで参照）。
  // previous_closed_at/close_undoableは、この操作を丸ごと取り消せるようにするための記録。
  const { error: settingsError } = await supabase
    .from("shop_settings")
    .update({
      last_closed_at: closedAt,
      previous_closed_at: settingsRow?.last_closed_at ?? null,
      close_undoable: true,
    })
    .eq("id", true);
  if (settingsError) throw settingsError;

  revalidatePath("/board");
  revalidatePath("/stats");
}

// 「営業終了・まとめて退店」の誤操作対策。直前の1回だけ取り消せる
// （2回連続では押せないよう、実行後にclose_undoableをfalseへ戻す）。
// チャットのアーカイブを解除し、来店ログ(visits)から当日分のチェックイン状態を復元し、
// 締め時刻も1つ前の値へ戻す。
export async function undoLastCheckOut() {
  await requireAuth();

  const supabase = getSupabaseClient();

  const { data: settings, error: settingsError } = await supabase
    .from("shop_settings")
    .select("last_closed_at, previous_closed_at, close_undoable")
    .eq("id", true)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.close_undoable || !settings.last_closed_at) return;

  const closedAt = settings.last_closed_at;

  // 通常の退店は「営業終了・まとめて退店」でしか起きないため、締め処理をした
  // 営業日分のvisitsが、そのまま「直前まで来店中だった客」の一覧になる。
  const dayKey = businessDateKey(closedAt);
  const [visits, customers] = await Promise.all([getAllVisits(), getCustomers()]);
  const checkedInIds = new Set(customers.filter((c) => c.checked_in_at).map((c) => c.id));
  const latestVisitByCustomer = new Map<string, string>();
  for (const visit of visits) {
    if (businessDateKey(visit.checked_in_at) !== dayKey) continue;
    const current = latestVisitByCustomer.get(visit.customer_id);
    if (!current || visit.checked_in_at > current) {
      latestVisitByCustomer.set(visit.customer_id, visit.checked_in_at);
    }
  }
  for (const [customerId, checkedInAt] of latestVisitByCustomer.entries()) {
    // 取消後に新しくチェックインし直した客は触らない
    if (checkedInIds.has(customerId)) continue;
    const { error } = await supabase
      .from("customers")
      .update({ checked_in_at: checkedInAt })
      .eq("id", customerId);
    if (error) throw error;
  }

  const { error: restoreSettingsError } = await supabase
    .from("shop_settings")
    .update({
      last_closed_at: settings.previous_closed_at,
      previous_closed_at: null,
      close_undoable: false,
    })
    .eq("id", true);
  if (restoreSettingsError) throw restoreSettingsError;

  revalidatePath("/board");
  revalidatePath("/stats");
}

export async function recordBoardTransaction(formData: FormData) {
  await requireAuth();

  const customerId = String(formData.get("customerId") ?? "");
  const denominationId = String(formData.get("denominationId") ?? "");
  const category = String(formData.get("category") ?? "");
  const quantity = Number(formData.get("quantity"));
  const gameRaw = String(formData.get("game") ?? "");
  const game = gameRaw === "poker" || gameRaw === "blackjack" ? gameRaw : undefined;
  const createdAtLocal = String(formData.get("createdAt") ?? "");
  let createdAt = createdAtLocal ? fromJstDatetimeLocal(createdAtLocal) : undefined;

  const customer = await getCustomer(customerId);

  // 来店ボードの日時欄はページを開いた時刻のままになりがちで、チェックイン直後に
  // 入力するとその取引が「チェックインより前」の時刻で記録されてしまうことがある。
  // そうなると額面バッジの「今回の来店分」判定から漏れ、購入したはずのチップが
  // 表示されなくなるため、チェックイン時刻より前にはならないよう補正する。
  if (createdAt && customer?.checked_in_at && createdAt < customer.checked_in_at) {
    createdAt = customer.checked_in_at;
  }

  await insertChipTransaction({
    customerId,
    denominationId,
    category,
    quantity,
    createdAt,
    game,
  });

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/transactions");
}
