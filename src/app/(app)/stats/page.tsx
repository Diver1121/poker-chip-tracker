import {
  getAllTransactions,
  getAllVisits,
  getCustomers,
  getDenominations,
} from "@/lib/data";
import {
  computeCustomerResultTimelinesByDate,
  computeDailyTotals,
  computeDailyVisitCounts,
  computeVisitCountsByCustomer,
} from "@/lib/balances";
import { LineChart } from "@/components/LineChart";
import { MultiLineChart, type MultiLineSeries } from "@/components/MultiLineChart";

const COMPARISON_COLORS = [
  "#4f46e5",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0ea5e9",
  "#db2777",
  "#65a30d",
  "#0d9488",
  "#ea580c",
  "#9333ea",
  "#2563eb",
  "#be123c",
  "#4d7c0f",
  "#c026d3",
  "#0891b2",
  "#b45309",
  "#6366f1",
  "#15803d",
  "#e11d48",
];

const COMPARISON_CUSTOMER_LIMIT = 20;

export default async function StatsPage() {
  const [transactions, denominations, visits, customers] = await Promise.all([
    getAllTransactions(),
    getDenominations(),
    getAllVisits(),
    getCustomers(),
  ]);

  const dailyTotals = computeDailyTotals(transactions, denominations);
  const shopCurrentTotal =
    dailyTotals.length > 0 ? dailyTotals[dailyTotals.length - 1].total : 0;
  const dailyVisitCounts = computeDailyVisitCounts(visits);
  const visitCountsByCustomer = computeVisitCountsByCustomer(visits);

  const topVisitors = customers
    .map((c) => ({ customer: c, count: visitCountsByCustomer.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 収支比較グラフは、線が多すぎて見づらくならないよう取引数が多い上位客だけに絞る
  const resultTimelinesByCustomer = computeCustomerResultTimelinesByDate(
    transactions,
    denominations,
  );
  const transactionCountByCustomer = new Map<string, number>();
  for (const tx of transactions) {
    transactionCountByCustomer.set(
      tx.customer_id,
      (transactionCountByCustomer.get(tx.customer_id) ?? 0) + 1,
    );
  }
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const comparisonSeries: MultiLineSeries[] = [...resultTimelinesByCustomer.entries()]
    .sort(
      ([a], [b]) =>
        (transactionCountByCustomer.get(b) ?? 0) - (transactionCountByCustomer.get(a) ?? 0),
    )
    .slice(0, COMPARISON_CUSTOMER_LIMIT)
    .map(([customerId, data], index) => ({
      key: customerId,
      label: customerName.get(customerId) ?? "(削除済み)",
      color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
      data: data.map((d) => ({ date: d.date, value: d.total })),
    }));

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">グラフ</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">店全体の保有チップ量（現在）</p>
        <p className="text-3xl font-bold text-indigo-600">
          {shopCurrentTotal.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-gray-500">点</span>
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">店全体の保有点数の推移</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {dailyTotals.length === 0 ? (
            <p className="text-sm text-gray-500">まだ取引がありません。</p>
          ) : (
            <LineChart data={dailyTotals} color="#4f46e5" gradientId="shopTotalFill" />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">客ごとの収支比較</h2>
        <p className="mb-3 text-xs text-gray-500">
          取引数が多い上位{comparisonSeries.length}名の収支推移を重ねて表示しています。
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {comparisonSeries.length === 0 ? (
            <p className="text-sm text-gray-500">まだ取引がありません。</p>
          ) : (
            <MultiLineChart series={comparisonSeries} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">来店数の推移</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {dailyVisitCounts.length === 0 ? (
            <p className="text-sm text-gray-500">まだ来店記録がありません。</p>
          ) : (
            <LineChart
              data={dailyVisitCounts.map((d) => ({ date: d.date, total: d.count }))}
              color="#059669"
              gradientId="visitCountFill"
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">来店頻度ランキング</h2>
        {topVisitors.length === 0 ? (
          <p className="text-sm text-gray-500">まだ来店記録がありません。</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">客</th>
                  <th className="px-4 py-2 font-medium">来店回数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topVisitors.map(({ customer, count }) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-2 text-gray-900">{customer.name}</td>
                    <td className="px-4 py-2 text-gray-900">{count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
