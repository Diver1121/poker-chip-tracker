"use client";

// カテゴリ別の値（常に0以上）を棒グラフで表示する軽量SVGコンポーネント。
// MonthlyBarChartと見た目・挙動は同じだが、横軸が「月」固定ではなく任意の
// ラベル文字列（額面名など）を受け取れるようにした汎用版。

import { useState } from "react";

const WIDTH = 600;
const BAR_AREA_HEIGHT = 150;
const LABEL_AREA_HEIGHT = 28;
const HEIGHT = BAR_AREA_HEIGHT + LABEL_AREA_HEIGHT;

// ラベルが長いと重なるため、横軸表示用に短く切る（ツールチップでは全文を見せる）。
function shortLabel(label: string): string {
  return label.length > 6 ? `${label.slice(0, 5)}…` : label;
}

export function CategoryBarChart({
  data,
  color = "#4f46e5",
  unit = "点",
  label,
}: {
  data: { key: string; label: string; value: number }[];
  color?: string;
  unit?: string;
  label?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const slotWidth = WIDTH / data.length;
  const barWidth = Math.max(6, slotWidth * 0.55);

  function barHeightOf(value: number): number {
    return value > 0 ? Math.max((value / maxValue) * BAR_AREA_HEIGHT, 2) : 0;
  }

  const active = activeIndex !== null ? data[activeIndex] : null;
  const activeX = activeIndex !== null ? (activeIndex + 0.5) * slotWidth : 0;
  const activeEdgeY = active ? BAR_AREA_HEIGHT - barHeightOf(active.value) : 0;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div
          className="relative w-14 shrink-0 text-right text-xs text-gray-400"
          style={{ height: BAR_AREA_HEIGHT }}
        >
          <span className="absolute top-0 right-0">{maxValue.toLocaleString()}</span>
          <span className="absolute right-0 bottom-0">0</span>
        </div>
        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-44 w-full"
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
              const barHeight = barHeightOf(d.value);
              const y = BAR_AREA_HEIGHT - barHeight;
              const isActive = activeIndex === i;
              const isDimmed = activeIndex !== null && !isActive;
              return (
                <g
                  key={d.key}
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
                    rx={Math.min(4, barWidth / 2)}
                    fill={color}
                    opacity={isDimmed ? 0.35 : 1}
                    style={{ pointerEvents: "none" }}
                  />
                  <text
                    x={i * slotWidth + slotWidth / 2}
                    y={BAR_AREA_HEIGHT + 18}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#6b7280"
                  >
                    {shortLabel(d.label)}
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
                transform: `translate(${activeX > WIDTH * 0.7 ? "-100%" : "-50%"}, -110%)`,
              }}
            >
              <div>{active.label}</div>
              <div>
                {label ?? "値"} {active.value.toLocaleString()}
                {unit}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
