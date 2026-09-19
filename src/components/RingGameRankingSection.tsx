"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import { computeRingGameNetByCustomer } from "@/lib/balances";
import { businessDateKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import { formatSigned } from "@/lib/statsFormat";
import type { ChipTransaction, Customer } from "@/lib/types";

const TOP_N = 10;

type ViewMode = "month" | "total";

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
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const monthDays = new Set(daysInMonth(monthKey));
  const targetTransactions =
    viewMode === "month"
      ? transactions.filter((tx) => monthDays.has(businessDateKey(tx.created_at)))
      : transactions;

  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  const netByCustomer = computeRingGameNetByCustomer(targetTransactions);

  const ranking = [...netByCustomer.entries()]
    .filter(([, net]) => net > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([customerId, net], i) => ({
      rank: i + 1,
      customerId,
      name: nameById.get(customerId) ?? "(削除済みの客)",
      net,
    }));

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">リングゲーム収支ランキング</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ポーカーのバイイン・アウト収支（アウト − バイイン）がプラスの客、多い順トップ{TOP_N}
            。トーナメント使用分・ブラックジャックは含みません。
          </p>
        </div>
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

      {ranking.length === 0 ? (
        <p className="text-sm text-gray-500">記録がありません。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
            <thead className="bg-gray-50 text-gray-500">
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
                  <td className="px-4 py-2 text-right font-bold text-blue-600">
                    {formatSigned(r.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
