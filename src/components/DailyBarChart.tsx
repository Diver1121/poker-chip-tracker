"use client";

// 日別の値を棒グラフで表示する軽量SVGコンポーネント。外部ライブラリなし。
// 0を縦の中央に固定し、プラスは上向き・マイナスは下向きに伸びる（マイナスの日も
// ひと目で分かるようにするため）。valueは太い棒、compareValueがあれば細い棒を
// 同じ位置に重ねて描き、色分けで両方の系列を見比べられるようにする
// （例: トーナメント込みレーキ vs トーナメント抜きレーキ）。
// 横軸には日付ごとに「日にち」と「曜日」の2段ラベルを出す。棒をタップ/クリックすると
// その日の日付と両方の値をピルで表示する（MultiLineChartのタップ強調と揃えた挙動）。

import { useState } from "react";

const WIDTH = 600;
const BAR_AREA_HEIGHT = 150;
const LABEL_AREA_HEIGHT = 34;
const HEIGHT = BAR_AREA_HEIGHT + LABEL_AREA_HEIGHT;
const ZERO_Y = BAR_AREA_HEIGHT / 2;
const HALF_HEIGHT = BAR_AREA_HEIGHT / 2;

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// dateは "YYYY-MM-DD"（JSTの営業日キー）。UTC正午で解釈し日付のズレを避ける。
function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getDay();
}

function formatDateLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/${day}(${WEEKDAY_LABELS[weekdayOf(date)]})`;
}

export function DailyBarChart({
  data,
  color = "#f59e0b",
  colorOpacity = 1,
  comparePositiveColor = "#16a34a",
  compareNegativeColor = "#dc2626",
  label,
  compareLabel,
  unit = "点",
}: {
  data: { date: string; value: number; compareValue?: number }[];
  color?: string;
  // 主系列（太い棒）の不透明度。細い棒（compare系）を目立たせたい場合に下げる。
  colorOpacity?: number;
  // 細い棒（比較系列）はプラス/マイナスで色を変える。
  comparePositiveColor?: string;
  compareNegativeColor?: string;
  label?: string;
  compareLabel?: string;
  unit?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  // 両系列を同じ縮尺で中央（0）から振り分けるため、絶対値の最大で揃える。
  const maxAbs = Math.max(
    1,
    ...data.flatMap((d) => [Math.abs(d.value), Math.abs(d.compareValue ?? 0)]),
  );
  const slotWidth = WIDTH / data.length;
  const barWidth = Math.max(2, slotWidth * 0.6);
  const compareBarWidth = barWidth * 0.45;

  function barHeightOf(value: number): number {
    return value !== 0 ? Math.max((Math.abs(value) / maxAbs) * HALF_HEIGHT, 2) : 0;
  }

  const active = activeIndex !== null ? data[activeIndex] : null;
  const activeX = activeIndex !== null ? (activeIndex + 0.5) * slotWidth : 0;
  const activeIsNegative = active ? active.value < 0 : false;
  const activeBarHeight = active ? barHeightOf(active.value) : 0;
  const activeEdgeY = activeIsNegative ? ZERO_Y + activeBarHeight : ZERO_Y - activeBarHeight;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div
          className="relative w-10 shrink-0 text-right text-xs text-gray-400"
          style={{ height: BAR_AREA_HEIGHT }}
        >
          <span className="absolute top-0 right-0">+{maxAbs.toLocaleString()}</span>
          <span className="absolute right-0 -translate-y-1/2" style={{ top: "50%" }}>
            0
          </span>
          <span className="absolute right-0 bottom-0">-{maxAbs.toLocaleString()}</span>
        </div>
        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-52 w-full"
            preserveAspectRatio="none"
            onClick={() => setActiveIndex(null)}
          >
            <line x1={0} x2={WIDTH} y1={ZERO_Y} y2={ZERO_Y} stroke="#e5e7eb" strokeWidth={1} />
            {data.map((d, i) => {
              const x = i * slotWidth + (slotWidth - barWidth) / 2;
              const barHeight = barHeightOf(d.value);
              const y = d.value < 0 ? ZERO_Y : ZERO_Y - barHeight;

              const hasCompare = d.compareValue !== undefined;
              const compareIsNegative = (d.compareValue ?? 0) < 0;
              const compareHeight = hasCompare ? barHeightOf(d.compareValue!) : 0;
              const compareY = compareIsNegative ? ZERO_Y : ZERO_Y - compareHeight;
              const compareX = i * slotWidth + (slotWidth - compareBarWidth) / 2;
              const compareFill = compareIsNegative ? compareNegativeColor : comparePositiveColor;

              const isActive = activeIndex === i;
              const isDimmed = activeIndex !== null && !isActive;
              const wd = weekdayOf(d.date);
              const dayNum = Number(d.date.slice(8, 10));
              const weekdayColor = wd === 0 ? "#dc2626" : wd === 6 ? "#2563eb" : "#9ca3af";
              return (
                <g
                  key={d.date}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex((prev) => (prev === i ? null : i));
                  }}
                >
                  {/* タップ/クリックしやすいよう列全体を透明な当たり判定にする */}
                  <rect x={i * slotWidth} y={0} width={slotWidth} height={BAR_AREA_HEIGHT} fill="transparent" />
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={1.5}
                    fill={color}
                    opacity={isDimmed ? colorOpacity * 0.4 : colorOpacity}
                    style={{ pointerEvents: "none" }}
                  />
                  {hasCompare && (
                    <rect
                      x={compareX}
                      y={compareY}
                      width={compareBarWidth}
                      height={compareHeight}
                      rx={1}
                      fill={compareFill}
                      opacity={isDimmed ? 0.25 : 1}
                      style={{ pointerEvents: "none" }}
                    />
                  )}
                  <text
                    x={i * slotWidth + slotWidth / 2}
                    y={BAR_AREA_HEIGHT + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#6b7280"
                  >
                    {dayNum}
                  </text>
                  <text
                    x={i * slotWidth + slotWidth / 2}
                    y={BAR_AREA_HEIGHT + 27}
                    textAnchor="middle"
                    fontSize={9}
                    fill={weekdayColor}
                  >
                    {WEEKDAY_LABELS[wd]}
                  </text>
                </g>
              );
            })}
          </svg>
          {active && (
            <div
              className="pointer-events-none absolute rounded-md bg-gray-900/90 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-sm"
              style={{
                left: `${(activeX / WIDTH) * 100}%`,
                top: `${(activeEdgeY / HEIGHT) * 100}%`,
                transform: `translate(${activeX > WIDTH * 0.7 ? "-100%" : "-50%"}, ${activeIsNegative ? "10%" : "-110%"})`,
              }}
            >
              <div>
                {formatDateLabel(active.date)}
              </div>
              <div>
                {label ?? "値"} {active.value.toLocaleString()}
                {unit}
              </div>
              {active.compareValue !== undefined && (
                <div>
                  {compareLabel ?? "比較"} {active.compareValue.toLocaleString()}
                  {unit}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {(label || compareLabel) && (
        <div className="flex flex-wrap gap-4 pl-12 text-xs text-gray-600">
          {label && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color, opacity: colorOpacity }}
              />
              {label}
            </span>
          )}
          {compareLabel && (
            <span className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: comparePositiveColor }}
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: compareNegativeColor }}
                />
              </span>
              {compareLabel}(プラス/マイナス)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
