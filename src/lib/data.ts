import { getSupabaseClient } from "@/lib/supabase";
import type {
  ChatMessage,
  ChipTransaction,
  Customer,
  Denomination,
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
  return fetchAllRows<ChipTransaction>((from, to) =>
    getSupabaseClient()
      .from("chip_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to),
  );
}

export async function getChatMessages(): Promise<ChatMessage[]> {
  // 「営業終了・まとめて退店」でアーカイブされた分は除く（削除はせず、
  // 誤操作時にundoLastCheckOutで復元できるようarchived_atだけ立てて残している）。
  return fetchAllRows<ChatMessage>((from, to) =>
    getSupabaseClient()
      .from("chat_messages")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .range(from, to),
  );
}

export async function getAllVisits(): Promise<Visit[]> {
  return fetchAllRows<Visit>((from, to) =>
    getSupabaseClient()
      .from("visits")
      .select("*")
      .order("checked_in_at", { ascending: true })
      .range(from, to),
  );
}

export async function getTournamentEntries(): Promise<TournamentEntry[]> {
  return fetchAllRows<TournamentEntry>((from, to) =>
    getSupabaseClient()
      .from("tournament_entries")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, to),
  );
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
      .range(from, to),
  );
}
