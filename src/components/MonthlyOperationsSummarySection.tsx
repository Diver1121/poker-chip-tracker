"use client";

import { useState } from "react";
import {
  computeDailyPokerOperatingMinutes,
  computeDailyPurchaseValueTotals,
  computeDailyRakeTotals,
  computeDailyTournamentCashOceanTotals,
  computeDailyVisitCounts,
  computeMonthlyCumulativeRatioSeries,
  computeMonthlyCumulativeSumSeries,
  computeMonthlyCumulativeUniqueVisitorSeries,
} from "@/lib/balances";
import { businessDateKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import { average, formatMinutes, formatSigned, percentChange, signColorClass } from "@/lib/statsFormat";
import type { ChipTransaction, Customer, Denomination, TournamentEntry, Visit } from "@/lib/types";
import { MonthlyPaceOverlayChart } from "@/components/MonthlyPaceOverlayChart";
import { MonthlyStackedBarChart } from "@/components/MonthlyStackedBarChart";
import { MonthlyTrendHeadline } from "@/components/MonthlyTrendHeadline";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 2026-07-12 21:53〜21:54(UTC)に、旧システムからの客データ移行で471人分の客が
// 来店なしで連続登録された（1件あたり1秒未満の間隔で471件連続という、通常の
// 来店時登録ではあり得ないパターン）。「新規客数」の集計からはこのバッチを除外する
// （実際に新しく来店して登録した客ではなく、移行作業によるノイズのため）。
const BULK_IMPORT_START_MS = new Date("2026-07-12T21:53:00Z").getTime();
const BULK_IMPORT_END_MS = new Date("2026-07-12T21:55:00Z").getTime();
function isBulkImportedCustomer(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  return t >= BULK_IMPORT_START_MS && t <= BULK_IMPORT_END_MS;
}

// リピート率の内訳セグメント。「1回」（リピートなし）〜「10回以上」まで、濃淡（薄→濃）で
// エンゲージメントの強さを表す1本の積み上げ棒として見せる（しきい値ごとに別々の棒を並べない）。
const REPEAT_SEGMENT_DEFS: { key: string; label: string; min: number; max: number; color: string }[] = [
  { key: "one", label: "1回", min: 1, max: 1, color: "#e0e7ff" },
  { key: "two_four", label: "2〜4回", min: 2, max: 4, color: "#a5b4fc" },
  { key: "five_nine", label: "5〜9回", min: 5, max: 9, color: "#6366f1" },
  { key: "ten_plus", label: "10回以上", min: 10, max: Infinity, color: "#4338ca" },
];

function repeatSegmentCounts(visitCountByCustomer: Map<string, number>): Record<string, number> {
  const values = [...visitCountByCustomer.values()];
  const counts: Record<string, number> = {};
  for (const def of REPEAT_SEGMENT_DEFS) {
    counts[def.key] = values.filter((n) => n >= def.min && n <= def.max).length;
  }
  return counts;
}

const NEW_EXISTING_SEGMENT_DEFS = [
  { key: "new", label: "新規", color: "#a5b4fc" },
  { key: "existing", label: "既存", color: "#4338ca" },
];

// 月初から各日までの累計系列から、「今日の時点での値」と「先月の同日時点との前月比」を取り出す。
// 積み上げ合計（来店数・レーキ等）にも、月初からの通算平均（客単価等）にもそのまま使える。
function paceHeadline(
  seriesMap: Map<string, number[]>,
  currentMonthKey: string,
  prevMonthKey: string,
  todayOfMonth: number,
  round: (v: number) => number = Math.round,
): { value: number; changePercent: number | null } {
  const currentArr = seriesMap.get(currentMonthKey) ?? [];
  const idx = Math.min(todayOfMonth, currentArr.length) - 1;
  const rawValue = idx >= 0 ? currentArr[idx] : 0;
  const prevArr = seriesMap.get(prevMonthKey) ?? [];
  const changePercent =
    todayOfMonth > 0 && prevArr.length >= todayOfMonth
      ? percentChange(rawValue, prevArr[todayOfMonth - 1])
      : null;
  return { value: round(rawValue), changePercent };
}

const roundToOneDecimal = (v: number) => Math.round(v * 10) / 10;

// 進行中の今月をまだ来ていない日まで0埋めで伸ばさないよう、今日の日数までに絞り込む
// （MonthlyPaceOverlayChart用。月末まで来ている過去月はそのまま全日を渡す）。
function toPaceSeries(
  seriesMap: Map<string, number[]>,
  monthKeys: string[],
  currentMonthKey: string,
  todayOfMonth: number,
): { monthKey: string; values: number[] }[] {
  return monthKeys.map((k) => {
    const values = seriesMap.get(k) ?? [];
    return { monthKey: k, values: k === currentMonthKey ? values.slice(0, todayOfMonth) : values };
  });
}

type ViewMode = "month" | "total";

type DayRow = {
  date: string;
  day: number;
  weekday: string;
  visitCount: number;
  rakeWithTournament: number;
  pokerRake: number;
  operatingMinutes: number | null;
  rakePerHour: number | null;
};

export function MonthlyOperationsSummarySection({
  transactions,
  visits,
  denominations,
  customers,
  tournamentEntries,
  lastClosedAt,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  visits: Visit[];
  denominations: Denomination[];
  customers: Customer[];
  tournamentEntries: TournamentEntry[];
  lastClosedAt: string | null;
  currentMonthKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [selectedMetricKey, setSelectedMetricKey] = useState("visitCount");

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
  const dailyTournamentCashOceanByDate = computeDailyTournamentCashOceanTotals(
    tournamentEntries,
    denominations,
  );
  // 客単価（OCEAN/来店）＝チップ購入点数＋トーナメント現金エントリー（OCEAN点数換算）の合計。
  // どちらか一方だけだと、トーナメントの現金エントリーが多い月に客単価が不当に低く出る。
  const dailyOceanByDate = new Map<string, number>();
  for (const [date, value] of dailyPurchaseValueByDate) {
    dailyOceanByDate.set(date, (dailyOceanByDate.get(date) ?? 0) + value);
  }
  for (const [date, value] of dailyTournamentCashOceanByDate) {
    dailyOceanByDate.set(date, (dailyOceanByDate.get(date) ?? 0) + value);
  }

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
    const pokerRake = finalized ? (daily?.pokerRake ?? 0) : 0;
    const operatingMinutes = finalized ? (dailyPokerOperatingMinutesByDate.get(date) ?? null) : null;
    return {
      date,
      day: rDay,
      weekday,
      visitCount: dailyVisitCountByDate.get(date) ?? 0,
      rakeWithTournament,
      pokerRake,
      operatingMinutes,
      rakePerHour:
        operatingMinutes && operatingMinutes > 0
          ? (rakeWithTournament / operatingMinutes) * 60
          : null,
    };
  });

  const totalVisitCount = rows.reduce((sum, d) => sum + d.visitCount, 0);
  const totalRake = rows.reduce((sum, d) => sum + d.rakeWithTournament, 0);
  const totalPokerRake = rows.reduce((sum, d) => sum + d.pokerRake, 0);
  const avgOperatingMinutes = average(
    rows.map((d) => d.operatingMinutes).filter((m): m is number => m !== null),
  );
  const avgRakePerHour = average(
    rows.map((d) => d.rakePerHour).filter((r): r is number => r !== null),
  );

  // 客ごとの初来店日（全期間で最も古い来店日）。月別の新規/既存集計で使う。
  const firstVisitDateByCustomer = new Map<string, string>();
  for (const v of visits) {
    const date = businessDateKey(v.checked_in_at);
    const current = firstVisitDateByCustomer.get(v.customer_id);
    if (current === undefined || date < current) firstVisitDateByCustomer.set(v.customer_id, date);
  }

  // 記録がある全月（新しい順）。グラフは古い→新しいの昇順で使う。
  const monthlyKeys = [...new Set(activeDates.map((d) => d.slice(0, 7)))].sort().reverse();
  const monthlyKeysAsc = [...monthlyKeys].reverse();
  const hasMultipleMonths = monthlyKeys.length > 1;

  const monthlyVisitCount = new Map<string, number>();
  for (const date of activeDates) {
    const mKey = date.slice(0, 7);
    monthlyVisitCount.set(mKey, (monthlyVisitCount.get(mKey) ?? 0) + (dailyVisitCountByDate.get(date) ?? 0));
  }

  const monthlyNewVisitCount = new Map<string, number>();
  // リピート率の月別内訳（積み上げ棒グラフ）用：月ごとの客ごとの来店回数
  const monthlyVisitCountByCustomer = new Map<string, Map<string, number>>();
  for (const v of visits) {
    const date = businessDateKey(v.checked_in_at);
    const mKey = date.slice(0, 7);
    if (firstVisitDateByCustomer.get(v.customer_id) === date) {
      monthlyNewVisitCount.set(mKey, (monthlyNewVisitCount.get(mKey) ?? 0) + 1);
    }
    const customerCounts = monthlyVisitCountByCustomer.get(mKey) ?? new Map<string, number>();
    customerCounts.set(v.customer_id, (customerCounts.get(v.customer_id) ?? 0) + 1);
    monthlyVisitCountByCustomer.set(mKey, customerCounts);
  }

  // 「新規客数」からは、旧システムからの客データ移行で一括登録された分を除く
  // （実際に来店して新しく登録した客ではなく、移行作業のノイズのため）。
  const organicCustomers = customers.filter((c) => !isBulkImportedCustomer(c.created_at));

  const repeatStackedData = monthlyKeysAsc.map((k) => {
    const customerCounts = monthlyVisitCountByCustomer.get(k) ?? new Map<string, number>();
    return { monthKey: k, total: customerCounts.size, counts: repeatSegmentCounts(customerCounts) };
  });
  const newExistingStackedData = monthlyKeysAsc.map((k) => {
    const total = monthlyVisitCount.get(k) ?? 0;
    const newCount = monthlyNewVisitCount.get(k) ?? 0;
    return { monthKey: k, total, counts: { new: newCount, existing: Math.max(0, total - newCount) } };
  });

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  const todayOfMonth = Number(todayKey.slice(8, 10));
  // 指標グラフの見出し（今月の値・前月比）は、下の日別テーブルの月送りとは独立に、
  // 常に「本当の今月」を基準にする（スクショのチップ購入グラフと同じ考え方）。
  const fixedPrevMonthKey = shiftMonthKey(currentMonthKey, -1);

  const dailyRakeTotalByDate = new Map(
    [...dailyRakeByDate.entries()].map(([date, d]) => [date, d.rakeWithTournament]),
  );
  const dailyPokerRakeTotalByDate = new Map(
    [...dailyRakeByDate.entries()].map(([date, d]) => [date, d.pokerRake]),
  );
  const dailyNewCustomerCountByDate = new Map<string, number>();
  for (const c of organicCustomers) {
    const date = businessDateKey(c.created_at);
    dailyNewCustomerCountByDate.set(date, (dailyNewCustomerCountByDate.get(date) ?? 0) + 1);
  }
  const dailyActiveDayFlagByDate = new Map([...dailyVisitCountByDate.keys()].map((d) => [d, 1]));
  const dailyOperatingMinutesFlagByDate = new Map(
    [...dailyPokerOperatingMinutesByDate.keys()].map((d) => [d, 1]),
  );

  // 指標ごとの「月初からの累計（または通算平均）」系列。ペース比較グラフと見出しの
  // 両方で使う（見出しは今日時点の値、グラフは月ごとに色分けした折れ線）。
  const visitCountSeries = computeMonthlyCumulativeSumSeries(dailyVisitCountByDate, monthlyKeysAsc);
  const uniqueVisitorSeries = computeMonthlyCumulativeUniqueVisitorSeries(visits, monthlyKeysAsc);
  const avgVisitsPerDaySeries = computeMonthlyCumulativeRatioSeries(
    dailyVisitCountByDate,
    dailyActiveDayFlagByDate,
    monthlyKeysAsc,
  );
  const rakeSeries = computeMonthlyCumulativeSumSeries(dailyRakeTotalByDate, monthlyKeysAsc);
  const pokerRakeSeries = computeMonthlyCumulativeSumSeries(dailyPokerRakeTotalByDate, monthlyKeysAsc);
  const avgSpendSeries = computeMonthlyCumulativeRatioSeries(
    dailyOceanByDate,
    dailyVisitCountByDate,
    monthlyKeysAsc,
  );
  const avgOperatingMinutesSeries = computeMonthlyCumulativeRatioSeries(
    dailyPokerOperatingMinutesByDate,
    dailyOperatingMinutesFlagByDate,
    monthlyKeysAsc,
  );
  const newCustomerSeries = computeMonthlyCumulativeSumSeries(dailyNewCustomerCountByDate, monthlyKeysAsc);

  // リピート率・新規/既存は「日ごとの累計」ではなく月単位の構成比なので、
  // 今月・先月それぞれの月合計からそのまま前月比を出す。
  const currentMonthVisitCountByCustomer =
    monthlyVisitCountByCustomer.get(currentMonthKey) ?? new Map<string, number>();
  const prevMonthVisitCountByCustomer =
    monthlyVisitCountByCustomer.get(fixedPrevMonthKey) ?? new Map<string, number>();
  const repeatRateOf = (map: Map<string, number>): number | null =>
    map.size > 0 ? [...map.values()].filter((n) => n >= 2).length / map.size : null;
  const currentMonthRepeatRate = repeatRateOf(currentMonthVisitCountByCustomer);
  const prevMonthRepeatRate = repeatRateOf(prevMonthVisitCountByCustomer);
  const repeatRateChangePercent =
    currentMonthRepeatRate !== null && prevMonthRepeatRate !== null
      ? percentChange(currentMonthRepeatRate, prevMonthRepeatRate)
      : null;

  const newRateOf = (monthKeyToUse: string): number | null => {
    const total = monthlyVisitCount.get(monthKeyToUse) ?? 0;
    const newCount = monthlyNewVisitCount.get(monthKeyToUse) ?? 0;
    return total > 0 ? newCount / total : null;
  };
  const currentMonthNewRate = newRateOf(currentMonthKey);
  const prevMonthNewRate = newRateOf(fixedPrevMonthKey);
  const newRateChangePercent =
    currentMonthNewRate !== null && prevMonthNewRate !== null
      ? percentChange(currentMonthNewRate, prevMonthNewRate)
      : null;

  const metrics = [
    {
      key: "visitCount",
      label: "来店数",
      unit: "人",
      ...paceHeadline(visitCountSeries, currentMonthKey, fixedPrevMonthKey, todayOfMonth),
      render: () => (
        <MonthlyPaceOverlayChart
          series={toPaceSeries(visitCountSeries, monthlyKeysAsc, currentMonthKey, todayOfMonth)}
          unit="人"
        />
      ),
    },
    {
      key: "uniqueVisitor",
      label: "来店客数",
      unit: "人",
      ...paceHeadline(uniqueVisitorSeries, currentMonthKey, fixedPrevMonthKey, todayOfMonth),
      render: () => (
        <MonthlyPaceOverlayChart
          series={toPaceSeries(uniqueVisitorSeries, monthlyKeysAsc, currentMonthKey, todayOfMonth)}
          unit="人"
        />
      ),
    },
    {
      key: "avgVisitsPerDay",
      label: "1日平均来店数",
      unit: "人",
      ...paceHeadline(avgVisitsPerDaySeries, currentMonthKey, fixedPrevMonthKey, todayOfMonth, roundToOneDecimal),
      render: () => (
        <MonthlyPaceOverlayChart
          series={toPaceSeries(avgVisitsPerDaySeries, monthlyKeysAsc, currentMonthKey, todayOfMonth)}
          unit="人"
        />
      ),
    },
    {
      key: "rake",
      label: "レーキ",
      unit: "点",
      ...paceHeadline(rakeSeries, currentMonthKey, fixedPrevMonthKey, todayOfMonth),
      render: () => (
        <MonthlyPaceOverlayChart
          series={toPaceSeries(rakeSeries, monthlyKeysAsc, currentMonthKey, todayOfMonth)}
          unit="点"
        />
      ),
    },
    {
      key: "repeatRate",
      label: "リピート率",
      unit: "%",
      value: currentMonthRepeatRate === null ? 0 : Math.round(currentMonthRepeatRate * 100),
      changePercent: repeatRateChangePercent,
      render: () => <MonthlyStackedBarChart data={repeatStackedData} segmentDefs={REPEAT_SEGMENT_DEFS} />,
    },
    {
      key: "newExisting",
      label: "新規/既存",
      unit: "%（新規）",
      value: currentMonthNewRate === null ? 0 : Math.round(currentMonthNewRate * 100),
      changePercent: newRateChangePercent,
      render: () => (
        <MonthlyStackedBarChart data={newExistingStackedData} segmentDefs={NEW_EXISTING_SEGMENT_DEFS} />
      ),
    },
    {
      key: "avgSpend",
      label: "客単価（OCEAN）",
      unit: "OCEAN",
      ...paceHeadline(avgSpendSeries, currentMonthKey, fixedPrevMonthKey, todayOfMonth),
      render: () => (
        <MonthlyPaceOverlayChart
          series={toPaceSeries(avgSpendSeries, monthlyKeysAsc, currentMonthKey, todayOfMonth)}
          unit="OCEAN"
        />
      ),
    },
    {
      key: "avgOperatingMinutes",
      label: "稼働時間（平均）",
      unit: "分",
      ...paceHeadline(avgOperatingMinutesSeries, currentMonthKey, fixedPrevMonthKey, todayOfMonth),
      render: () => (
        <MonthlyPaceOverlayChart
          series={toPaceSeries(avgOperatingMinutesSeries, monthlyKeysAsc, currentMonthKey, todayOfMonth)}
          unit="分"
        />
      ),
    },
    {
      key: "newCustomer",
      label: "新規客数",
      unit: "人",
      ...paceHeadline(newCustomerSeries, currentMonthKey, fixedPrevMonthKey, todayOfMonth),
      render: () => (
        <MonthlyPaceOverlayChart
          series={toPaceSeries(newCustomerSeries, monthlyKeysAsc, currentMonthKey, todayOfMonth)}
          unit="人"
        />
      ),
    },
    {
      key: "pokerRake",
      label: "ポーカーのレーキ",
      unit: "点",
      ...paceHeadline(pokerRakeSeries, currentMonthKey, fixedPrevMonthKey, todayOfMonth),
      render: () => (
        <MonthlyPaceOverlayChart
          series={toPaceSeries(pokerRakeSeries, monthlyKeysAsc, currentMonthKey, todayOfMonth)}
          unit="点"
        />
      ),
    },
  ];

  const selectedMetric = metrics.find((m) => m.key === selectedMetricKey) ?? metrics[0];
  const [selYear, selNum] = currentMonthKey.split("-");
  const selectedMonthLabel = `${selYear}年${Number(selNum)}月`;

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-gray-900">月次運営サマリー</h2>
      <p className="mb-3 text-xs text-gray-500">
        本日分は「営業終了・まとめて退店」を押すまで反映されません。
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setSelectedMetricKey(m.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedMetricKey === m.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {hasMultipleMonths ? (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <MonthlyTrendHeadline
              monthLabel={`${selectedMonthLabel}の${selectedMetric.label}`}
              value={selectedMetric.value}
              unit={selectedMetric.unit}
              changePercent={selectedMetric.changePercent}
              changeNote={`前月同日比（${todayOfMonth}日まで）`}
            />
            {selectedMetricKey === "avgSpend" && (
              <p className="mt-1 text-xs text-gray-500">
                チップ購入点数＋トーナメント現金エントリー（OCEAN点数換算）÷来店数です。
              </p>
            )}
          </div>
          {selectedMetric.render()}
        </div>
      ) : (
        <p className="mb-6 text-sm text-gray-500">記録が揃うとここに月別の推移グラフが表示されます。</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
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
                    <th className="px-4 py-2 text-right font-medium">ポーカー</th>
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
                        <td className={`px-4 py-2 text-right ${signColorClass(d.pokerRake)}`}>
                          {formatSigned(d.pokerRake)}
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
                    <td className={`px-4 py-2 text-right ${signColorClass(totalPokerRake)}`}>
                      {formatSigned(totalPokerRake)}
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
