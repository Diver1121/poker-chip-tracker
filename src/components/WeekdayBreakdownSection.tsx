"use client";

import {
  computeDailyPurchaseValueTotals,
  computeDailyRakeTotals,
  computeDailyVisitCounts,
} from "@/lib/balances";
import { businessDateKey, shiftDayKey } from "@/lib/businessDay";
import { formatSigned, signColorClass } from "@/lib/statsFormat";
import type { ChipTransaction, Denomination, Visit } from "@/lib/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function WeekdayBreakdownSection({
  transactions,
  visits,
  denominations,
  lastClosedAt,
}: {
  transactions: ChipTransaction[];
  visits: Visit[];
  denominations: Denomination[];
  lastClosedAt: string | null;
}) {
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

  type WeekdayAgg = { dayCount: number; visitCount: number; rake: number; purchaseValue: number };
  const weekdayAgg: WeekdayAgg[] = Array.from({ length: 7 }, () => ({
    dayCount: 0,
    visitCount: 0,
    rake: 0,
    purchaseValue: 0,
  }));

  // 開店日から直近の営業終了済みの日まで、記録の有無に関わらず全日を数えることで
  // 「来店がほぼない曜日」も平均に反映させる。
  for (
    let dateKey = firstDateKey;
    dateKey <= lastCompletedDayKey;
    dateKey = shiftDayKey(dateKey, 1)
  ) {
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

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-gray-900">店舗課題</h2>
      <p className="mb-4 text-xs text-gray-500">
        開店日から直近の営業終了済みの日までの曜日別平均値です（本日分は含みません）。
      </p>
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
        </table>
      </div>
    </section>
  );
}
