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

type ViewMode = "day" | "week" | "month" | "total";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: "日",
  week: "週",
  month: "月",
  total: "トータル",
};

function medalLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}位`;
}

// インスタのストーリー画像を作ってもらうためのAI向けプロンプト文。
// リング/トーナメントの投稿ボタンとは違い、上位3名だけに絞らずポイント獲得者
// 全員を載せる（1〜3位は金銀銅で強調、4位以降はノーマル表記で少し小さく）。
function buildInstagramPrompt(
  periodLabel: string,
  fullRanking: { rank: number; name: string; points: number }[],
): string {
  const lines = fullRanking.map((r) => `${r.rank}位 ${r.name} ${r.points}pt`).join("\n");
  return [
    `OCEAN大分店 OPS（Ocean Poker Series）ポイントランキング（${periodLabel}）のインスタストーリー画像を作ってください。`,
    "",
    "【デザイン】",
    "・サイズ 1080×1920（インスタのストーリー用の縦長）",
    "・背景は黒地に青・紫・ピンクのネオングロー、ホログラムのような光沢感のあるデザイン",
    "・見出しに「OCEAN大分店」「OPS point ranking」",
    "・1位は名前をゴールド、2位はシルバー、3位はブロンズの特別な配色で目立たせる",
    "・4位以降は同じリストの中でノーマルな配色にし、文字サイズは1〜3位より少し小さくする",
    "・ポイント獲得者は人数を絞らず全員掲載する",
    "・各順位とも名前とポイント数を表記する",
    "",
    "【この期間のポイントランキング（全員）】",
    lines,
    "",
    "このデータを上のデザインに当てはめて画像を作ってください。",
  ].join("\n");
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
  const now = new Date();
  const todayKey = businessDateKey(now);

  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [dayKey, setDayKey] = useState(todayKey);
  const [weekKey, setWeekKey] = useState(businessWeekKey(now));
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [shareStatus, setShareStatus] = useState<null | "copied" | "unsupported">(null);

  // シリーズ開始日より前のエントリーはそもそも対象外。
  const seriesEntries = tournamentEntries.filter(
    (e) => businessDateKey(e.created_at) >= SERIES_START_DATE,
  );

  // 「トータル」はシリーズ開始日から今日までの全エントリーを指す。
  let targetEntries: TournamentEntry[];
  if (viewMode === "day") {
    targetEntries = seriesEntries.filter((e) => businessDateKey(e.created_at) === dayKey);
  } else if (viewMode === "week") {
    const weekDays = new Set(daysInWeek(weekKey));
    targetEntries = seriesEntries.filter((e) => weekDays.has(businessDateKey(e.created_at)));
  } else if (viewMode === "month") {
    const monthDays = new Set(daysInMonth(monthKey));
    targetEntries = seriesEntries.filter((e) => monthDays.has(businessDateKey(e.created_at)));
  } else {
    targetEntries = seriesEntries;
  }

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

  // ポイント獲得者全員（人数を絞らない）。表示用テーブルはこのうち上位TOP_N件のみ、
  // 投稿ボタンのプロンプトはこの全員を使う。
  const fullRanking = [...pointsByCustomer.entries()]
    .map(([customerId, { points, cashCount }]) => ({ customerId, points, cashCount }))
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({
      rank: i + 1,
      customerId: r.customerId,
      name: nameById.get(r.customerId) ?? "(削除済みの客)",
      points: r.points,
      cashCount: r.cashCount,
    }));
  const ranking = fullRanking.slice(0, TOP_N);

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
  const [seriesStartYear, seriesStartMonth, seriesStartDay] = SERIES_START_DATE.split("-").map(Number);
  const seriesStartLabel = `${seriesStartYear}年${seriesStartMonth}月${seriesStartDay}日`;

  // 「トータル」もシリーズ開始日〜今日までの明確な区間なので、他2つのランキングとは違い
  // 投稿ボタンの対象から除外しない。
  const periodLabel =
    viewMode === "day"
      ? dayLabel
      : viewMode === "week"
        ? weekLabel
        : viewMode === "month"
          ? monthLabel
          : `${seriesStartLabel}〜現在`;

  async function handleShareRanking() {
    const text = buildInstagramPrompt(periodLabel, fullRanking);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "OCEAN OPSポイントランキング", text });
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareRanking}
              disabled={fullRanking.length === 0}
              title={
                fullRanking.length === 0
                  ? "この期間はポイント獲得者がいません"
                  : "ポイントランキングをスマホの共有機能で送る"
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
