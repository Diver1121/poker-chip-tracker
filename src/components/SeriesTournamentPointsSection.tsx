"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import { businessDateKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import type { Customer, TournamentEntry } from "@/lib/types";

const TOP_N = 10;

// シリーズ用の店イベントでは、エントリー数が多いほどポイント対象の順位も広げる。
// 7エントリーごとに対象枠が1つ増える仕組み: 27エントリーまでは3枠(1位3pt・2位2pt・3位1pt)、
// 28エントリーで4枠(1位4pt〜4位1pt)に切り替わり、以降35・42…と7刻みでさらに1枠ずつ増える。
function paidSpotsForEntryCount(entryCount: number): number {
  return 3 + Math.max(0, Math.floor((entryCount - 21) / 7));
}

function seriesPointsForRank(rank: number, entryCount: number): number {
  // rank=0は「順位未確定」の名残データ（古いトーナメント機能の一部で使われていた）。
  // 1位以上の実在する順位のみポイント対象にする。
  if (rank < 1) return 0;
  const spots = paidSpotsForEntryCount(entryCount);
  return rank <= spots ? spots - rank + 1 : 0;
}

// シリーズの開始日。この日より前のトーナメントエントリーは、シリーズ開始前の
// 通常営業分なので集計対象に含めない（トーナメント成績ランキングとあえて表を
// 分けたのは、この開始日を境に区切って集計するため）。
const SERIES_START_DATE = "2026-09-25";

type ViewMode = "month" | "total";

function medalLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}位`;
}

export function SeriesTournamentPointsSection({
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

  // シリーズ開始日より前のエントリーはそもそも対象外。
  const seriesEntries = tournamentEntries.filter(
    (e) => businessDateKey(e.created_at) >= SERIES_START_DATE,
  );

  // 「トータル」はシリーズ開始日から今日までの全エントリーを指す。
  const monthDays = new Set(daysInMonth(monthKey));
  const targetEntries =
    viewMode === "month"
      ? seriesEntries.filter((e) => monthDays.has(businessDateKey(e.created_at)))
      : seriesEntries;

  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  // トーナメント（tournament_id）ごとの実際のエントリー数。月で絞り込んでいても、
  // 支払い枠の判定はそのトーナメント全体の参加人数で行う（月をまたいでいても変わらない）。
  const entryCountByTournament = new Map<string, number>();
  for (const e of seriesEntries) {
    if (!e.tournament_id) continue;
    entryCountByTournament.set(
      e.tournament_id,
      (entryCountByTournament.get(e.tournament_id) ?? 0) + 1,
    );
  }

  const pointsByCustomer = new Map<string, { points: number; cashCount: number }>();
  for (const e of targetEntries) {
    if (!e.customer_id || e.rank === null || !e.tournament_id) continue;
    const entryCount = entryCountByTournament.get(e.tournament_id) ?? 0;
    const points = seriesPointsForRank(e.rank, entryCount);
    if (points <= 0) continue;
    const current = pointsByCustomer.get(e.customer_id) ?? { points: 0, cashCount: 0 };
    current.points += points;
    current.cashCount += 1;
    pointsByCustomer.set(e.customer_id, current);
  }

  const ranking = [...pointsByCustomer.entries()]
    .map(([customerId, { points, cashCount }]) => ({ customerId, points, cashCount }))
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_N)
    .map((r, i) => ({
      rank: i + 1,
      customerId: r.customerId,
      name: nameById.get(r.customerId) ?? "(削除済みの客)",
      points: r.points,
      cashCount: r.cashCount,
    }));

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;
  const [seriesStartYear, seriesStartMonth, seriesStartDay] = SERIES_START_DATE.split("-").map(Number);
  const seriesStartLabel = `${seriesStartYear}年${seriesStartMonth}月${seriesStartDay}日`;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">シリーズトーナメントポイント</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {seriesStartLabel}開始のシリーズイベント用のポイント（それより前のトーナメントは
            対象外）。エントリー数が多いほどポイント対象の順位が広がる（7エントリーごとに対象枠+1）。
            27エントリーまでは1位3pt・2位2pt・3位1pt、28エントリーで1位4pt〜4位1ptに切り替わり、
            以降35・42…エントリーごとにさらに広がる。
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
                <th className="px-4 py-2 text-right font-medium">入賞回数</th>
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
                  <td className="px-4 py-2 text-right text-gray-500">{r.cashCount}回</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
