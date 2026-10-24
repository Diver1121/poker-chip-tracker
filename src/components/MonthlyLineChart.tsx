"use client";

// 月別の値（常に0以上、売上等の量）を折れ線グラフで表示する軽量SVGコンポーネント。
// 以前は棒グラフだったが、前月との比較（トレンドの傾き）を見やすくするため
// 折れ線＋エリア塗りに変更した。点をタップ/クリックするとその月の値をピルで表示する
// （他のチャートのタップ強調と挙動を揃えている）。

import { useId, useState } from "react";
import { monthLabelOf } from "@/lib/statsFormat";

const WIDTH = 600;
const PLOT_HEIGHT = 150;
const LABEL_AREA_HEIGHT = 20;
const HEIGHT = PLOT_HEIGHT + LABEL_AREA_HEIGHT;

function monthShortLabel(monthKey: string): string {
  const [, month] = monthKey.split("-").map(Number);
  return `${month}月`;
}

export function MonthlyLineChart({
  data,
  color = "#4f46e5",
  unit = "点",
  label,
}: {
  data: { monthKey: string; value: number }[];
  color?: string;
  unit?: string;
  label?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId();

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const slotWidth = WIDTH / data.length;

  const points = data.map((d, i) => ({
    x: i * slotWidth + slotWidth / 2,
    y: PLOT_HEIGHT - (d.value / maxValue) * PLOT_HEIGHT,
    monthKey: d.monthKey,
    value: d.value,
  }));

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = `${lineD} L${points[points.length - 1].x},${PLOT_HEIGHT} L${points[0].x},${PLOT_HEIGHT} Z`;

  const active = activeIndex !== null ? points[activeIndex] : null;

  return (
    <div className="space-y-2">
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
            className="h-40 w-full"
            preserveAspectRatio="none"
            onClick={() => setActiveIndex(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <line x1={0} x2={WIDTH} y1={PLOT_HEIGHT} y2={PLOT_HEIGHT} stroke="#e5e7eb" strokeWidth={1} />
            <path d={areaD} fill={`url(#${gradientId})`} stroke="none" />
            <path d={lineD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => {
              const isActive = activeIndex === i;
              const isDimmed = activeIndex !== null && !isActive;
              return (
                <g
                  key={p.monthKey}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex((prev) => (prev === i ? null : i));
                  }}
                >
                  {/* タップ/クリックしやすいよう列全体を透明な当たり判定にする */}
                  <rect x={i * slotWidth} y={0} width={slotWidth} height={PLOT_HEIGHT} fill="transparent" />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isActive ? 5 : 3}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    opacity={isDimmed ? 0.35 : 1}
                    style={{ pointerEvents: "none" }}
                  />
                  <text
                    x={i * slotWidth + slotWidth / 2}
                    y={PLOT_HEIGHT + 15}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#6b7280"
                  >
                    {monthShortLabel(p.monthKey)}
                  </text>
                </g>
              );
            })}
          </svg>
          {active && (
            <div
              className="pointer-events-none absolute rounded-md bg-gray-900/90 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-sm"
              style={{
                left: `${(active.x / WIDTH) * 100}%`,
                top: `${(active.y / HEIGHT) * 100}%`,
                transform: `translate(${active.x > WIDTH * 0.7 ? "-100%" : "-50%"}, -110%)`,
              }}
            >
              <div>{monthLabelOf(active.monthKey)}</div>
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
