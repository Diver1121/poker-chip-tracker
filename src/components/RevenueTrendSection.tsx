"use client";

import { useState } from "react";
import {
  computeDailyPurchaseValueTotals,
  computeDailyTournamentCashOceanTotals,
  computeMonthlyCumulativePurchaseSeries,
} from "@/lib/balances";
import { businessDateKey, shiftMonthKey } from "@/lib/businessDay";
import { percentChange, sumThroughDay } from "@/lib/statsFormat";
import type { ChipTransaction, Denomination, TournamentEntry } from "@/lib/types";
import { MonthlyPaceOverlayChart } from "@/components/MonthlyPaceOverlayChart";
import { MonthlyTrendHeadline } from "@/components/MonthlyTrendHeadline";

const TRAILING_MONTHS = 12;

type DataMode = "purchase" | "total";

function monthlyTotalsFromDaily(daily: Map<string, number>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const [date, value] of daily) {
    const monthKey = date.slice(0, 7);
    totals.set(monthKey, (totals.get(monthKey) ?? 0) + value);
  }
  return totals;
}

// 店全体の売上（購入点数）の月次推移。「今月は先月より伸びているか」を
// 一目で見えるようにする（従来の月/トータル切り替えの数字だけでは分からなかった）。
// 「OCEANトータル」ボタンで、チップ購入だけでなくトーナメントの現金エントリー分
// （OCEAN点数換算）も合算した数字に切り替えられる。
export function RevenueTrendSection({
  transactions,
  tournamentEntries,
  denominations,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  tournamentEntries: TournamentEntry[];
  denominations: Denomination[];
  currentMonthKey: string;
}) {
  const [mode, setMode] = useState<DataMode>("purchase");

  const dailyPurchase = computeDailyPurchaseValueTotals(transactions, denominations);
  const dailyTournamentCashOcean = computeDailyTournamentCashOceanTotals(
    tournamentEntries,
    denominations,
  );

  const dailyTotals = new Map<string, number>();
  for (const [date, value] of dailyPurchase) {
    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + value);
  }
  if (mode === "total") {
    for (const [date, value] of dailyTournamentCashOcean) {
      dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + value);
    }
  }

  const monthlyTotals = monthlyTotalsFromDaily(dailyTotals);
  const previousMonthKey = shiftMonthKey(currentMonthKey, -1);
  const currentValue = monthlyTotals.get(currentMonthKey) ?? 0;

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
  const unit = mode === "total" ? "OCEAN" : "購入";
  const sectionTitle = mode === "total" ? "月次OCEANトータル推移" : "月次売上推移（購入点数）";
  const headlineLabel = mode === "total" ? `${monthLabel}のOCEANトータル` : `${monthLabel}の売上`;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">{sectionTitle}</h2>
        <div className="flex gap-1 rounded-md border border-gray-300 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setMode("purchase")}
            className={`rounded px-2 py-1 font-medium ${
              mode === "purchase" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            チップ購入
          </button>
          <button
            type="button"
            onClick={() => setMode("total")}
            className={`rounded px-2 py-1 font-medium ${
              mode === "total" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            OCEANトータル
          </button>
        </div>
      </div>
      {mode === "total" && (
        <p className="mb-3 text-xs text-gray-500">
          チップ購入＋トーナメント現金エントリー（OCEAN点数換算）の合計です。
        </p>
      )}
      {paceSeries.length === 0 ? (
        <p className="text-sm text-gray-500">まだ記録がありません。</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4">
            <MonthlyTrendHeadline
              monthLabel={headlineLabel}
              value={currentValue}
              unit={unit}
              changePercent={changePercent}
              changeNote={`前月同日比（${todayOfMonth}日まで）`}
            />
          </div>
          <MonthlyPaceOverlayChart series={paceSeries} unit={unit} />
        </div>
      )}
    </section>
  );
}
