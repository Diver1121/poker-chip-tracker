"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import { computeRingGameNetByCustomer } from "@/lib/balances";
import {
  businessDateKey,
  businessWeekKey,
  businessYearKey,
  daysInMonth,
  daysInWeek,
  shiftDayKey,
  shiftMonthKey,
  shiftWeekKey,
  shiftYearKey,
} from "@/lib/businessDay";
import { formatSigned, signColorClass } from "@/lib/statsFormat";
import type { ChipTransaction, Customer } from "@/lib/types";

type ViewMode = "day" | "week" | "month" | "year" | "total";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: "日",
  week: "週",
  month: "月",
  year: "年",
  total: "トータル",
};

function medalLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}位`;
}

export function RingGameRankingSection({
  transactions,
  customers,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  customers: Customer[];
  currentMonthKey: string;
}) {
  const now = new Date();
  const todayKey = businessDateKey(now);

  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [dayKey, setDayKey] = useState(todayKey);
  const [weekKey, setWeekKey] = useState(businessWeekKey(now));
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [yearKey, setYearKey] = useState(businessYearKey(now));

  let targetTransactions: ChipTransaction[];
  if (viewMode === "day") {
    targetTransactions = transactions.filter(
      (tx) => businessDateKey(tx.created_at) === dayKey,
    );
  } else if (viewMode === "week") {
    const weekDays = new Set(daysInWeek(weekKey));
    targetTransactions = transactions.filter((tx) =>
      weekDays.has(businessDateKey(tx.created_at)),
    );
  } else if (viewMode === "month") {
    const monthDays = new Set(daysInMonth(monthKey));
    targetTransactions = transactions.filter((tx) =>
      monthDays.has(businessDateKey(tx.created_at)),
    );
  } else if (viewMode === "year") {
    targetTransactions = transactions.filter(
      (tx) => businessYearKey(tx.created_at) === yearKey,
    );
  } else {
    targetTransactions = transactions;
  }

  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  const netByCustomer = computeRingGameNetByCustomer(targetTransactions);

  // マイナス収支の客も含めて、実際にプレイした客全員を出す（上位10人などに絞らない）
  // （店として全員の状況を把握するため。SNS投稿用にプラスの客だけ見せたい場合は
  // このランキングから該当者を選んで別途使う）。
  const ranking = [...netByCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([customerId, net], i) => ({
      rank: i + 1,
      customerId,
      name: nameById.get(customerId) ?? "(削除済みの客)",
      net,
    }));

  const [dayYear, dayMonth, dayDay] = dayKey.split("-").map(Number);
  const dayLabel = `${dayYear}年${dayMonth}月${dayDay}日`;
  const canGoNextDay = shiftDayKey(dayKey, 1) <= todayKey;

  const weekEndKey = shiftDayKey(weekKey, 6);
  const [, weekStartMonth, weekStartDay] = weekKey.split("-").map(Number);
  const [, weekEndMonth, weekEndDay] = weekEndKey.split("-").map(Number);
  const weekLabel = `${weekStartMonth}/${weekStartDay}〜${weekEndMonth}/${weekEndDay}`;
  const canGoNextWeek = shiftWeekKey(weekKey, 1) <= businessWeekKey(now);

  const [monthYearPart, monthNumPart] = monthKey.split("-");
  const monthLabel = `${monthYearPart}年${Number(monthNumPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  const yearLabel = `${yearKey}年`;
  const canGoNextYear = shiftYearKey(yearKey, 1) <= businessYearKey(now);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">リングゲーム収支ランキング</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ポーカーのバイイン・アウト収支（アウト − バイイン）の多い順に全員表示。
            マイナス収支の客も含みます。トーナメント使用分・ブラックジャックは含みません。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex gap-1 rounded-md border border-gray-300 p-0.5">
            {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded px-2 py-1 font-medium ${
                  viewMode === mode
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {VIEW_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          {viewMode === "day" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDayKey((k) => shiftDayKey(k, -1))}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                ← 前日
              </button>
              <span className="font-medium text-gray-900">{dayLabel}</span>
              <button
                type="button"
                onClick={() => setDayKey((k) => shiftDayKey(k, 1))}
                disabled={!canGoNextDay}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                翌日 →
              </button>
            </div>
          )}
          {viewMode === "week" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekKey((k) => shiftWeekKey(k, -1))}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                ← 前週
              </button>
              <span className="font-medium text-gray-900">{weekLabel}</span>
              <button
                type="button"
                onClick={() => setWeekKey((k) => shiftWeekKey(k, 1))}
                disabled={!canGoNextWeek}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                翌週 →
              </button>
            </div>
          )}
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
          {viewMode === "year" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setYearKey((k) => shiftYearKey(k, -1))}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                ← 前年
              </button>
              <span className="font-medium text-gray-900">{yearLabel}</span>
              <button
                type="button"
                onClick={() => setYearKey((k) => shiftYearKey(k, 1))}
                disabled={!canGoNextYear}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                翌年 →
              </button>
            </div>
          )}
        </div>
      </div>

      {ranking.length === 0 ? (
        <p className="text-sm text-gray-500">記録がありません。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium"></th>
                  <th className="px-4 py-2 text-left font-medium">名前</th>
                  <th className="px-4 py-2 text-right font-medium">収支</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ranking.map((r) => (
                  <tr key={r.rank} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-left text-gray-900">{medalLabel(r.rank)}</td>
                    <td className="px-4 py-2 text-left">
                      <Link
                        href={`/customers/${r.customerId}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {r.name}
                        <LinkPendingDot />
                      </Link>
                    </td>
                    <td className={`px-4 py-2 text-right font-bold ${signColorClass(r.net)}`}>
                      {formatSigned(r.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
