import { computeDailyPurchaseValueTotals, computeMonthlyPurchaseValueTotals } from "@/lib/balances";
import { businessDateKey, shiftMonthKey } from "@/lib/businessDay";
import { percentChange, sumThroughDay } from "@/lib/statsFormat";
import type { ChipTransaction, Denomination } from "@/lib/types";
import { MonthlyBarChart } from "@/components/MonthlyBarChart";
import { MonthlyTrendHeadline } from "@/components/MonthlyTrendHeadline";

const TRAILING_MONTHS = 12;

// 店全体の売上（購入点数）の月次推移。「今月は先月より伸びているか」を
// 一目で見えるようにする（従来の月/トータル切り替えの数字だけでは分からなかった）。
export function RevenueTrendSection({
  transactions,
  denominations,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  denominations: Denomination[];
  currentMonthKey: string;
}) {
  const monthlyTotals = computeMonthlyPurchaseValueTotals(transactions, denominations);
  const previousMonthKey = shiftMonthKey(currentMonthKey, -1);
  const currentValue = monthlyTotals.get(currentMonthKey) ?? 0;

  const dailyTotals = computeDailyPurchaseValueTotals(transactions, denominations);
  const todayOfMonth = Number(businessDateKey(new Date()).slice(8, 10));
  const previousValueThroughSameDay = sumThroughDay(dailyTotals, previousMonthKey, todayOfMonth);
  const changePercent = percentChange(currentValue, previousValueThroughSameDay);

  const allMonthKeys = [...monthlyTotals.keys()].sort();
  const chartMonthKeys = allMonthKeys.slice(-TRAILING_MONTHS);
  const chartData = chartMonthKeys.map((monthKey) => ({
    monthKey,
    value: monthlyTotals.get(monthKey) ?? 0,
  }));

  const [yearPart, numPart] = currentMonthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-gray-900">月次売上推移（購入点数）</h2>
      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500">まだ購入の記録がありません。</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4">
            <MonthlyTrendHeadline
              monthLabel={`${monthLabel}の売上`}
              value={currentValue}
              unit="購入"
              changePercent={changePercent}
              changeNote={`前月同日比（${todayOfMonth}日まで）`}
            />
          </div>
          <MonthlyBarChart data={chartData} label="売上" unit="購入" />
        </div>
      )}
    </section>
  );
}
