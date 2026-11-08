"use client";

// 月別の構成比（リピート率の内訳など）を、月ごとに1本の縦棒として表示する
// 100%積み上げ棒グラフ。MonthlyBarChart（単一系列・量）と違い、1本の棒の中を
// 比率に応じて色分けした複数セグメントに分ける。棒をタップ/クリックするとその月の
// 内訳（セグメントごとの％・人数）をピルで表示する。

import { useState } from "react";
import { monthLabelOf } from "@/lib/statsFormat";

const WIDTH = 600;
const BAR_AREA_HEIGHT = 150;
const LABEL_AREA_HEIGHT = 20;
const HEIGHT = BAR_AREA_HEIGHT + LABEL_AREA_HEIGHT;

export type StackedSegmentDef = { key: string; label: string; color: string };
export type StackedMonthData = {
  monthKey: string;
  total: number;
  counts: Record<string, number>;
};

function monthShortLabel(monthKey: string): string {
  const [, month] = monthKey.split("-").map(Number);
  return `${month}月`;
}

export function MonthlyStackedBarChart({
  data,
  segmentDefs,
}: {
  data: StackedMonthData[];
  segmentDefs: StackedSegmentDef[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const slotWidth = WIDTH / data.length;
  const barWidth = Math.max(10, slotWidth * 0.6);

  const active = activeIndex !== null ? data[activeIndex] : null;
  const activeX = activeIndex !== null ? (activeIndex + 0.5) * slotWidth : 0;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div
          className="relative w-14 shrink-0 text-right text-xs text-gray-400"
          style={{ height: BAR_AREA_HEIGHT }}
        >
          <span className="absolute top-0 right-0">100%</span>
          <span className="absolute right-0 bottom-0">0%</span>
        </div>
        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-40 w-full"
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
              const isActive = activeIndex === i;
              const isDimmed = activeIndex !== null && !isActive;
              let cumulative = 0;
              return (
                <g
                  key={d.monthKey}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex((prev) => (prev === i ? null : i));
                  }}
                >
                  {/* タップしやすいよう列全体を透明な当たり判定にする */}
                  <rect x={i * slotWidth} y={0} width={slotWidth} height={BAR_AREA_HEIGHT} fill="transparent" />
                  {d.total > 0 &&
                    segmentDefs.map((seg) => {
                      const count = d.counts[seg.key] ?? 0;
                      const height = (count / d.total) * BAR_AREA_HEIGHT;
                      if (height <= 0) return null;
                      const y = BAR_AREA_HEIGHT - cumulative - height;
                      cumulative += height;
                      return (
                        <rect
                          key={seg.key}
                          x={x}
                          y={y}
                          width={barWidth}
                          height={height}
                          fill={seg.color}
                          opacity={isDimmed ? 0.35 : 1}
                          style={{ pointerEvents: "none" }}
                        />
                      );
                    })}
                  <text
                    x={i * slotWidth + slotWidth / 2}
                    y={BAR_AREA_HEIGHT + 15}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#6b7280"
                  >
                    {monthShortLabel(d.monthKey)}
                  </text>
                </g>
              );
            })}
          </svg>
          {active && (
            <div
              className="pointer-events-none absolute z-10 rounded-md bg-gray-900/90 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-sm"
              style={{
                left: `${(activeX / WIDTH) * 100}%`,
                top: 0,
                transform: `translate(${activeX > WIDTH * 0.7 ? "-100%" : "-50%"}, -110%)`,
              }}
            >
              <div className="mb-0.5 font-semibold">{monthLabelOf(active.monthKey)}</div>
              {active.total === 0 ? (
                <div>記録なし</div>
              ) : (
                segmentDefs.map((seg) => {
                  const count = active.counts[seg.key] ?? 0;
                  const rate = Math.round((count / active.total) * 100);
                  return (
                    <div key={seg.key} className="flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: seg.color }}
                      />
                      <span>
                        {seg.label} {rate}%（{count}人）
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {segmentDefs.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: seg.color }} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
