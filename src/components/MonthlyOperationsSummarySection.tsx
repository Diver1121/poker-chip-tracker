"use client";

import { useState } from "react";
import {
  computeDailyPokerOperatingMinutes,
  computeDailyPurchaseValueTotals,
  computeDailyRakeTotals,
  computeDailyVisitCounts,
} from "@/lib/balances";
import { businessDateKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import { average, formatMinutes, formatSigned, signColorClass } from "@/lib/statsFormat";
import type { ChipTransaction, Customer, Denomination, Visit } from "@/lib/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type ViewMode = "month" | "total";

type DayRow = {
  date: string;
  day: number;
  weekday: string;
  visitCount: number;
  rakeWithTournament: number;
  operatingMinutes: number | null;
  rakePerHour: number | null;
};

export function MonthlyOperationsSummarySection({
  transactions,
  visits,
  denominations,
  customers,
  lastClosedAt,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  visits: Visit[];
  denominations: Denomination[];
  customers: Customer[];
  lastClosedAt: string | null;
  currentMonthKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const todayKey = businessDateKey(new Date());
  // 退店処理（営業終了・まとめて退店）が押されるまで、当日分はまだプレイ中で
  // 未回収のチップを含んでしまうため「未確定」として0のまま表示する。
  const todayClosed = Boolean(lastClosedAt && businessDateKey(lastClosedAt) === todayKey);

  const dailyRakeByDate = new Map(
    computeDailyRakeTotals(transactions, denominations).map((d) => [d.date, d]),
  );
  const dailyVisitCountByDate = new Map(
    computeDailyVisitCounts(visits).map((d) => [d.date, d.count]),
  );
  const dailyPokerOperatingMinutesByDate = computeDailyPokerOperatingMinutes(transactions);
  const dailyPurchaseValueByDate = computeDailyPurchaseValueTotals(transactions, denominations);

  // トータル表示は「全期間の全日」ではなく、何かしら記録がある日だけを対象にする
  // （0件の日を無数に含めると表が意味を持たず重くなるだけのため）。
  const activeDates = [
    ...new Set([
      ...dailyRakeByDate.keys(),
      ...dailyVisitCountByDate.keys(),
      ...dailyPokerOperatingMinutesByDate.keys(),
    ]),
  ].sort();

  const dates = viewMode === "month" ? daysInMonth(monthKey) : activeDates;

  const rows: DayRow[] = dates.map((date) => {
    const finalized = date !== todayKey || todayClosed;
    const daily = dailyRakeByDate.get(date);
    const [rYear, rMonth, rDay] = date.split("-").map(Number);
    const weekday = WEEKDAY_LABELS[new Date(Date.UTC(rYear, rMonth - 1, rDay)).getUTCDay()];
    const rakeWithTournament = finalized ? (daily?.rakeWithTournament ?? 0) : 0;
    const operatingMinutes = finalized ? (dailyPokerOperatingMinutesByDate.get(date) ?? null) : null;
    return {
      date,
      day: rDay,
      weekday,
      visitCount: dailyVisitCountByDate.get(date) ?? 0,
      rakeWithTournament,
      operatingMinutes,
      rakePerHour:
        operatingMinutes && operatingMinutes > 0
          ? (rakeWithTournament / operatingMinutes) * 60
          : null,
    };
  });

  const totalVisitCount = rows.reduce((sum, d) => sum + d.visitCount, 0);
  const totalRake = rows.reduce((sum, d) => sum + d.rakeWithTournament, 0);
  const avgOperatingMinutes = average(
    rows.map((d) => d.operatingMinutes).filter((m): m is number => m !== null),
  );
  const avgRakePerHour = average(
    rows.map((d) => d.rakePerHour).filter((r): r is number => r !== null),
  );
  const visitActiveDayCount = rows.filter((d) => d.visitCount > 0).length;
  const avgVisitsPerActiveDay =
    visitActiveDayCount > 0 ? totalVisitCount / visitActiveDayCount : null;
  const operatingDayCount = rows.filter((d) => d.operatingMinutes !== null).length;
  const pokerUtilizationRate =
    visitActiveDayCount > 0 ? operatingDayCount / visitActiveDayCount : null;

  const totalPurchaseValue = dates.reduce(
    (sum, date) => sum + (dailyPurchaseValueByDate.get(date) ?? 0),
    0,
  );
  const avgSpendPerVisit = totalVisitCount > 0 ? totalPurchaseValue / totalVisitCount : null;

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  const newCustomerCount =
    viewMode === "month"
      ? customers.filter((c) => businessDateKey(c.created_at).slice(0, 7) === monthKey).length
      : customers.length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">月次運営サマリー</h2>
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
      <p className="mb-3 text-xs text-gray-500">
        本日分は「営業終了・まとめて退店」を押すまで反映されません。
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">
            来店数（{viewMode === "month" ? "月合計" : "全期間合計"}）
          </p>
          <p className="text-lg font-bold text-gray-900">{totalVisitCount.toLocaleString()}人</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">1日平均来店数</p>
          <p className="text-lg font-bold text-gray-900">
            {avgVisitsPerActiveDay === null ? "-" : `${avgVisitsPerActiveDay.toFixed(1)}人`}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">
            レーキ（{viewMode === "month" ? "月合計" : "全期間合計"}・店全体）
          </p>
          <p className={`text-lg font-bold ${signColorClass(totalRake)}`}>
            {formatSigned(totalRake)}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">客単価（購入/来店）</p>
          <p className="text-lg font-bold text-gray-900">
            {avgSpendPerVisit === null
              ? "-"
              : `${Math.round(avgSpendPerVisit).toLocaleString()}購入`}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">ポーカー稼働率</p>
          <p className="text-lg font-bold text-gray-900">
            {pokerUtilizationRate === null ? "-" : `${Math.round(pokerUtilizationRate * 100)}%`}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">ポーカー稼働時間（平均）</p>
          <p className="text-lg font-bold text-gray-900">
            {avgOperatingMinutes === null ? "-" : formatMinutes(Math.round(avgOperatingMinutes))}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">
            {viewMode === "month" ? "新規客数（今月登録）" : "客数（累計登録）"}
          </p>
          <p className="text-lg font-bold text-gray-900">
            {newCustomerCount.toLocaleString()}人
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">記録がありません。</p>
      ) : (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            日別の内訳を表示
          </summary>
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
                <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">日付</th>
                    <th className="px-4 py-2 text-right font-medium">来店数</th>
                    <th className="px-4 py-2 text-right font-medium">店全体</th>
                    <th className="px-4 py-2 text-right font-medium">ポーカー稼働時間</th>
                    <th className="px-4 py-2 text-right font-medium">1時間あたりレーキ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...rows].reverse().map((d) => {
                    const [ry, rm] = d.date.split("-").map(Number);
                    return (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td
                          className={`px-4 py-2 text-left ${
                            d.weekday === "日"
                              ? "text-red-500"
                              : d.weekday === "土"
                                ? "text-blue-500"
                                : "text-gray-900"
                          }`}
                        >
                          {viewMode === "total" ? `${ry}年${rm}月` : ""}
                          {d.day}日（{d.weekday}）
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {d.visitCount > 0 ? d.visitCount.toLocaleString() : "-"}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${signColorClass(d.rakeWithTournament)}`}
                        >
                          {formatSigned(d.rakeWithTournament)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {d.operatingMinutes === null ? "-" : formatMinutes(d.operatingMinutes)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${
                            d.rakePerHour === null ? "text-gray-400" : signColorClass(d.rakePerHour)
                          }`}
                        >
                          {d.rakePerHour === null ? "-" : formatSigned(Math.round(d.rakePerHour))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-gray-50">
                  <tr className="border-t border-gray-200 font-bold">
                    <td className="px-4 py-2 text-left text-gray-900">合計</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {totalVisitCount.toLocaleString()}
                    </td>
                    <td className={`px-4 py-2 text-right ${signColorClass(totalRake)}`}>
                      {formatSigned(totalRake)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {avgOperatingMinutes === null
                        ? "-"
                        : `平均 ${formatMinutes(Math.round(avgOperatingMinutes))}`}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        avgRakePerHour === null ? "text-gray-400" : signColorClass(avgRakePerHour)
                      }`}
                    >
                      {avgRakePerHour === null
                        ? "-"
                        : `平均 ${formatSigned(Math.round(avgRakePerHour))}`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
