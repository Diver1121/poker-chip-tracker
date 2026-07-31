"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { insertChipTransaction } from "@/lib/transactions";
import { categorySign } from "@/lib/transactionCategory";
import { appendChatMessage } from "@/lib/chatLog";
import { getDenominations, getTournamentEntries } from "@/lib/data";
import { businessDateKey } from "@/lib/businessDay";
import type { Denomination, TransactionCategory } from "@/lib/types";

// TURBOの種類だけプライズ総額の計算式が異なる（合計エントリー×200×0.4、
// 通常は×300×0.4）。額面のラベルまたは別名に「turbo」「ターボ」が含まれるかで判定する。
function isTurboDenomination(denomination: Denomination | undefined): boolean {
  if (!denomination) return false;
  const keywords = [denomination.label, ...denomination.aliases].map((k) =>
    k.toLowerCase(),
  );
  return keywords.some((k) => k.includes("turbo") || k.includes("ターボ"));
}

function toInt(value: FormDataEntryValue | null): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toNullableInt(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function revalidateAffectedPages() {
  revalidatePath("/tournament");
  revalidatePath("/board");
  revalidatePath("/transactions");
  revalidatePath("/chat");
  revalidatePath("/");
}

// 指定した客・額面の現在の保有枚数を計算する。excludeTransactionIdには、
// 今まさに更新しようとしている取引（保存し直す前の古い数量）を渡して除外する
// （そうしないと「自分自身が使った分」を二重に差し引いて判定してしまうため）。
async function getDenominationBalance(
  customerId: string,
  denominationId: string,
  excludeTransactionId: string | null,
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chip_transactions")
    .select("id, category, quantity")
    .eq("customer_id", customerId)
    .eq("denomination_id", denominationId);
  if (error) throw error;

  let balance = 0;
  for (const tx of data ?? []) {
    if (excludeTransactionId && tx.id === excludeTransactionId) continue;
    balance += categorySign(tx.category as TransactionCategory) * tx.quantity;
  }
  return balance;
}

// 行のチップ回数・アドオン回数・獲得点数から、来店ボード・取引履歴と共有の
// chip_transactionsを作る/更新する/消す。保存し直すたびに二重登録しないよう、
// 前回作った取引のIDが分かっていれば新規作成ではなく更新にする。
async function syncLinkedTransaction(
  currentTransactionId: string | null,
  desired: {
    customerId: string;
    denominationId: string;
    category: "tournament" | "prize" | "cash_entry";
    quantity: number;
  } | null,
): Promise<string | null> {
  const supabase = getSupabaseClient();

  if (!desired) {
    if (currentTransactionId) {
      const { error } = await supabase
        .from("chip_transactions")
        .delete()
        .eq("id", currentTransactionId);
      if (error) throw error;
    }
    return null;
  }

  if (currentTransactionId) {
    const { error } = await supabase
      .from("chip_transactions")
      .update({
        customer_id: desired.customerId,
        denomination_id: desired.denominationId || null,
        quantity: desired.quantity,
      })
      .eq("id", currentTransactionId);
    if (error) throw error;
    return currentTransactionId;
  }

  return insertChipTransaction({
    customerId: desired.customerId,
    denominationId: desired.denominationId,
    category: desired.category,
    quantity: desired.quantity,
  });
}

type LinkedTransactionIds = {
  chip_transaction_id: string | null;
  addon_transaction_id: string | null;
  prize_transaction_id: string | null;
  cash_transaction_id: string | null;
  addon_cash_transaction_id: string | null;
};

type DayValues = {
  dayDenominationId: string | null;
  dayAddonDenominationId: string | null;
  dayChipValue: number;
  dayAddonValue: number;
};

// フォーム共通部分（この日のトーナメント種類・アドオン種類）から、
// 実際の点数計算に使う値を解決する。行ごと保存・まとめて保存の両方から使う。
async function resolveDayValues(formData: FormData): Promise<DayValues> {
  const supabase = getSupabaseClient();
  const dayDenominationId = String(formData.get("dayDenominationId") ?? "") || null;
  const dayAddonDenominationId = String(formData.get("dayAddonDenominationId") ?? "") || null;

  const denominationIds = [dayDenominationId, dayAddonDenominationId].filter(
    (id): id is string => Boolean(id),
  );
  const valueById = new Map<string, number>();
  if (denominationIds.length > 0) {
    const { data: denominationRows, error: denomError } = await supabase
      .from("denominations")
      .select("id, value")
      .in("id", denominationIds);
    if (denomError) throw denomError;
    for (const row of denominationRows) valueById.set(row.id, row.value);
  }

  return {
    dayDenominationId,
    dayAddonDenominationId,
    dayChipValue: dayDenominationId ? (valueById.get(dayDenominationId) ?? 0) : 0,
    dayAddonValue: dayAddonDenominationId ? (valueById.get(dayAddonDenominationId) ?? 0) : 0,
  };
}

// 1行分（rowIndex）だけを保存する。名前が空の行は「未使用の空欄」として何もしない。
// チップ欄・アドオン欄は点数の直接入力ではなく「回数」。実際の点数は
// 回数 × その日選んだ種類のvalue、をサーバー側で計算する
// （信頼できるのはDB側のvalueなので、計算はクライアントに任せない）。
// NAME欄が客一覧の名前と一致した行は、チップ回数・アドオン回数・獲得点数から
// 来店ボード・取引履歴と共有のchip_transactionsも作る（旧・来店ボードの
// 「トーナメント使用」「プライズ獲得」ボタンと同じ扱いになる）。
async function saveEntryRow(
  formData: FormData,
  rowIndex: number,
  day: DayValues,
  existing: LinkedTransactionIds | undefined,
  senderName: string,
) {
  const supabase = getSupabaseClient();
  const id = String(formData.get(`id-${rowIndex}`) ?? "");
  const name = String(formData.get(`name-${rowIndex}`) ?? "").trim();
  if (!name) return;

  const customerId = String(formData.get(`customerId-${rowIndex}`) ?? "") || null;
  const cashAmount = toInt(formData.get(`cashAmount-${rowIndex}`));
  const chipCount = toInt(formData.get(`chipCount-${rowIndex}`));
  const chipAmount = chipCount * day.dayChipValue;
  const ticketAmount = toInt(formData.get(`ticketAmount-${rowIndex}`));
  const addonCashAmount = toInt(formData.get(`addonCashAmount-${rowIndex}`));
  const addonCount = toInt(formData.get(`addonCount-${rowIndex}`));
  const prizeAmount = toInt(formData.get(`prizeAmount-${rowIndex}`));
  // エントリー欄は手入力せず、現金・チップ回数・チケットの合計をサーバー側で自動計算する
  // （チップは点数換算前の回数そのものを足す。例: 現金2 + チップ回数1 + チケット0 = 3）
  const entryFee = cashAmount + chipCount + ticketAmount;

  // 保有チップが足りない場合も保存自体は止めず、チャットに警告だけ残す
  // （現場の判断で入力を続けられるようにしつつ、あとで気づけるようにするため）。
  const warnings: string[] = [];
  if (customerId && day.dayDenominationId && chipCount > 0) {
    const available = await getDenominationBalance(
      customerId,
      day.dayDenominationId,
      existing?.chip_transaction_id ?? null,
    );
    if (chipCount > available) {
      warnings.push(`${name}: チップ${chipCount}回分の保有チップが足りません（保有${available}枚）`);
    }
  }
  if (customerId && day.dayAddonDenominationId && addonCount > 0) {
    const available = await getDenominationBalance(
      customerId,
      day.dayAddonDenominationId,
      existing?.addon_transaction_id ?? null,
    );
    if (addonCount > available) {
      warnings.push(`${name}: アドオン${addonCount}回分の保有チップが足りません（保有${available}枚）`);
    }
  }

  const cashTransactionId = await syncLinkedTransaction(
    existing?.cash_transaction_id ?? null,
    customerId && cashAmount > 0
      ? { customerId, denominationId: "", category: "cash_entry", quantity: cashAmount }
      : null,
  );
  const chipTransactionId = await syncLinkedTransaction(
    existing?.chip_transaction_id ?? null,
    customerId && day.dayDenominationId && chipCount > 0
      ? {
          customerId,
          denominationId: day.dayDenominationId,
          category: "tournament",
          quantity: chipCount,
        }
      : null,
  );
  const addonTransactionId = await syncLinkedTransaction(
    existing?.addon_transaction_id ?? null,
    customerId && day.dayAddonDenominationId && addonCount > 0
      ? {
          customerId,
          denominationId: day.dayAddonDenominationId,
          category: "tournament",
          quantity: addonCount,
        }
      : null,
  );
  const addonCashTransactionId = await syncLinkedTransaction(
    existing?.addon_cash_transaction_id ?? null,
    customerId && addonCashAmount > 0
      ? { customerId, denominationId: "", category: "cash_entry", quantity: addonCashAmount }
      : null,
  );
  const prizeTransactionId = await syncLinkedTransaction(
    existing?.prize_transaction_id ?? null,
    customerId && prizeAmount > 0
      ? { customerId, denominationId: "", category: "prize", quantity: prizeAmount }
      : null,
  );

  const fields = {
    name,
    customer_id: customerId,
    entry_fee: entryFee,
    cash_amount: cashAmount,
    cash_transaction_id: cashTransactionId,
    denomination_id: day.dayDenominationId,
    chip_count: chipCount,
    chip_amount: chipAmount,
    chip_transaction_id: chipTransactionId,
    ticket_amount: ticketAmount,
    addon_denomination_id: day.dayAddonDenominationId,
    addon_cash_amount: addonCashAmount,
    addon_cash_transaction_id: addonCashTransactionId,
    addon_count: addonCount,
    addon_amount: addonCount * day.dayAddonValue,
    addon_transaction_id: addonTransactionId,
    rank: toNullableInt(formData.get(`rank-${rowIndex}`)),
    prize_amount: prizeAmount,
    prize_transaction_id: prizeTransactionId,
  };

  if (id) {
    const { error } = await supabase.from("tournament_entries").update(fields).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("tournament_entries").insert(fields);
    if (error) throw error;
  }

  for (const warningText of warnings) {
    await appendChatMessage(crypto.randomUUID(), "reply", `⚠ ${warningText}（トーナメント表）`, {
      ok: true,
      warning: true,
      senderName,
    });
  }
}

// プライズ対象人数・総額を計算する。人数は合計エントリー数×15%を切り上げ。
// 総額（チップ）は合計エントリー数×単価×0.4で、単価はこの日のトーナメント種類が
// TURBOなら200、それ以外は300。結果はURLパラメータに載せて表示するだけで、
// 保存や個別の配分は行わない。
export async function calculatePrizeCount(formData: FormData) {
  await requireAuth();

  const dayKey = String(formData.get("dayKey") ?? "");
  const dayDenominationId = String(formData.get("dayDenominationId") ?? "") || null;

  const [entries, denominations] = await Promise.all([
    getTournamentEntries(),
    getDenominations(),
  ]);
  const totalEntries = entries
    .filter((entry) => businessDateKey(entry.created_at) === dayKey)
    .reduce((sum, entry) => sum + entry.entry_fee, 0);

  const dayDenomination = denominations.find((d) => d.id === dayDenominationId);
  const perEntryValue = isTurboDenomination(dayDenomination) ? 200 : 300;

  const prizeCount = totalEntries > 0 ? Math.ceil(totalEntries * 0.15) : 0;
  const prizeTotal = Math.round(totalEntries * perEntryValue * 0.4);

  redirect(`/tournament?date=${dayKey}&prizeCount=${prizeCount}&prizeTotal=${prizeTotal}`);
}

// 表全体（最大rowCount行）を1回の送信でまとめて保存する。
export async function saveAllTournamentEntries(formData: FormData) {
  const senderName = await requireAuth();

  const supabase = getSupabaseClient();
  const day = await resolveDayValues(formData);
  const rowCount = Number(formData.get("rowCount") ?? 0);

  const existingIds = Array.from({ length: rowCount }, (_, i) =>
    String(formData.get(`id-${i}`) ?? ""),
  ).filter(Boolean);
  const existingById = new Map<string, LinkedTransactionIds>();
  if (existingIds.length > 0) {
    const { data: existingRows, error: existingError } = await supabase
      .from("tournament_entries")
      .select("id, chip_transaction_id, addon_transaction_id, prize_transaction_id, cash_transaction_id, addon_cash_transaction_id")
      .in("id", existingIds);
    if (existingError) throw existingError;
    for (const row of existingRows) existingById.set(row.id, row);
  }

  for (let i = 0; i < rowCount; i++) {
    const id = String(formData.get(`id-${i}`) ?? "");
    await saveEntryRow(formData, i, day, id ? existingById.get(id) : undefined, senderName);
  }

  revalidateAffectedPages();
}

// 行ごとの保存ボタン用（formAction + bind(rowIndex)で使う想定）。
// 「まとめて保存」と同じ共有フォームに同居させ、この行(rowIndex)だけを保存する。
export async function saveTournamentEntry(rowIndex: number, formData: FormData) {
  const senderName = await requireAuth();

  const supabase = getSupabaseClient();
  const day = await resolveDayValues(formData);

  const id = String(formData.get(`id-${rowIndex}`) ?? "");
  let existing: LinkedTransactionIds | undefined;
  if (id) {
    const { data, error } = await supabase
      .from("tournament_entries")
      .select("chip_transaction_id, addon_transaction_id, prize_transaction_id, cash_transaction_id, addon_cash_transaction_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    existing = data ?? undefined;
  }

  await saveEntryRow(formData, rowIndex, day, existing, senderName);

  revalidateAffectedPages();
}

// 「まとめて保存」フォームの中に同居させるため、formAction + bind(id)で使う想定
// （行ごとに個別のフォームを持たず、共有フォームの送信中は他のボタンも一緒に無効化される）。
// 行を削除するときは、その行から作られたchip_transactionsも一緒に削除する
// （残すと来店ボードの保有表示・取引履歴にゴミが残り続けるため）。
export async function deleteTournamentEntry(id: string, _formData: FormData) {
  await requireAuth();
  if (!id) return;

  const supabase = getSupabaseClient();

  const { data: entry, error: fetchError } = await supabase
    .from("tournament_entries")
    .select("chip_transaction_id, addon_transaction_id, prize_transaction_id, cash_transaction_id, addon_cash_transaction_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const linkedTransactionIds = [
    entry?.chip_transaction_id,
    entry?.addon_transaction_id,
    entry?.prize_transaction_id,
    entry?.cash_transaction_id,
    entry?.addon_cash_transaction_id,
  ].filter((transactionId): transactionId is string => Boolean(transactionId));

  if (linkedTransactionIds.length > 0) {
    const { error: deleteTransactionsError } = await supabase
      .from("chip_transactions")
      .delete()
      .in("id", linkedTransactionIds);
    if (deleteTransactionsError) throw deleteTransactionsError;
  }

  const { error } = await supabase.from("tournament_entries").delete().eq("id", id);
  if (error) throw error;

  revalidateAffectedPages();
}
