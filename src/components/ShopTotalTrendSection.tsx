"use client";

import { useState } from "react";
import { shiftMonthKey } from "@/lib/businessDay";
import { formatSigned, signColorClass } from "@/lib/statsFormat";

type ViewMode = "month" | "total";

export function ShopTotalTrendSection({
  dailyTotals,
  currentMonthKey,
}: {
  dailyTotals: { date: string; delta: number; total: number }[];
  currentMonthKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const displayedTotals =
    viewMode === "month"
      ? dailyTotals.filter((d) => d.date.slice(0, 7) === monthKey)
      : dailyTotals;

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">店全体の保有点数の推移</h2>
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

      {displayedTotals.length === 0 ? (
        <p className="text-sm text-gray-500">
          {viewMode === "month" ? `${monthLabel}の取引はまだありません。` : "まだ取引がありません。"}
        </p>
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
                    <th className="px-4 py-2 text-right font-medium">増減</th>
                    <th className="px-4 py-2 text-right font-medium">保有点数合計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...displayedTotals].reverse().map((d) => {
                    const [ty, tm, td] = d.date.split("-").map(Number);
                    return (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-left text-gray-900">
                          {ty}年{tm}月{td}日
                        </td>
                        <td className={`px-4 py-2 text-right ${signColorClass(d.delta)}`}>
                          {formatSigned(d.delta)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {d.total.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
