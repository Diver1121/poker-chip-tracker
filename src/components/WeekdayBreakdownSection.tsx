"use client";

import { useState } from "react";
import {
  computeDailyPurchaseValueTotals,
  computeDailyRakeTotals,
  computeDailyVisitCounts,
} from "@/lib/balances";
import { businessDateKey, daysInMonth, shiftDayKey, shiftMonthKey } from "@/lib/businessDay";
import { formatSigned, signColorClass } from "@/lib/statsFormat";
import type { ChipTransaction, Denomination, Visit } from "@/lib/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type ViewMode = "month" | "total";

export function WeekdayBreakdownSection({
  transactions,
  visits,
  denominations,
  lastClosedAt,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  visits: Visit[];
  denominations: Denomination[];
  lastClosedAt: string | null;
  currentMonthKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const todayKey = businessDateKey(new Date());
  const todayClosed = Boolean(lastClosedAt && businessDateKey(lastClosedAt) === todayKey);
  // 本日分はまだ営業途中で数値が定まらないため、曜日平均には含めない。
  const lastCompletedDayKey = todayClosed ? todayKey : shiftDayKey(todayKey, -1);

  const dailyRakeByDate = new Map(
    computeDailyRakeTotals(transactions, denominations).map((d) => [d.date, d]),
  );
  const dailyVisitCountByDate = new Map(
    computeDailyVisitCounts(visits).map((d) => [d.date, d.count]),
  );
  const dailyPurchaseValueByDate = computeDailyPurchaseValueTotals(transactions, denominations);

  const recordedDates = [
    ...new Set([
      ...dailyRakeByDate.keys(),
      ...dailyVisitCountByDate.keys(),
      ...dailyPurchaseValueByDate.keys(),
    ]),
  ].sort();

  if (recordedDates.length === 0) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">店舗課題</h2>
        <p className="text-sm text-gray-500">記録がありません。</p>
      </section>
    );
  }

  const firstDateKey = recordedDates[0];
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;
  const [monthYearPart, monthNumPart] = monthKey.split("-");
  const monthLabel = `${monthYearPart}年${Number(monthNumPart)}月`;

  // 「トータル」は開店日〜直近の営業終了済みの日まで全日、「月」は選んだ月のうち
  // 記録期間に収まる日だけを対象にする（本日分・未来日・開店前は含めない）。
  const targetDateKeys: string[] =
    viewMode === "total"
      ? (() => {
          const keys: string[] = [];
          for (let d = firstDateKey; d <= lastCompletedDayKey; d = shiftDayKey(d, 1)) keys.push(d);
          return keys;
        })()
      : daysInMonth(monthKey).filter((d) => d >= firstDateKey && d <= lastCompletedDayKey);

  type WeekdayAgg = { dayCount: number; visitCount: number; rake: number; purchaseValue: number };
  const weekdayAgg: WeekdayAgg[] = Array.from({ length: 7 }, () => ({
    dayCount: 0,
    visitCount: 0,
    rake: 0,
    purchaseValue: 0,
  }));

  // 記録の有無に関わらず対象期間の全日を数えることで「来店がほぼない曜日」も平均に反映させる。
  for (const dateKey of targetDateKeys) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const agg = weekdayAgg[weekday];
    agg.dayCount += 1;
    agg.visitCount += dailyVisitCountByDate.get(dateKey) ?? 0;
    agg.rake += dailyRakeByDate.get(dateKey)?.rakeWithTournament ?? 0;
    agg.purchaseValue += dailyPurchaseValueByDate.get(dateKey) ?? 0;
  }

  const rows = WEEKDAY_LABELS.map((label, weekday) => {
    const agg = weekdayAgg[weekday];
    const avgVisitCount = agg.dayCount > 0 ? agg.visitCount / agg.dayCount : null;
    const avgRake = agg.dayCount > 0 ? agg.rake / agg.dayCount : null;
    const avgSpendPerVisit = agg.visitCount > 0 ? agg.purchaseValue / agg.visitCount : null;
    return { weekday, label, dayCount: agg.dayCount, avgVisitCount, avgRake, avgSpendPerVisit };
  });

  // 曜日を問わない全体の平均（「トータル」行）。
  const overallAgg = weekdayAgg.reduce(
    (sum, agg) => ({
      dayCount: sum.dayCount + agg.dayCount,
      visitCount: sum.visitCount + agg.visitCount,
      rake: sum.rake + agg.rake,
      purchaseValue: sum.purchaseValue + agg.purchaseValue,
    }),
    { dayCount: 0, visitCount: 0, rake: 0, purchaseValue: 0 },
  );
  const overallRow = {
    dayCount: overallAgg.dayCount,
    avgVisitCount: overallAgg.dayCount > 0 ? overallAgg.visitCount / overallAgg.dayCount : null,
    avgRake: overallAgg.dayCount > 0 ? overallAgg.rake / overallAgg.dayCount : null,
    avgSpendPerVisit:
      overallAgg.visitCount > 0 ? overallAgg.purchaseValue / overallAgg.visitCount : null,
  };

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">店舗課題</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex gap-1 rounded-md border border-gray-300 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded px-2 py-1 font-medium ${
                viewMode === "month"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              月
            </button>
            <button
              type="button"
              onClick={() => setViewMode("total")}
              className={`rounded px-2 py-1 font-medium ${
                viewMode === "total"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              トータル
            </button>
          </div>
          {viewMode === "month" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                ← 前月
              </button>
              <span className="font-medium text-gray-900">{monthLabel}</span>
              <button
                type="button"
                onClick={() => setMonthKey((k) => shiftMonthKey(k, 1))}
                disabled={!canGoNextMonth}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                翌月 →
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        {viewMode === "total"
          ? "開店日から直近の営業終了済みの日までの曜日別平均値です（本日分は含みません）。"
          : "選んだ月のうち、記録期間に収まる日の曜日別平均値です（本日分は含みません）。"}
      </p>
      {targetDateKeys.length === 0 ? (
        <p className="text-sm text-gray-500">この月はまだ記録がありません。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">曜日</th>
                <th className="px-4 py-2 text-right font-medium">集計日数</th>
                <th className="px-4 py-2 text-right font-medium">平均来店客数</th>
                <th className="px-4 py-2 text-right font-medium">平均レーキ</th>
                <th className="px-4 py-2 text-right font-medium">客単価（購入/来店）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.weekday} className="hover:bg-gray-50">
                  <td
                    className={`px-4 py-2 text-left font-medium ${
                      r.label === "日"
                        ? "text-red-500"
                        : r.label === "土"
                          ? "text-blue-500"
                          : "text-gray-900"
                    }`}
                  >
                    {r.label}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">{r.dayCount}日</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {r.avgVisitCount === null ? "-" : `${r.avgVisitCount.toFixed(1)}人`}
                  </td>
                  <td
                    className={`px-4 py-2 text-right ${
                      r.avgRake === null ? "text-gray-400" : signColorClass(r.avgRake)
                    }`}
                  >
                    {r.avgRake === null ? "-" : formatSigned(Math.round(r.avgRake))}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {r.avgSpendPerVisit === null
                      ? "-"
                      : `${Math.round(r.avgSpendPerVisit).toLocaleString()}購入`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="border-t border-gray-200 font-bold">
                <td className="px-4 py-2 text-left text-gray-900">
                  トータル（曜日問わず）
                </td>
                <td className="px-4 py-2 text-right text-gray-900">{overallRow.dayCount}日</td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {overallRow.avgVisitCount === null ? "-" : `${overallRow.avgVisitCount.toFixed(1)}人`}
                </td>
                <td
                  className={`px-4 py-2 text-right ${
                    overallRow.avgRake === null ? "text-gray-400" : signColorClass(overallRow.avgRake)
                  }`}
                >
                  {overallRow.avgRake === null ? "-" : formatSigned(Math.round(overallRow.avgRake))}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {overallRow.avgSpendPerVisit === null
                    ? "-"
                    : `${Math.round(overallRow.avgSpendPerVisit).toLocaleString()}購入`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
