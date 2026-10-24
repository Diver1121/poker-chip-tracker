import {
  computeDailyPurchaseValueTotals,
  computeMonthlyCumulativePurchaseSeries,
  computeMonthlyPurchaseValueTotals,
} from "@/lib/balances";
import { businessDateKey, shiftMonthKey } from "@/lib/businessDay";
import { percentChange, sumThroughDay } from "@/lib/statsFormat";
import type { ChipTransaction, Denomination } from "@/lib/types";
import { MonthlyPaceOverlayChart } from "@/components/MonthlyPaceOverlayChart";
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

  // 各月を1日目から重ねて表示するペース比較グラフ用データ。進行中の今月は
  // まだ来ていない日まで0埋めで伸ばさないよう、今日の日数までに絞り込む。
  const cumulativeByMonth = computeMonthlyCumulativePurchaseSeries(dailyTotals, chartMonthKeys);
  const paceSeries = chartMonthKeys.map((monthKey) => {
    const values = cumulativeByMonth.get(monthKey) ?? [];
    return {
      monthKey,
      values: monthKey === currentMonthKey ? values.slice(0, todayOfMonth) : values,
    };
  });

  const [yearPart, numPart] = currentMonthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-gray-900">月次売上推移（購入点数）</h2>
      {paceSeries.length === 0 ? (
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
          <MonthlyPaceOverlayChart series={paceSeries} unit="購入" />
        </div>
      )}
    </section>
  );
}
