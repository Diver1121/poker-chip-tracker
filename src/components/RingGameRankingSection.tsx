"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import { MultiLineChart, type MultiLineSeries } from "@/components/MultiLineChart";
import { computeRingGameNetByCustomer, computeRingGameResultTimelinesByCustomer } from "@/lib/balances";
import {
  businessDateKey,
  businessWeekKey,
  daysInMonth,
  daysInWeek,
  shiftDayKey,
  shiftMonthKey,
  shiftWeekKey,
} from "@/lib/businessDay";
import { formatSigned, signColorClass } from "@/lib/statsFormat";
import type { ChipTransaction, Customer } from "@/lib/types";

// グラフ表示で重ねる上位勢の人数と、横軸の期間選択肢（ヶ月）。
const CHART_TOP_N = 10;
const CHART_RANGE_OPTIONS = [1, 3, 6, 12] as const;
type ChartRangeMonths = (typeof CHART_RANGE_OPTIONS)[number];

// 上位10名ぶんの色を固定10色から割り当てる。客IDのハッシュ値で希望の色を決め、
// 既に使われていたら次の空き色へ回す（上位勢が期間切替で入れ替わっても、
// 同じ客はできるだけ同じ色のままになるようにする＝順位ではなく客に色を付ける）。
function hashToIndex(id: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % size;
  return ((hash % size) + size) % size;
}
function paletteColor(index: number): string {
  const hue = (index * 36) % 360;
  const isYellowish = hue >= 40 && hue <= 95;
  return `hsl(${hue}, ${isYellowish ? 72 : 66}%, ${isYellowish ? 38 : 46}%)`;
}
function colorsForCustomers(orderedIds: string[]): Map<string, string> {
  const colorByCustomer = new Map<string, string>();
  const used = new Set<number>();
  for (const id of orderedIds) {
    let index = hashToIndex(id, 10);
    while (used.has(index)) index = (index + 1) % 10;
    used.add(index);
    colorByCustomer.set(id, paletteColor(index));
  }
  return colorByCustomer;
}

// インスタ投稿用プロンプトに載せる人数。月は「月間TOP10」として1〜3位（金銀銅）＋4〜10位、
// それ以外（日/週/期間指定）は従来どおり上位3名だけに絞る
// （アプリ内の表自体はどちらも全員表示のまま）。
const SHARE_TOP_N_MONTH = 10;
const SHARE_TOP_N_OTHER = 3;

// リングゲームの収支をポーカーらしくBBで表示するための換算レート。
// 2/5（2sb/5bb）のテーブルを想定し、1BB=5点として扱う
// （実際のテーブルのレートを取引ごとに記録していないため、固定レートで換算する）。
const BB_VALUE = 5;

function formatBB(net: number): string {
  const bb = Math.round((net / BB_VALUE) * 10) / 10;
  const formatted = bb.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return bb > 0 ? `+${formatted}BB` : `${formatted}BB`;
}

type ViewMode = "day" | "week" | "month" | "custom" | "total";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: "日",
  week: "週",
  month: "月",
  custom: "期間指定",
  total: "トータル",
};

// "YYYY-MM-DD" -> "YYYY/M/D"（期間指定の表示・共有プロンプト用）
function formatDateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

function medalLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}位`;
}

// インスタのストーリー画像を作ってもらうためのAI向けプロンプト文（日/週/期間指定用、従来の上位3名版）。
// スマホの共有機能で好きなAIアプリ・チャットに渡せるよう、テキスト1本にまとめている。
function buildInstagramPromptTop3(
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

// 月のTOP10版プロンプト。(OCEAN)(RING GAME)(RANKING)(TOP10)のワードを見出しに含める。
function buildInstagramPromptTop10(
  periodLabel: string,
  positiveRanking: { rank: number; name: string; net: number }[],
): string {
  const lines = positiveRanking
    .map((r) => `${r.rank}位 ${r.name} ${formatBB(r.net)}`)
    .join("\n");
  return [
    `OCEAN大分店 RING GAME RANKING（${periodLabel}）のインスタストーリー画像を作ってください。`,
    "",
    "【デザイン】",
    "・サイズ 1080×1920（インスタのストーリー用の縦長）",
    "・背景は黒と紫を基調にしたネオン風グラデーション",
    "・見出しに「OCEAN」「RING GAME RANKING」「TOP10」",
    "・1位〜3位（1位ゴールド、2位シルバー、3位ブロンズ）を特別感のある大きめのカードで表示",
    "・4位〜10位も同じリストの中にノーマルな配色で表示し、文字サイズは1〜3位より少し小さくする",
    "・文字は背景に対して見やすい配色（ネオングリーン）にする",
    "",
    "【この期間の収支ランキング TOP10（プラスの客のみ）】",
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
  // 期間指定は日付入力欄(Input)とフィルタに使う確定値(Applied)を分けて、
  // 「適用」を押すまでは表を再計算しない。
  const [customStartInput, setCustomStartInput] = useState(todayKey);
  const [customEndInput, setCustomEndInput] = useState(todayKey);
  const [customStart, setCustomStart] = useState(todayKey);
  const [customEnd, setCustomEnd] = useState(todayKey);
  const [shareStatus, setShareStatus] = useState<null | "copied" | "unsupported">(null);
  const [showChart, setShowChart] = useState(false);
  const [chartRangeMonths, setChartRangeMonths] = useState<ChartRangeMonths>(3);

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
  } else if (viewMode === "custom") {
    targetTransactions = transactions.filter((tx) => {
      const d = businessDateKey(tx.created_at);
      return d >= customStart && d <= customEnd;
    });
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

  // グラフ表示用: 選択した期間（直近Nヶ月）の取引だけに絞って日次収支累計を計算し、
  // その期間の最終収支が多い順で上位10名だけを重ねて表示する。
  const chartWindowStartKey = `${shiftMonthKey(currentMonthKey, -(chartRangeMonths - 1))}-01`;
  const chartWindowTransactions = transactions.filter(
    (tx) => businessDateKey(tx.created_at) >= chartWindowStartKey,
  );
  const timelinesByCustomer = computeRingGameResultTimelinesByCustomer(chartWindowTransactions);
  const chartRanking = [...timelinesByCustomer.entries()]
    .map(([customerId, data]) => ({
      customerId,
      data,
      finalTotal: data.at(-1)?.total ?? 0,
    }))
    .sort((a, b) => b.finalTotal - a.finalTotal)
    .slice(0, CHART_TOP_N);
  const chartColorByCustomer = colorsForCustomers(chartRanking.map((r) => r.customerId));
  const chartSeries: MultiLineSeries[] = chartRanking.map((r) => ({
    key: r.customerId,
    label: nameById.get(r.customerId) ?? "(削除済みの客)",
    color: chartColorByCustomer.get(r.customerId) ?? "#4f46e5",
    data: r.data.map((d) => ({ date: d.date, value: d.total })),
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

  const customRangeLabel = `${formatDateLabel(customStart)}〜${formatDateLabel(customEnd)}`;
  const customRangeInvalid = customStartInput > customEndInput;

  // 日/週/月/期間指定のどれを見ていても、その期間のプラス収支の客だけを対象に
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
          : viewMode === "custom"
            ? customRangeLabel
            : "";
  const positiveRanking = ranking.filter((r) => r.net > 0);

  async function handleShareRanking() {
    const text =
      viewMode === "month"
        ? buildInstagramPromptTop10(periodLabel, positiveRanking.slice(0, SHARE_TOP_N_MONTH))
        : buildInstagramPromptTop3(periodLabel, positiveRanking.slice(0, SHARE_TOP_N_OTHER));
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
            投稿ボタンで送るプロンプトは2/5（1BB=5点）換算のBB表示にしています。
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
          <button
            type="button"
            onClick={() => setShowChart((v) => !v)}
            className={`rounded-md border px-2 py-1 font-medium ${
              showChart
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            📈 グラフ
          </button>
          {!showChart && viewMode === "day" && (
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
          {!showChart && viewMode === "week" && (
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
          {!showChart && viewMode === "month" && (
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
          {!showChart && viewMode === "custom" && (
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
          {!showChart && viewMode !== "total" && (
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
          {showChart && (
            <div className="flex flex-wrap items-center gap-1.5">
              {CHART_RANGE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setChartRangeMonths(n)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    chartRangeMonths === n
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  直近{n}ヶ月
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showChart ? (
        chartSeries.length === 0 ? (
          <p className="text-sm text-gray-500">この期間の記録がありません。</p>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-3 text-xs text-gray-500">
              上位{Math.min(CHART_TOP_N, chartSeries.length)}名の収支累計（チップ数）を重ねて表示。線や凡例をタップすると1人だけ強調できます。
            </p>
            <MultiLineChart series={chartSeries} />
          </div>
        )
      ) : ranking.length === 0 ? (
        <p className="text-sm text-gray-500">記録がありません。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
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
                    <td className={`px-4 py-2 text-right font-bold ${signColorClass(r.net)}`}>
                      {formatSigned(r.net)}
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
