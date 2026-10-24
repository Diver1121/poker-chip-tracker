"use client";

// 「月次売上推移」専用。複数の月の折れ線を横軸=日（1日〜月末）で重ねて表示し、
// 月ごとのペース（同じ日数でどちらが多いか）を比較できるようにする。
// 月の線色は年に依存せず「何月か」で固定（7月は常に赤、8月は常に別の色…）にして、
// どの期間を見ても同じ月が同じ色で覚えやすいようにしている。
// 表示する月数はボタンで切り替え可能（多いほど線が重なって見づらくなるため）。

import { useState } from "react";

const WIDTH = 600;
const PLOT_HEIGHT = 170;
const LABEL_AREA_HEIGHT = 20;
const HEIGHT = PLOT_HEIGHT + LABEL_AREA_HEIGHT;
const RANGE_OPTIONS = [1, 3, 6, 12];

// 月(1-12)ごとに固定の色相を割り当てる。7月を基準(赤=0°)にして30°刻みで一周させる。
// 黄〜黄緑帯(概ね40〜95°)は明るいと視認性が落ちるため彩度・明度を少し落とす。
function monthColor(monthKey: string): string {
  const month = Number(monthKey.slice(5, 7));
  const hue = (((month - 7) * 30) % 360 + 360) % 360;
  const isYellowish = hue >= 40 && hue <= 95;
  return `hsl(${hue}, ${isYellowish ? 72 : 68}%, ${isYellowish ? 38 : 46}%)`;
}

function monthShortLabel(monthKey: string): string {
  return `${Number(monthKey.slice(5, 7))}月`;
}

export function MonthlyPaceOverlayChart({
  series,
  unit = "点",
}: {
  series: { monthKey: string; values: number[] }[];
  unit?: string;
}) {
  const sorted = [...series].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  // ボタンは常に1/3/6/12ヶ月の4つを出す。実際のデータがそれより少ない月数しか
  // 無い場合はslice(-rangeMonths)が持っている分だけを自然に返すので、
  // データ量でボタン自体を出し分ける必要はない。
  const [rangeMonths, setRangeMonths] = useState(3);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const visible = sorted.slice(-rangeMonths);
  const currentMonthKey = sorted[sorted.length - 1].monthKey;
  const maxDays = Math.max(...visible.map((s) => s.values.length), 1);
  const maxValue = Math.max(1, ...visible.flatMap((s) => s.values));
  const slotWidth = WIDTH / maxDays;

  const xOf = (dayIndex: number) => dayIndex * slotWidth + slotWidth / 2;
  const yOf = (value: number) => PLOT_HEIGHT - (value / maxValue) * PLOT_HEIGHT;

  const activeValues =
    activeDay !== null
      ? visible
          .filter((s) => s.values.length > activeDay)
          .map((s) => ({ monthKey: s.monthKey, value: s.values[activeDay] }))
          .sort((a, b) => b.value - a.value)
      : [];

  const dayLabelIndices = Array.from({ length: maxDays }, (_, i) => i).filter(
    (i) => i === 0 || (i + 1) % 5 === 0,
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRangeMonths(n)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeMonths === n
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              直近{n}ヶ月
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
          {visible.map((s) => (
            <span key={s.monthKey} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: monthColor(s.monthKey) }}
              />
              {monthShortLabel(s.monthKey)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div
          className="relative w-14 shrink-0 text-right text-xs text-gray-400"
          style={{ height: PLOT_HEIGHT }}
        >
          <span className="absolute top-0 right-0">{maxValue.toLocaleString()}</span>
          <span className="absolute right-0 bottom-0">0</span>
        </div>
        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-44 w-full"
            preserveAspectRatio="none"
            onClick={() => setActiveDay(null)}
          >
            <line
              x1={0}
              x2={WIDTH}
              y1={PLOT_HEIGHT}
              y2={PLOT_HEIGHT}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            {/* 日ごとの当たり判定列。タップ/クリックした日の値を全月まとめてツールチップ表示する */}
            {Array.from({ length: maxDays }, (_, day) => (
              <rect
                key={day}
                x={day * slotWidth}
                y={0}
                width={slotWidth}
                height={PLOT_HEIGHT}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDay((prev) => (prev === day ? null : day));
                }}
              />
            ))}
            {activeDay !== null && (
              <line
                x1={xOf(activeDay)}
                x2={xOf(activeDay)}
                y1={0}
                y2={PLOT_HEIGHT}
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="3 3"
                style={{ pointerEvents: "none" }}
              />
            )}
            {visible.map((s) => {
              const color = monthColor(s.monthKey);
              const isCurrent = s.monthKey === currentMonthKey;
              const lastIdx = s.values.length - 1;
              if (lastIdx < 0) return null;
              const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(v)}`).join(" ");
              const lastX = xOf(lastIdx);
              // 月末まで届いている線は右端ぎりぎりまで伸びるため、ラベルを右側に置くと
              // SVGの描画範囲外に切れて見えなくなる。右端付近では左側に反転させる。
              const nearRightEdge = lastX > WIDTH * 0.85;
              return (
                <g key={s.monthKey} style={{ pointerEvents: "none" }}>
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={isCurrent ? 3 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={isCurrent ? 1 : 0.85}
                  />
                  <circle
                    cx={lastX}
                    cy={yOf(s.values[lastIdx])}
                    r={isCurrent ? 4 : 3}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <text
                    x={nearRightEdge ? lastX - 5 : Math.min(lastX + 5, WIDTH - 2)}
                    y={yOf(s.values[lastIdx])}
                    textAnchor={nearRightEdge ? "end" : "start"}
                    dominantBaseline="middle"
                    fontSize={10}
                    fontWeight={isCurrent ? 700 : 500}
                    fill={color}
                  >
                    {monthShortLabel(s.monthKey)}
                  </text>
                </g>
              );
            })}
            {dayLabelIndices.map((i) => (
              <text
                key={i}
                x={xOf(i)}
                y={PLOT_HEIGHT + 15}
                textAnchor="middle"
                fontSize={10}
                fill="#6b7280"
              >
                {i + 1}
              </text>
            ))}
          </svg>
          {activeDay !== null && activeValues.length > 0 && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-md bg-gray-900/90 px-2 py-1.5 text-xs text-white shadow-sm"
              style={{
                left: `${(xOf(activeDay) / WIDTH) * 100}%`,
                transform: `translate(${xOf(activeDay) > WIDTH * 0.7 ? "-100%" : "-50%"}, 0)`,
              }}
            >
              <div className="mb-0.5 font-medium whitespace-nowrap">{activeDay + 1}日まで</div>
              <div className="space-y-0.5">
                {activeValues.map(({ monthKey, value }) => (
                  <div key={monthKey} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: monthColor(monthKey) }}
                    />
                    <span>{monthShortLabel(monthKey)}</span>
                    <span className="ml-auto font-medium">
                      {value.toLocaleString()}
                      {unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
