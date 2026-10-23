import { getSupabaseClient } from "@/lib/supabase";
import { businessDateKey } from "@/lib/businessDay";
import type {
  ChipTransaction,
  Customer,
  Denomination,
  Tournament,
  TournamentEntry,
  Visit,
} from "@/lib/types";

const nameCollator = new Intl.Collator("ja");

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => nameCollator.compare(a.name, b.name));
}

// SupabaseはRESTクエリ1回あたり最大1000件しか返さない（.range()未指定でも暗黙で切られる）。
// 件数が1000を超えるテーブル（chip_transactions等、日々増え続けるもの）を単純に
// .select("*") すると、古い行が黙って欠落し、そこから計算する合計値がずれてしまう。
// 全件取れるまでrangeをずらして取得し続ける。
const FETCH_PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryPage(from, from + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }
  return rows;
}

// レーキグラフで「当日分は営業終了・まとめて退店を押すまで表示しない」判定に使う。
// closeUndoable/previousClosedAtは「営業終了・まとめて退店」の誤操作対策の取り消し機能に使う
// （src/app/(app)/board/actions.tsのcheckOutAllCustomers/undoLastCheckOut参照）。
export async function getShopSettings(): Promise<{
  lastClosedAt: string | null;
  previousClosedAt: string | null;
  closeUndoable: boolean;
}> {
  const { data, error } = await getSupabaseClient()
    .from("shop_settings")
    .select("last_closed_at, previous_closed_at, close_undoable")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return {
    lastClosedAt: data?.last_closed_at ?? null,
    previousClosedAt: data?.previous_closed_at ?? null,
    closeUndoable: data?.close_undoable ?? false,
  };
}

export async function getDenominations(): Promise<Denomination[]> {
  const { data, error } = await getSupabaseClient()
    .from("denominations")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await getSupabaseClient().from("customers").select("*");
  if (error) throw error;
  return sortByName(data);
}

export async function getCheckedInCustomers(): Promise<Customer[]> {
  const { data, error } = await getSupabaseClient()
    .from("customers")
    .select("*")
    .not("checked_in_at", "is", null);
  if (error) throw error;
  return sortByName(data);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await getSupabaseClient()
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDenomination(id: string): Promise<Denomination | null> {
  const { data, error } = await getSupabaseClient()
    .from("denominations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllTransactions(): Promise<ChipTransaction[]> {
  // created_atだけでは同時刻（手入力の後追い記録等）の行が複数あるとページ境界の並び順が
  // 安定せず、range()による分割取得で同じ行が重複したり丸ごと抜け落ちたりする
  // （例: created_atが同一の行がpage境界をまたぐと、片方のpageには出るが後続のpageには
  // 出ない/両方に出る、が実際に発生した）。id（unique）を第二キーにして順序を安定させる。
  return fetchAllRows<ChipTransaction>((from, to) =>
    getSupabaseClient()
      .from("chip_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

// 当営業日（JST5時区切り）の取引だけを取得する。来店中ボードの「本日のバイイン/
// アウト/レーキ」はチェックイン中かどうかに関わらず店全体の当日分が必要だが、
// データが増え続けるchip_transactions全件を毎回取得するのは重いため、日付で絞り込む。
// SQL側は安全マージンとして前後1日分を広めに取り、正確な判定はbusinessDateKeyで
// JS側で行う（営業日は5時区切りなのでUTCの日付とは1日ずれ得るため）。
export async function getTransactionsForBusinessDay(dayKey: string): Promise<ChipTransaction[]> {
  const dayStartMs = new Date(`${dayKey}T00:00:00Z`).getTime();
  const rows = await fetchAllRows<ChipTransaction>((from, to) =>
    getSupabaseClient()
      .from("chip_transactions")
      .select("*")
      .gte("created_at", new Date(dayStartMs - 24 * 60 * 60 * 1000).toISOString())
      .lt("created_at", new Date(dayStartMs + 2 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return rows.filter((tx) => businessDateKey(tx.created_at) === dayKey);
}

export async function getAllVisits(): Promise<Visit[]> {
  return fetchAllRows<Visit>((from, to) =>
    getSupabaseClient()
      .from("visits")
      .select("*")
      .order("checked_in_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

export async function getTournamentEntries(): Promise<TournamentEntry[]> {
  return fetchAllRows<TournamentEntry>((from, to) =>
    getSupabaseClient()
      .from("tournament_entries")
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await getSupabaseClient()
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTransactionsForCustomer(
  customerId: string,
): Promise<ChipTransaction[]> {
  return fetchAllRows<ChipTransaction>((from, to) =>
    getSupabaseClient()
      .from("chip_transactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

// 複数客ぶんの取引だけをまとめて取得する。トーナメントページの保有チップ表示は
// その回にエントリーしている客だけ分かればよいので、店全体の全取引
// （chip_transactions全件、日々増え続ける）を毎回取得する必要はない
// （それが原因で保存のたびに数秒待たされていた。エントリー保存→ページ再取得の
// 都度、店全体の取引全件を読み直していたのが遅さの主因だった）。
export async function getTransactionsForCustomers(
  customerIds: string[],
): Promise<ChipTransaction[]> {
  if (customerIds.length === 0) return [];
  return fetchAllRows<ChipTransaction>((from, to) =>
    getSupabaseClient()
      .from("chip_transactions")
      .select("*")
      .in("customer_id", customerIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

export async function getTournamentEntriesForCustomer(
  customerId: string,
): Promise<TournamentEntry[]> {
  return fetchAllRows<TournamentEntry>((from, to) =>
    getSupabaseClient()
      .from("tournament_entries")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
}
