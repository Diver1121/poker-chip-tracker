"use client";

// 日別の値を棒グラフで表示する軽量SVGコンポーネント。外部ライブラリなし。
// 横軸には日付ごとに「日にち」と「曜日」の2段ラベルを出す。
// 棒をタップ/クリックすると、その日の日付と値をピルで表示する
// （MultiLineChartのタップ強調と揃えた挙動）。

import { useState } from "react";

const WIDTH = 600;
const BAR_AREA_HEIGHT = 150;
const LABEL_AREA_HEIGHT = 34;
const HEIGHT = BAR_AREA_HEIGHT + LABEL_AREA_HEIGHT;

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
  color = "#d97706",
  unit = "点",
}: {
  data: { date: string; value: number }[];
  color?: string;
  unit?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const max = Math.max(0, ...data.map((d) => d.value), 1);
  const slotWidth = WIDTH / data.length;
  const barWidth = Math.max(2, slotWidth * 0.6);

  const active = activeIndex !== null ? data[activeIndex] : null;
  const activeX = activeIndex !== null ? (activeIndex + 0.5) * slotWidth : 0;
  const activeBarHeight =
    active && active.value > 0 ? Math.max((active.value / max) * BAR_AREA_HEIGHT, 2) : 0;

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div
          className="relative w-10 shrink-0 text-right text-xs text-gray-400"
          style={{ height: BAR_AREA_HEIGHT }}
        >
          <span className="absolute top-0 right-0">{max.toLocaleString()}</span>
          <span className="absolute right-0 bottom-0">0</span>
        </div>
        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-52 w-full"
            preserveAspectRatio="none"
            onClick={() => setActiveIndex(null)}
          >
            <line
              x1={0}
              x2={WIDTH}
              y1={BAR_AREA_HEIGHT}
              y2={BAR_AREA_HEIGHT}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            {data.map((d, i) => {
              const x = i * slotWidth + (slotWidth - barWidth) / 2;
              const barHeight = d.value > 0 ? Math.max((d.value / max) * BAR_AREA_HEIGHT, 2) : 0;
              const y = BAR_AREA_HEIGHT - barHeight;
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
                    opacity={isDimmed ? 0.25 : 1}
                    style={{ pointerEvents: "none" }}
                  />
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
              className="pointer-events-none absolute rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-sm"
              style={{
                left: `${(activeX / WIDTH) * 100}%`,
                top: `${((BAR_AREA_HEIGHT - activeBarHeight) / HEIGHT) * 100}%`,
                backgroundColor: color,
                transform: `translate(${activeX > WIDTH * 0.7 ? "-100%" : "-50%"}, -110%)`,
              }}
            >
              {formatDateLabel(active.date)}：{active.value.toLocaleString()}
              {unit}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
