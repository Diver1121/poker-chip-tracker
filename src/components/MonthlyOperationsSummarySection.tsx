"use client";

import { useState } from "react";
import {
  computeDailyPokerOperatingMinutes,
  computeDailyPurchaseValueTotals,
  computeDailyRakeTotals,
  computeDailyVisitCounts,
} from "@/lib/balances";
import { businessDateKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import { average, formatMinutes, formatSigned, monthLabelOf, signColorClass } from "@/lib/statsFormat";
import type { ChipTransaction, Customer, Denomination, Visit } from "@/lib/types";
import { ExpandableStatCard, type StatBreakdownRow } from "@/components/ExpandableStatCard";

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

  // リピート率: この期間に来店した客（ユニーク）のうち、2回以上来店した客の割合。
  const dateSet = new Set(dates);
  const visitCountByCustomer = new Map<string, number>();
  for (const v of visits) {
    const date = businessDateKey(v.checked_in_at);
    if (!dateSet.has(date)) continue;
    visitCountByCustomer.set(v.customer_id, (visitCountByCustomer.get(v.customer_id) ?? 0) + 1);
  }
  const uniqueVisitorCount = visitCountByCustomer.size;
  const repeatVisitorCount = [...visitCountByCustomer.values()].filter((n) => n >= 2).length;
  const repeatRate = uniqueVisitorCount > 0 ? repeatVisitorCount / uniqueVisitorCount : null;
  const repeatBreakdown = [2, 5, 10].map((min) => {
    const count = [...visitCountByCustomer.values()].filter((n) => n >= min).length;
    return { min, count, rate: uniqueVisitorCount > 0 ? count / uniqueVisitorCount : null };
  });

  // 新規/既存の来店構成比: 客ごとの初来店日（全期間で最も古い来店日）を求め、
  // この期間の来店（延べ数）のうち、それが初来店だったものの割合を「新規」とする。
  const firstVisitDateByCustomer = new Map<string, string>();
  for (const v of visits) {
    const date = businessDateKey(v.checked_in_at);
    const current = firstVisitDateByCustomer.get(v.customer_id);
    if (current === undefined || date < current) firstVisitDateByCustomer.set(v.customer_id, date);
  }
  let newVisitCount = 0;
  for (const v of visits) {
    const date = businessDateKey(v.checked_in_at);
    if (!dateSet.has(date)) continue;
    if (firstVisitDateByCustomer.get(v.customer_id) === date) newVisitCount += 1;
  }
  const existingVisitCount = totalVisitCount - newVisitCount;
  const newVisitRate = totalVisitCount > 0 ? newVisitCount / totalVisitCount : null;

  const totalPurchaseValue = dates.reduce(
    (sum, date) => sum + (dailyPurchaseValueByDate.get(date) ?? 0),
    0,
  );
  const avgSpendPerVisit = totalVisitCount > 0 ? totalPurchaseValue / totalVisitCount : null;

  // 各カードの「タップで月別」内訳は、選択中の月/トータルに関わらず、
  // 記録がある全月を新しい順に並べて全期間の推移を見せる。
  const monthlyKeys = [...new Set(activeDates.map((d) => d.slice(0, 7)))].sort().reverse();
  const monthlyVisitCount = new Map<string, number>();
  const monthlyActiveDayCount = new Map<string, number>();
  const monthlyRake = new Map<string, number>();
  const monthlyPurchaseValue = new Map<string, number>();
  const monthlyOperatingMinutesList = new Map<string, number[]>();
  for (const date of activeDates) {
    const mKey = date.slice(0, 7);
    const finalized = date !== todayKey || todayClosed;
    const visitCountOnDate = dailyVisitCountByDate.get(date) ?? 0;
    monthlyVisitCount.set(mKey, (monthlyVisitCount.get(mKey) ?? 0) + visitCountOnDate);
    if (visitCountOnDate > 0) {
      monthlyActiveDayCount.set(mKey, (monthlyActiveDayCount.get(mKey) ?? 0) + 1);
    }
    if (finalized) {
      monthlyRake.set(
        mKey,
        (monthlyRake.get(mKey) ?? 0) + (dailyRakeByDate.get(date)?.rakeWithTournament ?? 0),
      );
      monthlyPurchaseValue.set(
        mKey,
        (monthlyPurchaseValue.get(mKey) ?? 0) + (dailyPurchaseValueByDate.get(date) ?? 0),
      );
      const om = dailyPokerOperatingMinutesByDate.get(date);
      if (om !== undefined) {
        const list = monthlyOperatingMinutesList.get(mKey) ?? [];
        list.push(om);
        monthlyOperatingMinutesList.set(mKey, list);
      }
    }
  }

  const monthlyVisitorSet = new Map<string, Set<string>>();
  const monthlyNewVisitCount = new Map<string, number>();
  for (const v of visits) {
    const date = businessDateKey(v.checked_in_at);
    const mKey = date.slice(0, 7);
    const set = monthlyVisitorSet.get(mKey) ?? new Set<string>();
    set.add(v.customer_id);
    monthlyVisitorSet.set(mKey, set);
    if (firstVisitDateByCustomer.get(v.customer_id) === date) {
      monthlyNewVisitCount.set(mKey, (monthlyNewVisitCount.get(mKey) ?? 0) + 1);
    }
  }

  const monthlyNewCustomerCount = new Map<string, number>();
  for (const c of customers) {
    const mKey = businessDateKey(c.created_at).slice(0, 7);
    monthlyNewCustomerCount.set(mKey, (monthlyNewCustomerCount.get(mKey) ?? 0) + 1);
  }

  // 月が1つしかない場合はタップしても同じ数字が出るだけなので、内訳自体を出さない。
  const monthlyBreakdown = <T,>(rows: T[]): T[] | undefined =>
    monthlyKeys.length > 1 ? rows : undefined;

  const visitCountBreakdown: StatBreakdownRow[] = monthlyKeys.map((k) => ({
    label: monthLabelOf(k),
    value: `${(monthlyVisitCount.get(k) ?? 0).toLocaleString()}人`,
  }));
  const uniqueVisitorBreakdown: StatBreakdownRow[] = monthlyKeys.map((k) => ({
    label: monthLabelOf(k),
    value: `${(monthlyVisitorSet.get(k)?.size ?? 0).toLocaleString()}人`,
  }));
  const avgVisitsPerDayBreakdown: StatBreakdownRow[] = monthlyKeys.map((k) => {
    const total = monthlyVisitCount.get(k) ?? 0;
    const activeDays = monthlyActiveDayCount.get(k) ?? 0;
    const avg = activeDays > 0 ? total / activeDays : null;
    return { label: monthLabelOf(k), value: avg === null ? "-" : `${avg.toFixed(1)}人` };
  });
  const rakeBreakdown: StatBreakdownRow[] = monthlyKeys.map((k) => ({
    label: monthLabelOf(k),
    value: formatSigned(monthlyRake.get(k) ?? 0),
  }));
  const newVisitRateBreakdown: StatBreakdownRow[] = monthlyKeys.map((k) => {
    const total = monthlyVisitCount.get(k) ?? 0;
    const newCount = monthlyNewVisitCount.get(k) ?? 0;
    const rate = total > 0 ? newCount / total : null;
    return {
      label: monthLabelOf(k),
      value:
        rate === null
          ? "-"
          : `新規${Math.round(rate * 100)}% / 既存${Math.round((1 - rate) * 100)}%`,
    };
  });
  const avgSpendBreakdown: StatBreakdownRow[] = monthlyKeys.map((k) => {
    const visitCountInMonth = monthlyVisitCount.get(k) ?? 0;
    const purchaseValueInMonth = monthlyPurchaseValue.get(k) ?? 0;
    const avg = visitCountInMonth > 0 ? purchaseValueInMonth / visitCountInMonth : null;
    return {
      label: monthLabelOf(k),
      value: avg === null ? "-" : `${Math.round(avg).toLocaleString()}購入`,
    };
  });
  const avgOperatingMinutesBreakdown: StatBreakdownRow[] = monthlyKeys.map((k) => {
    const avg = average(monthlyOperatingMinutesList.get(k) ?? []);
    return { label: monthLabelOf(k), value: avg === null ? "-" : formatMinutes(Math.round(avg)) };
  });
  const newCustomerBreakdown: StatBreakdownRow[] = monthlyKeys.map((k) => ({
    label: monthLabelOf(k),
    value: `${(monthlyNewCustomerCount.get(k) ?? 0).toLocaleString()}人`,
  }));
  const repeatRateBreakdown: StatBreakdownRow[] = repeatBreakdown.map(({ min, count, rate }) => ({
    label: `${min}回以上`,
    value: rate === null ? "-" : `${Math.round(rate * 100)}%（${count}人）`,
  }));

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
        <ExpandableStatCard
          label={`来店数・延べ（${viewMode === "month" ? "月合計" : "全期間合計"}）`}
          value={`${totalVisitCount.toLocaleString()}人`}
          caption="同じ客の再来店も1回ずつ数える"
          breakdown={monthlyBreakdown(visitCountBreakdown)}
        />
        <ExpandableStatCard
          label="来店客数（人数）"
          value={`${uniqueVisitorCount.toLocaleString()}人`}
          caption="同じ客の再来店はまとめて1人"
          breakdown={monthlyBreakdown(uniqueVisitorBreakdown)}
        />
        <ExpandableStatCard
          label="1日平均来店数"
          value={avgVisitsPerActiveDay === null ? "-" : `${avgVisitsPerActiveDay.toFixed(1)}人`}
          breakdown={monthlyBreakdown(avgVisitsPerDayBreakdown)}
        />
        <ExpandableStatCard
          label={`レーキ（${viewMode === "month" ? "月合計" : "全期間合計"}・店全体）`}
          value={<span className={signColorClass(totalRake)}>{formatSigned(totalRake)}</span>}
          breakdown={monthlyBreakdown(rakeBreakdown)}
        />
        <ExpandableStatCard
          label="リピート率（2回以上来店）"
          value={repeatRate === null ? "-" : `${Math.round(repeatRate * 100)}%`}
          breakdown={repeatRateBreakdown}
        />
        <ExpandableStatCard
          label="来店の内訳（新規/既存）"
          value={
            newVisitRate === null
              ? "-"
              : `新規${Math.round(newVisitRate * 100)}% / 既存${Math.round((1 - newVisitRate) * 100)}%`
          }
          caption={`${newVisitCount.toLocaleString()}件 / ${existingVisitCount.toLocaleString()}件`}
          breakdown={monthlyBreakdown(newVisitRateBreakdown)}
        />
        <ExpandableStatCard
          label="客単価（購入/来店）"
          value={
            avgSpendPerVisit === null
              ? "-"
              : `${Math.round(avgSpendPerVisit).toLocaleString()}購入`
          }
          breakdown={monthlyBreakdown(avgSpendBreakdown)}
        />
        <ExpandableStatCard
          label="ポーカー稼働時間（平均）"
          value={avgOperatingMinutes === null ? "-" : formatMinutes(Math.round(avgOperatingMinutes))}
          breakdown={monthlyBreakdown(avgOperatingMinutesBreakdown)}
        />
        <ExpandableStatCard
          label={viewMode === "month" ? "新規客数（今月登録）" : "客数（累計登録）"}
          value={`${newCustomerCount.toLocaleString()}人`}
          breakdown={monthlyBreakdown(newCustomerBreakdown)}
        />
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
