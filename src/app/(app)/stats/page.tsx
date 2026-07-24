import Link from "next/link";
import {
  getAllTransactions,
  getAllVisits,
  getCustomers,
  getDenominations,
  getShopSettings,
} from "@/lib/data";
import {
  computeCustomerResultTimelinesByDate,
  computeDailyRakeTotals,
  computeDailyTotals,
  computeDailyVisitCounts,
  computeVisitCountsByCustomer,
} from "@/lib/balances";
import { businessDateKey, businessMonthKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import { LineChart } from "@/components/LineChart";
import { MultiLineChart, type MultiLineSeries } from "@/components/MultiLineChart";
import { DailyBarChart } from "@/components/DailyBarChart";

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

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ month }, transactions, denominations, visits, customers, shopSettings] =
    await Promise.all([
      searchParams,
      getAllTransactions(),
      getDenominations(),
      getAllVisits(),
      getCustomers(),
      getShopSettings(),
    ]);

  const dailyTotals = computeDailyTotals(transactions, denominations);
  const shopCurrentTotal =
    dailyTotals.length > 0 ? dailyTotals[dailyTotals.length - 1].total : 0;

  // 「営業開始時点」の基準線：当営業日（朝5時区切り）が始まった時点の保有点数。
  // 当日分の増減（delta）を現在値から差し引くことで求める。
  const todayKey = businessDateKey(new Date());
  const lastDaily = dailyTotals[dailyTotals.length - 1];
  const businessStartTotal =
    lastDaily && lastDaily.date === todayKey ? lastDaily.total - lastDaily.delta : shopCurrentTotal;
  // レーキグラフ: 月切り替え（未来月には行けない）＋ 月内の全日を0埋めして棒を揃える。
  const currentMonthKey = businessMonthKey(new Date());
  const requestedMonthKey =
    month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthKey;
  const monthKey = requestedMonthKey > currentMonthKey ? currentMonthKey : requestedMonthKey;
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const nextMonthKey = shiftMonthKey(monthKey, 1);
  const canGoNext = nextMonthKey <= currentMonthKey;
  const [monthYearPart, monthNumPart] = monthKey.split("-");
  const monthLabel = `${monthYearPart}年${Number(monthNumPart)}月`;

  // 退店処理（営業終了・まとめて退店）が押されるまで、当日分はまだプレイ中で
  // 未回収のチップを含んでしまうため「未確定」として0のまま表示する。
  const todayClosed = Boolean(
    shopSettings.lastClosedAt && businessDateKey(shopSettings.lastClosedAt) === todayKey,
  );
  const rakeByDate = new Map(
    computeDailyRakeTotals(transactions).map((d) => [d.date, d.rake]),
  );
  const rakeChartData = daysInMonth(monthKey).map((date) => ({
    date,
    value: date === todayKey && !todayClosed ? 0 : (rakeByDate.get(date) ?? 0),
  }));
  const monthlyRakeTotal = rakeChartData.reduce((sum, d) => sum + d.value, 0);

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
            <LineChart
              data={dailyTotals}
              color="#4f46e5"
              gradientId="shopTotalFill"
              zoomToData
              referenceLine={{ label: "営業開始", value: businessStartTotal }}
            />
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">レーキグラフ</h2>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/stats?month=${prevMonthKey}`}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前月
            </Link>
            <span className="font-medium text-gray-900">{monthLabel}</span>
            {canGoNext ? (
              <Link
                href={`/stats?month=${nextMonthKey}`}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                翌月 →
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-gray-200 px-2 py-1 text-gray-300">
                翌月 →
              </span>
            )}
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          {monthLabel}の合計レーキ {monthlyRakeTotal.toLocaleString()}点。本日分は「営業終了・まとめて退店」を押すまで反映されません。
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <DailyBarChart data={rakeChartData} color="#d97706" />
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
