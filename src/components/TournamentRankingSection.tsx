"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import {
  businessDateKey,
  businessWeekKey,
  daysInMonth,
  daysInWeek,
  shiftDayKey,
  shiftMonthKey,
  shiftWeekKey,
} from "@/lib/businessDay";
import type { Customer, TournamentEntry } from "@/lib/types";

const TOP_N = 10;

// インスタ投稿用プロンプトに載せる人数。リングゲーム収支ランキングと同様、
// 上位3名（金銀銅）だけに絞ることで「選ばれた3人」としての価値を出す
// （アプリ内の表自体はトップ10表示のまま）。
const SHARE_TOP_N = 3;

// 順位ごとの内部ポイント。1位3pt・2位2pt・3位1pt、4位以下は0pt。
function pointsForRank(rank: number): number {
  if (rank === 1) return 3;
  if (rank === 2) return 2;
  if (rank === 3) return 1;
  return 0;
}

type ViewMode = "day" | "week" | "month" | "custom" | "total";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: "日",
  week: "週",
  month: "月",
  custom: "期間指定",
  total: "トータル",
};

function medalLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}位`;
}

// "YYYY-MM-DD" -> "YYYY/M/D"（期間指定の表示・共有プロンプト用）
function formatDateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

// インスタのストーリー画像を作ってもらうためのAI向けプロンプト文。
// リングゲーム収支ランキングのものと同じ仕様（デザイン指定・文言）で、
// 中身だけトーナメント成績に差し替えている。
function buildInstagramPrompt(
  periodLabel: string,
  topRanking: { rank: number; name: string; points: number }[],
): string {
  const lines = topRanking
    .map((r) => `${r.rank}位 ${r.name} ${r.points}pt`)
    .join("\n");
  return [
    `OCEAN大分店 トーナメント成績ランキング（${periodLabel}）のインスタストーリー画像を作ってください。`,
    "",
    "【デザイン】",
    "・サイズ 1080×1920（インスタのストーリー用の縦長）",
    "・背景は黒と紫を基調にしたネオン風グラデーション",
    "・見出しに「OCEAN大分店」「TOURNAMENT 上位3名」",
    "・上位3名（1位ゴールド、2位シルバー、3位ブロンズ）を特別感のある大きめのカードで表示",
    "・文字は背景に対して見やすい配色（ネオングリーン）にする",
    "",
    "【この期間の成績ランキング】",
    lines,
    "",
    "このデータを上のデザインに当てはめて画像を作ってください。",
  ].join("\n");
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
  const now = new Date();
  const todayKey = businessDateKey(now);

  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [dayKey, setDayKey] = useState(todayKey);
  const [weekKey, setWeekKey] = useState(businessWeekKey(now));
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [customStartInput, setCustomStartInput] = useState(todayKey);
  const [customEndInput, setCustomEndInput] = useState(todayKey);
  const [customStart, setCustomStart] = useState(todayKey);
  const [customEnd, setCustomEnd] = useState(todayKey);
  const [shareStatus, setShareStatus] = useState<null | "copied" | "unsupported">(null);

  // 「トータル」は今日までではなく、トーナメント機能を使い始めてから記録された全エントリーを指す
  // （tournament_entriesテーブルはこの機能の追加以降にしかデータが存在しない）。
  let targetEntries: TournamentEntry[];
  if (viewMode === "day") {
    targetEntries = tournamentEntries.filter((e) => businessDateKey(e.created_at) === dayKey);
  } else if (viewMode === "week") {
    const weekDays = new Set(daysInWeek(weekKey));
    targetEntries = tournamentEntries.filter((e) => weekDays.has(businessDateKey(e.created_at)));
  } else if (viewMode === "month") {
    const monthDays = new Set(daysInMonth(monthKey));
    targetEntries = tournamentEntries.filter((e) => monthDays.has(businessDateKey(e.created_at)));
  } else if (viewMode === "custom") {
    targetEntries = tournamentEntries.filter((e) => {
      const d = businessDateKey(e.created_at);
      return d >= customStart && d <= customEnd;
    });
  } else {
    targetEntries = tournamentEntries;
  }

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

  const [dayYear, dayMonth, dayDay] = dayKey.split("-").map(Number);
  const dayLabel = `${dayYear}年${dayMonth}月${dayDay}日`;
  const canGoNextDay = shiftDayKey(dayKey, 1) <= todayKey;

  const weekEndKey = shiftDayKey(weekKey, 6);
  const [, weekStartMonth, weekStartDay] = weekKey.split("-").map(Number);
  const [, weekEndMonth, weekEndDay] = weekEndKey.split("-").map(Number);
  const weekLabel = `${weekStartMonth}/${weekStartDay}〜${weekEndMonth}/${weekEndDay}`;
  const canGoNextWeek = shiftWeekKey(weekKey, 1) <= businessWeekKey(now);

  const [yearPart, numPart] = monthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  const customRangeLabel = `${formatDateLabel(customStart)}〜${formatDateLabel(customEnd)}`;
  const customRangeInvalid = customStartInput > customEndInput;

  // 「トータル」は期間として曖昧なため、リングゲーム収支ランキングと同様に
  // インスタ投稿の対象からは外す。
  const periodLabel =
    viewMode === "day"
      ? dayLabel
      : viewMode === "week"
        ? weekLabel
        : viewMode === "month"
          ? monthLabel
          : viewMode === "custom"
            ? customRangeLabel
            : "";

  async function handleShareRanking() {
    const text = buildInstagramPrompt(periodLabel, ranking.slice(0, SHARE_TOP_N));
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "OCEAN トーナメントランキング", text });
      } catch {
        // 共有をキャンセルした場合は何もしない
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setShareStatus("copied");
      setTimeout(() => setShareStatus(null), 3000);
      return;
    }
    setShareStatus("unsupported");
  }

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
          {viewMode === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customStartInput}
                max={todayKey}
                onChange={(e) => setCustomStartInput(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-900 focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-gray-500">〜</span>
              <input
                type="date"
                value={customEndInput}
                max={todayKey}
                onChange={(e) => setCustomEndInput(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-900 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setCustomStart(customStartInput);
                  setCustomEnd(customEndInput);
                }}
                disabled={customRangeInvalid}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                適用
              </button>
              {customRangeInvalid && (
                <span className="text-xs text-red-600">開始日は終了日より前にしてください</span>
              )}
            </div>
          )}
          {viewMode !== "total" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareRanking}
                disabled={ranking.length === 0}
                title={
                  ranking.length === 0
                    ? "この期間は入賞者がいません"
                    : "成績ランキングをスマホの共有機能で送る"
                }
                className="rounded-md bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                📱 投稿ボタン
              </button>
              {shareStatus === "copied" && (
                <span className="text-xs text-gray-500">コピーしました</span>
              )}
              {shareStatus === "unsupported" && (
                <span className="text-xs text-red-600">
                  この端末では共有・コピーに対応していません
                </span>
              )}
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
