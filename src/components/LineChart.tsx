"use client";

// 外部ライブラリなしで折れ線グラフを描く軽量SVGコンポーネント。
// data は時系列順で渡すこと。totalの推移を1本の線＋グラデーション塗りで表示する。
// 横軸には日付ラベルを数点だけ間引いて表示し、タップ/ドラッグすると
// 一番近いデータ点に🔴の目印と縦のガイド線を出して、今どこを見ているか分かるようにする。

import { useRef, useState } from "react";
import { formatJstMonthDay } from "@/lib/businessDay";

const WIDTH = 600;
const CHART_HEIGHT = 160;
const AXIS_HEIGHT = 26;
const HEIGHT = CHART_HEIGHT + AXIS_HEIGHT;
const TICK_COUNT = 5;

// splitAtZero用の色。日別レーキ表のプラス青／マイナス赤（signColorClass）と揃えている。
const POSITIVE_COLOR = "#2563eb";
const NEGATIVE_COLOR = "#dc2626";

// data.lengthに応じて、間引いた横軸ラベルのインデックスを均等に選ぶ（両端は必ず含む）。
function pickTickIndices(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const indices = new Set<number>();
  for (let i = 0; i < count; i++) {
    indices.add(Math.round((i * (length - 1)) / (count - 1)));
  }
  return [...indices].sort((a, b) => a - b);
}

type ScreenPoint = { x: number; y: number; total: number };

// 折れ線を0との交点で分割し、線分ごとに「プラス側/マイナス側」の区間を作る。
// 区間をまたぐところは0の高さ（zeroY）で正確に交差する点を補間して差し込む。
function splitSegmentsAtZero(
  points: ScreenPoint[],
  zeroY: number,
): { x1: number; y1: number; x2: number; y2: number; positive: boolean }[] {
  const segments: { x1: number; y1: number; x2: number; y2: number; positive: boolean }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const sign1 = p1.total >= 0;
    const sign2 = p2.total >= 0;
    if (sign1 === sign2) {
      segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, positive: sign1 });
    } else {
      const t = (zeroY - p1.y) / (p2.y - p1.y);
      const crossX = p1.x + (p2.x - p1.x) * t;
      segments.push({ x1: p1.x, y1: p1.y, x2: crossX, y2: zeroY, positive: sign1 });
      segments.push({ x1: crossX, y1: zeroY, x2: p2.x, y2: p2.y, positive: sign2 });
    }
  }
  return segments;
}

