"use client";

import { useState } from "react";
import {
  computeDailyPurchaseValueTotals,
  computePurchaseTotalsByDenomination,
} from "@/lib/balances";
import { businessDateKey, shiftMonthKey } from "@/lib/businessDay";
import { monthLabelOf } from "@/lib/statsFormat";
import type { ChipTransaction, Denomination } from "@/lib/types";
import { ExpandableStatCard, type StatBreakdownRow } from "@/components/ExpandableStatCard";

export function PurchaseBreakdownSection({
  transactions,
  denominations,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  denominations: Denomination[];
  currentMonthKey: string;
}) {
  // 額面ごとの内訳表は常に全期間を対象にする（月で絞ると、たまにしか
  // 買われない額面が0件の月では消えて見えてしまうため）。
  const purchaseTotalsByDenomination = computePurchaseTotalsByDenomination(transactions);
  const totalQuantityAllTime = [...purchaseTotalsByDenomination.values()].reduce(
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
        rate: totalQuantityAllTime > 0 ? totals.quantity / totalQuantityAllTime : 0,
        value: d.value,
        // 購入回数×額面の点数（例: 300購入が101回なら30,300点）。行内バーの元データ。
        points: totals.count * d.value,
      };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.quantity - a.quantity);
  const totalCountAllTime = purchaseTableData.reduce((sum, d) => sum + d.count, 0);

  // 点数換算した購入総量（額面が違うと枚数だけでは売上量を比較できないため）。
  // 全期間の合計・1日平均に加えて、月を選んで「その月の合計・1日平均」も
  // 同時に一目で見られるようにする。
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [tableViewMode, setTableViewMode] = useState<"month" | "total">("month");
  const dailyPurchaseValueByDate = computeDailyPurchaseValueTotals(transactions, denominations);
  const totalPurchaseValueAllTime = [...dailyPurchaseValueByDate.values()].reduce(
    (s, v) => s + v,
    0,
  );
  const activeDayCountAllTime = dailyPurchaseValueByDate.size;
  const dailyAvgPurchaseValueAllTime =
    activeDayCountAllTime > 0 ? totalPurchaseValueAllTime / activeDayCountAllTime : null;

  // 「全期間」の2枚のカードは、タップすると月別の内訳が見られるようにする。
  const monthlyKeys = [
    ...new Set([...dailyPurchaseValueByDate.keys()].map((date) => date.slice(0, 7))),
  ]
    .sort()
    .reverse();
  const monthlyPurchaseTotal = new Map<string, number>();
  const monthlyActiveDayCount = new Map<string, number>();
  for (const [date, value] of dailyPurchaseValueByDate) {
    const mKey = date.slice(0, 7);
    monthlyPurchaseTotal.set(mKey, (monthlyPurchaseTotal.get(mKey) ?? 0) + value);
    monthlyActiveDayCount.set(mKey, (monthlyActiveDayCount.get(mKey) ?? 0) + 1);
  }
  const purchaseTotalBreakdown: StatBreakdownRow[] | undefined =
    monthlyKeys.length > 1
      ? monthlyKeys.map((k) => ({
          label: monthLabelOf(k),
          value: `${(monthlyPurchaseTotal.get(k) ?? 0).toLocaleString()}購入`,
        }))
      : undefined;
  const purchaseAvgBreakdown: StatBreakdownRow[] | undefined =
    monthlyKeys.length > 1
      ? monthlyKeys.map((k) => {
          const total = monthlyPurchaseTotal.get(k) ?? 0;
          const days = monthlyActiveDayCount.get(k) ?? 0;
          const avg = days > 0 ? total / days : null;
          return {
            label: monthLabelOf(k),
            value: avg === null ? "-" : `${Math.round(avg).toLocaleString()}購入`,
          };
        })
      : undefined;

  const monthEntries = [...dailyPurchaseValueByDate.entries()].filter(
    ([date]) => date.slice(0, 7) === monthKey,
  );
  const totalPurchaseValueForMonth = monthEntries.reduce((sum, [, v]) => sum + v, 0);
  const activeDayCountForMonth = monthEntries.length;
  const dailyAvgPurchaseValueForMonth =
    activeDayCountForMonth > 0 ? totalPurchaseValueForMonth / activeDayCountForMonth : null;

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  // 選択中の月だけの額面別内訳。全期間の内訳表とは別に、月ごとの傾向も見られるようにする。
  const monthTransactions = transactions.filter(
    (tx) => businessDateKey(tx.created_at).slice(0, 7) === monthKey,
  );
  const purchaseTotalsByDenominationForMonth = computePurchaseTotalsByDenomination(monthTransactions);
  const totalQuantityForMonth = [...purchaseTotalsByDenominationForMonth.values()].reduce(
    (sum, v) => sum + v.quantity,
    0,
  );
  const monthPurchaseTableData = denominations
    .map((d) => {
      const totals = purchaseTotalsByDenominationForMonth.get(d.id) ?? { count: 0, quantity: 0 };
      return {
        denominationId: d.id,
        label: d.label,
        count: totals.count,
        quantity: totals.quantity,
        rate: totalQuantityForMonth > 0 ? totals.quantity / totalQuantityForMonth : 0,
        value: d.value,
        points: totals.count * d.value,
      };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.quantity - a.quantity);
  const totalCountForMonth = monthPurchaseTableData.reduce((sum, d) => sum + d.count, 0);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">購入内訳（額面別）</h2>
        <div className="flex items-center gap-2 text-sm">
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
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <ExpandableStatCard
          label="全期間の購入数"
          value={`${totalPurchaseValueAllTime.toLocaleString()}購入`}
          breakdown={purchaseTotalBreakdown}
        />
        <ExpandableStatCard
          label="全期間の1日平均"
          value={
            dailyAvgPurchaseValueAllTime === null
              ? "-"
              : `${Math.round(dailyAvgPurchaseValueAllTime).toLocaleString()}購入`
          }
          breakdown={purchaseAvgBreakdown}
        />
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{monthLabel}の購入数</p>
          <p className="text-lg font-bold text-gray-900">
            {totalPurchaseValueForMonth.toLocaleString()}購入
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">{monthLabel}の1日平均</p>
          <p className="text-lg font-bold text-gray-900">
            {dailyAvgPurchaseValueForMonth === null
              ? "-"
              : `${Math.round(dailyAvgPurchaseValueForMonth).toLocaleString()}購入`}
          </p>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">
          {tableViewMode === "month" ? `${monthLabel}の内訳（額面別）` : "全期間の内訳（額面別）"}
        </h3>
        <div className="flex gap-1 rounded-md border border-gray-300 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setTableViewMode("month")}
            className={`rounded px-2 py-1 font-medium ${
              tableViewMode === "month"
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            月
          </button>
          <button
            type="button"
            onClick={() => setTableViewMode("total")}
            className={`rounded px-2 py-1 font-medium ${
              tableViewMode === "total"
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            トータル
          </button>
        </div>
      </div>
      {(() => {
        const activeTableData =
          tableViewMode === "month" ? monthPurchaseTableData : purchaseTableData;
        const activeTotalCount = tableViewMode === "month" ? totalCountForMonth : totalCountAllTime;
        if (activeTableData.length === 0) {
          return (
            <p className="text-sm text-gray-500">
              {tableViewMode === "month" ? `${monthLabel}の購入はまだありません。` : "購入はまだありません。"}
            </p>
          );
        }
        // 行の背景バー（購入回数×額面の点数を、表内で最大の額面を100%とした横棒として重ねる）。
        // 割合(%)は枚数ベースだが、こちらは「結局チップとして何点分売れたか」の量感を一目で見せる。
        const maxPoints = Math.max(1, ...activeTableData.map((d) => d.points));
        const totalPoints = activeTableData.reduce((sum, d) => sum + d.points, 0);
        return (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">額面</th>
                  <th className="px-4 py-2 text-right font-medium">購入回数</th>
                  <th className="px-4 py-2 text-right font-medium">割合</th>
                  <th className="px-4 py-2 text-right font-medium">トータル</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeTableData.map((d) => {
                  const barPct = (d.points / maxPoints) * 100;
                  return (
                    <tr
                      key={d.denominationId}
                      className="transition-[filter] hover:brightness-95"
                      style={{
                        background: `linear-gradient(to right, rgba(99,102,241,0.16) ${barPct}%, transparent ${barPct}%)`,
                      }}
                      title={`${d.label}: ${d.count.toLocaleString()}回 × ${d.value.toLocaleString()} = ${d.points.toLocaleString()}点`}
                    >
                      <td className="px-4 py-2 text-left text-gray-900">{d.label}</td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {d.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {(d.rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {d.points.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-bold">
                  <td className="px-4 py-2 text-left text-gray-900">合計</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {activeTotalCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">100.0%</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {totalPoints.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}
    </section>
  );
}
