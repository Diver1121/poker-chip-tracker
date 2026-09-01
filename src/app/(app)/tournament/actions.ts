"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { insertChipTransaction } from "@/lib/transactions";
import { getDenominations, getTournamentEntries, getTournaments } from "@/lib/data";
import { businessDateKey } from "@/lib/businessDay";
import type { Denomination } from "@/lib/types";

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
  revalidatePath("/");
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

type SessionValues = {
  tournamentId: string;
  denominationId: string | null;
  addonDenominationId: string | null;
  chipValue: number;
  addonValue: number;
};

// トーナメントの「回」（tournaments行）から、実際の点数計算に使う値を解決する。
// 種類は回の開始時に固定されており、保存のたびにフォームから送り直す必要はない
// （同じ営業日に複数の回が並行していても、種類が混ざらないようにするため）。
async function resolveSessionValues(tournamentId: string): Promise<SessionValues> {
  const supabase = getSupabaseClient();
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, denomination_id, addon_denomination_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tournamentError) throw tournamentError;
  if (!tournament) {
    throw new Error("トーナメントの回が見つかりません。");
  }

  const denominationIds = [tournament.denomination_id, tournament.addon_denomination_id].filter(
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
    tournamentId,
    denominationId: tournament.denomination_id,
    addonDenominationId: tournament.addon_denomination_id,
    chipValue: tournament.denomination_id ? (valueById.get(tournament.denomination_id) ?? 0) : 0,
    addonValue: tournament.addon_denomination_id
      ? (valueById.get(tournament.addon_denomination_id) ?? 0)
      : 0,
  };
}

// 新しいトーナメントの回を開始する。同じ営業日にすでに回があっても、
// 別の種類（例: TURBO）で並行して開始できる。開始できるのは「今日」だけ。
export async function createTournament(formData: FormData) {
  await requireAuth();

  const supabase = getSupabaseClient();
  const label = String(formData.get("label") ?? "").trim();
  const denominationId = String(formData.get("denominationId") ?? "") || null;
  const addonDenominationId = String(formData.get("addonDenominationId") ?? "") || null;

  const todayKey = businessDateKey(new Date());
  const existingTournaments = await getTournaments();
  const todaysCount = existingTournaments.filter(
    (t) => businessDateKey(t.created_at) === todayKey,
  ).length;
  const resolvedLabel = label || `${todaysCount + 1}回目`;

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      label: resolvedLabel,
      denomination_id: denominationId,
      addon_denomination_id: addonDenominationId,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidateAffectedPages();
  redirect(`/tournament?date=${todayKey}&session=${data.id}`);
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
  session: SessionValues,
  existing: LinkedTransactionIds | undefined,
  // 新規行のcreated_at。行を並行保存するとDBへの到達順が入力順と一致しなくなり、
  // created_at昇順で並べる一覧の行番号(紙のエントリーシート通し番号)がずれてしまうため、
  // rowIndexから機械的に決めた時刻を明示的に入れて並び順を保証する
  // （既存行の更新では触らないので、後からの編集で並び順が動くことはない）。
  newRowCreatedAt: string,
) {
  const supabase = getSupabaseClient();
  const id = String(formData.get(`id-${rowIndex}`) ?? "");
  const name = String(formData.get(`name-${rowIndex}`) ?? "").trim();
  if (!name) return;

  const customerId = String(formData.get(`customerId-${rowIndex}`) ?? "") || null;
  const cashAmount = toInt(formData.get(`cashAmount-${rowIndex}`));
  const chipCount = toInt(formData.get(`chipCount-${rowIndex}`));
  const chipAmount = chipCount * session.chipValue;
  const ticketAmount = toInt(formData.get(`ticketAmount-${rowIndex}`));
  const addonCashAmount = toInt(formData.get(`addonCashAmount-${rowIndex}`));
  const addonCount = toInt(formData.get(`addonCount-${rowIndex}`));
  const prizeAmount = toInt(formData.get(`prizeAmount-${rowIndex}`));
  // エントリー欄は手入力せず、現金・チップ回数・チケットの合計をサーバー側で自動計算する
  // （チップは点数換算前の回数そのものを足す。例: 現金2 + チップ回数1 + チケット0 = 3）
  const entryFee = cashAmount + chipCount + ticketAmount;

  // 5つの連携チップ取引は互いに独立（別カラムのtransaction_id）なので、
  // 順番に待たず並行実行する（行数×5回の直列往復が反映の遅さの主因だったため）。
  const [
    cashTransactionId,
    chipTransactionId,
    addonTransactionId,
    addonCashTransactionId,
    prizeTransactionId,
  ] = await Promise.all([
    syncLinkedTransaction(
      existing?.cash_transaction_id ?? null,
      customerId && cashAmount > 0
        ? { customerId, denominationId: "", category: "cash_entry", quantity: cashAmount }
        : null,
    ),
    syncLinkedTransaction(
      existing?.chip_transaction_id ?? null,
      customerId && session.denominationId && chipCount > 0
        ? {
            customerId,
            denominationId: session.denominationId,
            category: "tournament",
            quantity: chipCount,
          }
        : null,
    ),
    syncLinkedTransaction(
      existing?.addon_transaction_id ?? null,
      customerId && session.addonDenominationId && addonCount > 0
        ? {
            customerId,
            denominationId: session.addonDenominationId,
            category: "tournament",
            quantity: addonCount,
          }
        : null,
    ),
    syncLinkedTransaction(
      existing?.addon_cash_transaction_id ?? null,
      customerId && addonCashAmount > 0
        ? { customerId, denominationId: "", category: "cash_entry", quantity: addonCashAmount }
        : null,
    ),
    syncLinkedTransaction(
      existing?.prize_transaction_id ?? null,
      customerId && prizeAmount > 0
        ? { customerId, denominationId: "", category: "prize", quantity: prizeAmount }
        : null,
    ),
  ]);

  const fields = {
    tournament_id: session.tournamentId,
    name,
    customer_id: customerId,
    entry_fee: entryFee,
    cash_amount: cashAmount,
    cash_transaction_id: cashTransactionId,
    denomination_id: session.denominationId,
    chip_count: chipCount,
    chip_amount: chipAmount,
    chip_transaction_id: chipTransactionId,
    ticket_amount: ticketAmount,
    addon_denomination_id: session.addonDenominationId,
    addon_cash_amount: addonCashAmount,
    addon_cash_transaction_id: addonCashTransactionId,
    addon_count: addonCount,
    addon_amount: addonCount * session.addonValue,
    addon_transaction_id: addonTransactionId,
    rank: toNullableInt(formData.get(`rank-${rowIndex}`)),
    prize_amount: prizeAmount,
    prize_transaction_id: prizeTransactionId,
  };

  if (id) {
    const { error } = await supabase.from("tournament_entries").update(fields).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("tournament_entries")
      .insert({ ...fields, created_at: newRowCreatedAt });
    if (error) throw error;
  }
}

