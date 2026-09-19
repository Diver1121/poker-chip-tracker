"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import { businessDateKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import type { Customer, TournamentEntry } from "@/lib/types";

const TOP_N = 10;

// 順位ごとの内部ポイント。1位3pt・2位2pt・3位1pt、4位以下は0pt。
function pointsForRank(rank: number): number {
  if (rank === 1) return 3;
  if (rank === 2) return 2;
  if (rank === 3) return 1;
  return 0;
}

type ViewMode = "month" | "total";

function medalLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}位`;
}

export function TournamentRankingSection({
  tournamentEntries,
  customers,
  currentMonthKey,
}: {
  tournamentEntries: TournamentEntry[];
  customers: Customer[];
  currentMonthKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  // 「トータル」は今日までではなく、トーナメント機能を使い始めてから記録された全エントリーを指す
  // （tournament_entriesテーブルはこの機能の追加以降にしかデータが存在しない）。
  const monthDays = new Set(daysInMonth(monthKey));
  const targetEntries =
    viewMode === "month"
      ? tournamentEntries.filter((e) => monthDays.has(businessDateKey(e.created_at)))
      : tournamentEntries;

  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  const ranksByCustomer = new Map<string, number[]>();
  for (const e of targetEntries) {
    if (!e.customer_id || e.rank === null) continue;
    const list = ranksByCustomer.get(e.customer_id) ?? [];
    list.push(e.rank);
    ranksByCustomer.set(e.customer_id, list);
  }

  const ranking = [...ranksByCustomer.entries()]
    .map(([customerId, ranks]) => ({
      customerId,
      entryCount: ranks.length,
      points: ranks.reduce((sum, r) => sum + pointsForRank(r), 0),
      firstCount: ranks.filter((r) => r === 1).length,
      secondCount: ranks.filter((r) => r === 2).length,
      thirdCount: ranks.filter((r) => r === 3).length,
    }))
    .filter((r) => r.points > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.firstCount - a.firstCount ||
        b.secondCount - a.secondCount ||
        b.thirdCount - a.thirdCount,
    )
    .slice(0, TOP_N)
    .map((r, i) => ({
      rank: i + 1,
      customerId: r.customerId,
      name: nameById.get(r.customerId) ?? "(削除済みの客)",
      entryCount: r.entryCount,
      points: r.points,
      firstCount: r.firstCount,
      secondCount: r.secondCount,
      thirdCount: r.thirdCount,
    }));

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">トーナメント成績ランキング</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            1位3pt・2位2pt・3位1ptの合計ポイントが多い順トップ{TOP_N}。
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
        <p className="text-sm text-gray-500">対象のエントリーがありません（入賞者がいません）。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium"></th>
                <th className="px-4 py-2 text-left font-medium">名前</th>
                <th className="px-4 py-2 text-right font-medium">ポイント</th>
                <th className="px-4 py-2 text-right font-medium">内訳</th>
                <th className="px-4 py-2 text-right font-medium">参加回数</th>
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
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{r.points}pt</td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    🥇{r.firstCount} 🥈{r.secondCount} 🥉{r.thirdCount}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">{r.entryCount}回</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