export function LineChart({
  data,
  color = "#4f46e5",
  gradientId,
  zoomToData = false,
  referenceLine,
  splitAtZero = false,
}: {
  data: { date: string; total: number }[];
  color?: string;
  gradientId: string;
  // trueの場合、0を基準にせず実データ（+基準線）の範囲だけで拡大表示する。
  // 値が常に大きい（0付近に来ない）指標だと、0基準だと変動がほぼ見えなくなるため。
  zoomToData?: boolean;
  // 基準線（例：営業開始時点の値）を破線で表示する。
  referenceLine?: { label: string; value: number };
  // trueなら、線・塗り・現在値の数字を0より上(プラス)は青、0より下(マイナス)は赤で
  // 描き分ける（店の儲け/払い出しなど、符号に意味がある指標向け）。
  splitAtZero?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const values = data.map((d) => d.total);
  const candidateValues = referenceLine ? [...values, referenceLine.value] : values;
  const min = zoomToData ? Math.min(...candidateValues) : Math.min(0, ...candidateValues);
  const max = zoomToData ? Math.max(...candidateValues) : Math.max(0, ...candidateValues);
  const range = max - min || 1;
  const latest = data[data.length - 1].total;

  const points: ScreenPoint[] = data.map((d, i) => {
    const x = data.length === 1 ? WIDTH / 2 : (i / (data.length - 1)) * WIDTH;
    const y = CHART_HEIGHT - ((d.total - min) / range) * CHART_HEIGHT;
    return { x, y, total: d.total };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;
  const zeroY = CHART_HEIGHT - ((0 - min) / range) * CHART_HEIGHT;
  const showZeroLine = min < 0 && max > 0;
  // ずっと片側（全部プラス/全部マイナス）のときは、区間分けせず単色で塗る。
  const zeroSegments = splitAtZero && showZeroLine ? splitSegmentsAtZero(points, zeroY) : null;
  const overallPositive = min >= 0;
  const signColor = splitAtZero ? (overallPositive ? POSITIVE_COLOR : NEGATIVE_COLOR) : color;
  const latestColor = splitAtZero ? (latest >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR) : color;
  const referenceY =
    referenceLine != null
      ? CHART_HEIGHT - ((referenceLine.value - min) / range) * CHART_HEIGHT
      : null;
  const lastPoint = points[points.length - 1];
  const tickIndices = pickTickIndices(data.length, Math.min(TICK_COUNT, data.length));
  const positiveGradientId = `${gradientId}-pos`;
  const negativeGradientId = `${gradientId}-neg`;

  function updateActiveFromClientX(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = data.length === 1 ? 0 : (clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (data.length - 1));
    setActiveIndex(Math.min(data.length - 1, Math.max(0, index)));
  }

  const active = activeIndex !== null ? { row: data[activeIndex], point: points[activeIndex] } : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p
          className={`text-2xl font-bold ${splitAtZero ? (latest >= 0 ? "text-blue-600" : "text-red-600") : "text-gray-900"}`}
        >
          {latest.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-gray-500">現在値</span>
        </p>
        <p className="text-xs text-gray-500">
          最大 {max.toLocaleString()} ／ 最小 {min.toLocaleString()}
        </p>
      </div>
      <div className="flex gap-2">
        <div
          className="relative w-14 shrink-0 text-right text-xs text-gray-400"
          style={{ height: CHART_HEIGHT }}
        >
          <span className="absolute top-0 right-0">{max.toLocaleString()}</span>
          {showZeroLine && (
            <span
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(zeroY / CHART_HEIGHT) * 100}%` }}
            >
              0
            </span>
          )}
          <span className="absolute right-0 bottom-0">{min.toLocaleString()}</span>
        </div>
        <div className="relative flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            style={{ height: HEIGHT, touchAction: "pan-y", cursor: "pointer" }}
            preserveAspectRatio="none"
            onPointerDown={(e) => updateActiveFromClientX(e.clientX)}
            onPointerMove={(e) => {
              if (e.buttons === 1) updateActiveFromClientX(e.clientX);
            }}
          >
            <defs>
              {splitAtZero ? (
                <>
                  <linearGradient id={positiveGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={POSITIVE_COLOR} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={POSITIVE_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={negativeGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEGATIVE_COLOR} stopOpacity={0} />
                    <stop offset="100%" stopColor={NEGATIVE_COLOR} stopOpacity={0.25} />
                  </linearGradient>
                </>
              ) : (
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              )}
            </defs>
            {showZeroLine && (
              <line
                x1={0}
                x2={WIDTH}
                y1={zeroY}
                y2={zeroY}
                stroke="#e5e7eb"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            {referenceY !== null && (
              <line
                x1={0}
                x2={WIDTH}
                y1={referenceY}
                y2={referenceY}
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            {zeroSegments ? (
              <>
                {zeroSegments.map((s, i) => (
                  <path
                    key={`area-${i}`}
                    d={`M${s.x1.toFixed(2)},${s.y1.toFixed(2)} L${s.x2.toFixed(2)},${s.y2.toFixed(2)} L${s.x2.toFixed(2)},${zeroY.toFixed(2)} L${s.x1.toFixed(2)},${zeroY.toFixed(2)} Z`}
                    fill={`url(#${s.positive ? positiveGradientId : negativeGradientId})`}
                  />
                ))}
                {zeroSegments.map((s, i) => (
                  <path
                    key={`line-${i}`}
                    d={`M${s.x1.toFixed(2)},${s.y1.toFixed(2)} L${s.x2.toFixed(2)},${s.y2.toFixed(2)}`}
                    fill="none"
                    stroke={s.positive ? POSITIVE_COLOR : NEGATIVE_COLOR}
                    strokeWidth={2}
                  />
                ))}
              </>
            ) : (
              <>
                <path d={areaPath} fill={`url(#${gradientId})`} />
                <path d={linePath} fill="none" stroke={signColor} strokeWidth={2} />
              </>
            )}
            <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={latestColor} />

            {tickIndices.map((i) => (
              <g key={i}>
                <line
                  x1={points[i].x}
                  x2={points[i].x}
                  y1={CHART_HEIGHT}
                  y2={CHART_HEIGHT + 4}
                  stroke="#d1d5db"
                  strokeWidth={1}
                />
                <text
                  x={points[i].x}
                  y={CHART_HEIGHT + 18}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#9ca3af"
                >
                  {formatJstMonthDay(data[i].date)}
                </text>
              </g>
            ))}

            {active && (
              <g style={{ pointerEvents: "none" }}>
                <line
                  x1={active.point.x}
                  x2={active.point.x}
                  y1={0}
                  y2={CHART_HEIGHT}
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={active.point.x}
                  cy={active.point.y}
                  r={5}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={1.5}
                />
              </g>
            )}
          </svg>
          {referenceY !== null && referenceLine && (
            <span
              className="pointer-events-none absolute right-1 -translate-y-1/2 rounded bg-white/80 px-1 text-[10px] font-medium text-gray-500"
              style={{ top: `${(referenceY / HEIGHT) * 100}%` }}
            >
              {referenceLine.label} {referenceLine.value.toLocaleString()}
            </span>
          )}
          {active && (
            <div
              className="pointer-events-none absolute rounded-md bg-red-500 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-sm"
              style={{
                left: `${(active.point.x / WIDTH) * 100}%`,
                top: `${(active.point.y / HEIGHT) * 100}%`,
                transform: `translate(${active.point.x > WIDTH * 0.7 ? "-100%" : "-50%"}, -130%)`,
              }}
            >
              {formatJstMonthDay(active.row.date)}：{active.row.total.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
