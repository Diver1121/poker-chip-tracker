"use client";

import { useState } from "react";
import {
  computeDailyPurchaseValueTotals,
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
  const dailyPurchaseValueByDate = computeDailyPurchaseValueTotals(transactions, denominations);
  const totalPurchaseValue = [...dailyPurchaseValueByDate.values()].reduce((s, v) => s + v, 0);
  const purchaseActiveDayCount = dailyPurchaseValueByDate.size;
  const purchaseActiveMonthCount = new Set(
    [...dailyPurchaseValueByDate.keys()].map((d) => d.slice(0, 7)),
  ).size;
  const monthlyAvgPurchaseValue =
    purchaseActiveMonthCount > 0 ? totalPurchaseValue / purchaseActiveMonthCount : null;
  const dailyAvgPurchaseValue =
    purchaseActiveDayCount > 0 ? totalPurchaseValue / purchaseActiveDayCount : null;

  const scopedValueTotal = [...dailyPurchaseValueByDate.entries()]
    .filter(([date]) => viewMode === "total" || date.slice(0, 7) === monthKey)
    .reduce((sum, [, v]) => sum + v, 0);

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
            {scopedValueTotal.toLocaleString()}購入
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">月平均</p>
          <p className="text-lg font-bold text-gray-900">
            {monthlyAvgPurchaseValue === null
              ? "-"
              : `${Math.round(monthlyAvgPurchaseValue).toLocaleString()}購入`}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">1日平均</p>
          <p className="text-lg font-bold text-gray-900">
            {dailyAvgPurchaseValue === null
              ? "-"
              : `${Math.round(dailyAvgPurchaseValue).toLocaleString()}購入`}
          </p>
        </div>
      </div>

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
