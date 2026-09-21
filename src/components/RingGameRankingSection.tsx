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
import { signColorClass } from "@/lib/statsFormat";
import type { ChipTransaction, Customer } from "@/lib/types";

// インスタ投稿用プロンプトに載せる人数。上位3名（金銀銅）だけに絞ることで
// 「選ばれた3人」としての価値を出す（アプリ内の表自体は全員表示のまま）。
const SHARE_TOP_N = 3;

// リングゲームの収支をポーカーらしくBBで表示するための換算レート。
// 2/5（2sb/5bb）のテーブルを想定し、1BB=5点として扱う
// （実際のテーブルのレートを取引ごとに記録していないため、固定レートで換算する）。
const BB_VALUE = 5;

function formatBB(net: number): string {
  const bb = Math.round((net / BB_VALUE) * 10) / 10;
  const formatted = bb.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return bb > 0 ? `+${formatted}BB` : `${formatted}BB`;
}

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

// インスタのストーリー画像を作ってもらうためのAI向けプロンプト文。
// スマホの共有機能で好きなAIアプリ・チャットに渡せるよう、テキスト1本にまとめている。
function buildInstagramPrompt(
  periodLabel: string,
  positiveRanking: { rank: number; name: string; net: number }[],
): string {
  const lines = positiveRanking
    .map((r) => `${r.rank}位 ${r.name} ${formatBB(r.net)}`)
    .join("\n");
  return [
    `OCEAN大分店 リングゲーム収支ランキング（${periodLabel}）のインスタストーリー画像を作ってください。`,
    "",
    "【デザイン】",
    "・サイズ 1080×1920（インスタのストーリー用の縦長）",
    "・背景は黒と紫を基調にしたネオン風グラデーション",
    "・見出しに「OCEAN大分店」「RING GAME 上位3名」",
    "・上位3名（1位ゴールド、2位シルバー、3位ブロンズ）を特別感のある大きめのカードで表示",
    "・文字は背景に対して見やすい配色（ネオングリーン）にする",
    "",
    "【この期間の収支ランキング（プラスの客のみ）】",
    lines,
    "",
    "このデータを上のデザインに当てはめて画像を作ってください。",
  ].join("\n");
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
  const [shareStatus, setShareStatus] = useState<null | "copied" | "unsupported">(null);

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

  // 日/週/月/年のどれを見ていても、その期間のプラス収支の客だけを対象に
  // インスタ投稿用の画像生成プロンプトをスマホの共有機能に渡せるようにする
  // （LINE・メモ・AIアプリなど好きな送り先を選んでもらう）。トータルは期間として
  // 曖昧なため対象外。
  const periodLabel =
    viewMode === "day"
      ? dayLabel
      : viewMode === "week"
        ? weekLabel
        : viewMode === "month"
          ? monthLabel
          : viewMode === "year"
            ? yearLabel
            : "";
  const positiveRanking = ranking.filter((r) => r.net > 0);

  async function handleShareRanking() {
    const text = buildInstagramPrompt(periodLabel, positiveRanking.slice(0, SHARE_TOP_N));
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "OCEAN リングゲームランキング", text });
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
          <h2 className="text-lg font-bold text-gray-900">リングゲーム収支ランキング</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ポーカーのバイイン・アウト収支（アウト − バイイン）の多い順に全員表示。
            マイナス収支の客も含みます。トーナメント使用分・ブラックジャックは含みません。
            収支は2/5（1BB=5点）換算のBB表示です。
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
          {viewMode !== "total" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareRanking}
                disabled={positiveRanking.length === 0}
                title={
                  positiveRanking.length === 0
                    ? "この期間はプラス収支の客がいません"
                    : "プラス収支のランキングをスマホの共有機能で送る"
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
        <p className="text-sm text-gray-500">記録がありません。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium"></th>
                  <th className="px-4 py-2 text-left font-medium">名前</th>
                  <th className="px-4 py-2 text-right font-medium">収支(BB)</th>
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
                      {formatBB(r.net)}
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
