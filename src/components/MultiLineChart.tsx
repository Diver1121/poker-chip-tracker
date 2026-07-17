"use client";

// 複数系列を重ねて描く軽量SVG折れ線グラフ。外部ライブラリなし。
// 全系列の日付集合を横軸として統合し、系列ごとに値が無い日は線をつながず飛ばす。
// 線をタップ/クリックすると、その系列だけ強調して名前を表示する
// （色数が多いと目視で見分けづらいため）。

import { useState } from "react";

const WIDTH = 600;
const HEIGHT = 200;

export type MultiLineSeries = {
  key: string;
  label: string;
  color: string;
  data: { date: string; value: number }[];
};

export function MultiLineChart({ series }: { series: MultiLineSeries[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const allDates = [...new Set(series.flatMap((s) => s.data.map((d) => d.date)))].sort();

  if (allDates.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  const min = Math.min(0, ...allValues);
  const max = Math.max(0, ...allValues, 1);
  const range = max - min || 1;

  const xForDate = (date: string) => {
    const index = allDates.indexOf(date);
    return allDates.length === 1 ? WIDTH / 2 : (index / (allDates.length - 1)) * WIDTH;
  };
  const yForValue = (value: number) => HEIGHT - ((value - min) / range) * HEIGHT;
  const zeroY = yForValue(0);

  const seriesWithPoints = series.map((s) => {
    const valueByDate = new Map(s.data.map((d) => [d.date, d.value]));
    const points = allDates
      .filter((date) => valueByDate.has(date))
      .map((date) => ({ x: xForDate(date), y: yForValue(valueByDate.get(date)!) }));
    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" ");
    return { ...s, points, path };
  });

  const activeSeries = seriesWithPoints.find((s) => s.key === activeKey) ?? null;
  const activeLastPoint = activeSeries?.points.at(-1) ?? null;

  function toggle(key: string) {
    setActiveKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative w-14 shrink-0 text-right text-xs text-gray-400" style={{ height: HEIGHT }}>
          <span className="absolute top-0 right-0">{max.toLocaleString()}</span>
          {min < 0 && max > 0 && (
            <span
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(zeroY / HEIGHT) * 100}%` }}
            >
              0
            </span>
          )}
          <span className="absolute right-0 bottom-0">{min.toLocaleString()}</span>
        </div>
        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-48 w-full"
            preserveAspectRatio="none"
            onClick={() => setActiveKey(null)}
          >
            <line
              x1={0}
              x2={WIDTH}
              y1={zeroY}
              y2={zeroY}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {seriesWithPoints.map((s) => {
              if (s.points.length === 0) return null;
              const isActive = s.key === activeKey;
              const isDimmed = activeKey !== null && !isActive;
              return (
                <g key={s.key}>
                  {/* タップ/クリックしやすいよう太い透明な当たり判定を重ねる */}
                  <path
                    d={s.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(s.key);
                    }}
                  />
                  <path
                    d={s.path}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={isActive ? 3.5 : 2}
                    opacity={isDimmed ? 0.2 : 1}
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}
          </svg>
          {activeSeries && activeLastPoint && (
            <div
              className="pointer-events-none absolute rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white shadow-sm"
              style={{
                left: `${(activeLastPoint.x / WIDTH) * 100}%`,
                top: `${(activeLastPoint.y / HEIGHT) * 100}%`,
                backgroundColor: activeSeries.color,
                transform: `translate(${activeLastPoint.x > WIDTH * 0.7 ? "-100%" : "0%"}, -50%)`,
              }}
            >
              {activeSeries.label}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => toggle(s.key)}
            className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${
              activeKey === null || activeKey === s.key ? "text-gray-700" : "text-gray-300"
            }`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