// プライズ対象人数・総額を計算する。人数は合計エントリー数×15%を四捨五入。
// 総額（チップ）は合計エントリー数×単価×0.4で、単価はこの回のトーナメント種類が
// TURBOなら200、それ以外は300。結果はURLパラメータに載せて表示するだけで、
// 保存や個別の配分は行わない。
export async function calculatePrizeCount(formData: FormData) {
  await requireAuth();

  const dayKey = String(formData.get("dayKey") ?? "");
  const tournamentId = String(formData.get("tournamentId") ?? "");
  if (!tournamentId) return;

  const [entries, denominations, tournaments] = await Promise.all([
    getTournamentEntries(),
    getDenominations(),
    getTournaments(),
  ]);
  const totalEntries = entries
    .filter((entry) => entry.tournament_id === tournamentId)
    .reduce((sum, entry) => sum + entry.entry_fee, 0);

  const tournament = tournaments.find((t) => t.id === tournamentId);
  const sessionDenomination = denominations.find((d) => d.id === tournament?.denomination_id);
  const perEntryValue = isTurboDenomination(sessionDenomination) ? 200 : 300;

  const prizeCount = totalEntries > 0 ? Math.round(totalEntries * 0.15) : 0;
  const prizeTotal = Math.round(totalEntries * perEntryValue * 0.4);

  redirect(
    `/tournament?date=${dayKey}&session=${tournamentId}&prizeCount=${prizeCount}&prizeTotal=${prizeTotal}`,
  );
}

// 表全体（最大rowCount行）を1回の送信でまとめて保存する。
export async function saveAllTournamentEntries(formData: FormData) {
  await requireAuth();

  const supabase = getSupabaseClient();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  if (!tournamentId) return;
  const session = await resolveSessionValues(tournamentId);
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

  // 行同士も別レコードを触るだけで独立しているので、直列に40行分待たず並行保存する。
  // newRowBaseTimeはrowIndexごとにミリ秒ずつずらした新規行用のcreated_atの基準時刻
  // （並行保存でもcreated_at昇順=入力順になるようにするため）。
  const newRowBaseTime = Date.now();
  await Promise.all(
    Array.from({ length: rowCount }, (_, i) => {
      const id = String(formData.get(`id-${i}`) ?? "");
      const newRowCreatedAt = new Date(newRowBaseTime + i).toISOString();
      return saveEntryRow(
        formData,
        i,
        session,
        id ? existingById.get(id) : undefined,
        newRowCreatedAt,
      );
    }),
  );

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

// 間違えて作成した回そのものを削除する。エントリー各行から作られたchip_transactions
// も全部まとめて消してから消す（tournament_entries自体はtournamentsへの外部キーが
// on delete cascadeなので、tournaments行を消せば一緒に消える）。
export async function deleteTournament(
  tournamentId: string,
  dayKey: string,
  _formData: FormData,
) {
  await requireAuth();
  if (!tournamentId) return;

  const supabase = getSupabaseClient();

  const { data: entries, error: entriesError } = await supabase
    .from("tournament_entries")
    .select(
      "chip_transaction_id, addon_transaction_id, prize_transaction_id, cash_transaction_id, addon_cash_transaction_id",
    )
    .eq("tournament_id", tournamentId);
  if (entriesError) throw entriesError;

  const linkedTransactionIds = (entries ?? [])
    .flatMap((entry) => [
      entry.chip_transaction_id,
      entry.addon_transaction_id,
      entry.prize_transaction_id,
      entry.cash_transaction_id,
      entry.addon_cash_transaction_id,
    ])
    .filter((transactionId): transactionId is string => Boolean(transactionId));

  if (linkedTransactionIds.length > 0) {
    const { error: deleteTransactionsError } = await supabase
      .from("chip_transactions")
      .delete()
      .in("id", linkedTransactionIds);
    if (deleteTransactionsError) throw deleteTransactionsError;
  }

  const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId);
  if (error) throw error;

  revalidateAffectedPages();
  redirect(`/tournament?date=${dayKey}`);
}
