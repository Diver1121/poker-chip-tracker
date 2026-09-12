"use client";

import { useState } from "react";
import {
  computeDailyPurchaseQuantityTotals,
  computePurchaseTotalsByDenomination,
} from "@/lib/balances";
import { businessDateKey, shiftMonthKey } from "@/lib/businessDay";
import type { ChipTransaction, Denomination } from "@/lib/types";

type ViewMode = "month" | "total";

export function PurchaseBreakdownSection({
  transactions,
  denominations,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  denominations: Denomination[];
  currentMonthKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const scopedTransactions =
    viewMode === "month"
      ? transactions.filter((tx) => businessDateKey(tx.created_at).slice(0, 7) === monthKey)
      : transactions;

  const purchaseTotalsByDenomination = computePurchaseTotalsByDenomination(scopedTransactions);
  const scopedQuantityTotal = [...purchaseTotalsByDenomination.values()].reduce(
    (sum, v) => sum + v.quantity,
    0,
  );
  const purchaseTableData = denominations
    .map((d) => {
      const totals = purchaseTotalsByDenomination.get(d.id) ?? { count: 0, quantity: 0 };
      return {
        denominationId: d.id,
        label: d.label,
        count: totals.count,
        quantity: totals.quantity,
        rate: scopedQuantityTotal > 0 ? totals.quantity / scopedQuantityTotal : 0,
      };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.quantity - a.quantity);
  const scopedCountTotal = purchaseTableData.reduce((sum, d) => sum + d.count, 0);

  // 月平均・1日平均は表示中の絞り込み（月/トータル）に関わらず、常に全期間の実績を
  // 基準値として見せる（比較対象がないと平均だけ見ても意味が薄いため）。
  const dailyPurchaseQuantityByDate = computeDailyPurchaseQuantityTotals(transactions);
  const totalPurchaseQuantityAllTime = [...dailyPurchaseQuantityByDate.values()].reduce(
    (s, v) => s + v,
    0,
  );
  const purchaseActiveDayCount = dailyPurchaseQuantityByDate.size;
  const purchaseActiveMonthCount = new Set(
    [...dailyPurchaseQuantityByDate.keys()].map((d) => d.slice(0, 7)),
  ).size;
  const monthlyAvgPurchaseQuantity =
    purchaseActiveMonthCount > 0 ? totalPurchaseQuantityAllTime / purchaseActiveMonthCount : null;
  const dailyAvgPurchaseQuantity =
    purchaseActiveDayCount > 0 ? totalPurchaseQuantityAllTime / purchaseActiveDayCount : null;

  // 月ごとの1日平均。ペースが上がっているか下がっているかを月単位で見比べられるようにする。
  const monthlyPaceByMonth = new Map<string, { total: number; activeDays: number }>();
  for (const [date, quantity] of dailyPurchaseQuantityByDate) {
    const month = date.slice(0, 7);
    const current = monthlyPaceByMonth.get(month) ?? { total: 0, activeDays: 0 };
    current.total += quantity;
    current.activeDays += 1;
    monthlyPaceByMonth.set(month, current);
  }
  const monthlyPaceData = [...monthlyPaceByMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, { total, activeDays }]) => ({
      month,
      total,
      activeDays,
      dailyAvg: activeDays > 0 ? total / activeDays : 0,
    }));

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">購入内訳（額面別）</h2>
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

      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">
            {viewMode === "month" ? `${monthLabel}の合計` : "全期間の合計"}
          </p>
          <p className="text-lg font-bold text-gray-900">
            {scopedQuantityTotal.toLocaleString()}枚
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">月平均</p>
          <p className="text-lg font-bold text-gray-900">
            {monthlyAvgPurchaseQuantity === null
              ? "-"
              : `${Math.round(monthlyAvgPurchaseQuantity).toLocaleString()}枚`}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">1日平均</p>
          <p className="text-lg font-bold text-gray-900">
            {dailyAvgPurchaseQuantity === null
              ? "-"
              : `${Math.round(dailyAvgPurchaseQuantity).toLocaleString()}枚`}
          </p>
        </div>
      </div>

      {monthlyPaceData.length > 0 && (
        <details className="group mb-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            月別の1日平均を表示
          </summary>
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">月</th>
                  <th className="px-4 py-2 text-right font-medium">月合計</th>
                  <th className="px-4 py-2 text-right font-medium">購入日数</th>
                  <th className="px-4 py-2 text-right font-medium">1日平均</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyPaceData.map((m) => {
                  const [y, mm] = m.month.split("-");
                  return (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-left text-gray-900">
                        {y}年{Number(mm)}月
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {m.total.toLocaleString()}枚
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">{m.activeDays}日</td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {Math.round(m.dailyAvg).toLocaleString()}枚
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {purchaseTableData.length === 0 ? (
        <p className="text-sm text-gray-500">
          {viewMode === "month" ? `${monthLabel}の購入はまだありません。` : "購入はまだありません。"}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">額面</th>
                <th className="px-4 py-2 text-right font-medium">購入回数</th>
                <th className="px-4 py-2 text-right font-medium">購入枚数</th>
                <th className="px-4 py-2 text-right font-medium">割合</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchaseTableData.map((d) => (
                <tr key={d.denominationId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-left text-gray-900">{d.label}</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {d.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {d.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    {(d.rate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-bold">
                <td className="px-4 py-2 text-left text-gray-900">合計</td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {scopedCountTotal.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {scopedQuantityTotal.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-gray-500">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
