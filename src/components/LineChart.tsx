// 外部ライブラリなしで折れ線グラフを描く軽量SVGコンポーネント。
// data は時系列順で渡すこと。totalの推移を1本の線＋グラデーション塗りで表示する。

const WIDTH = 600;
const HEIGHT = 160;

export function LineChart({
  data,
  color = "#4f46e5",
  gradientId,
  zoomToData = false,
  referenceLine,
}: {
  data: { date: string; total: number }[];
  color?: string;
  gradientId: string;
  // trueの場合、0を基準にせず実データ（+基準線）の範囲だけで拡大表示する。
  // 値が常に大きい（0付近に来ない）指標だと、0基準だと変動がほぼ見えなくなるため。
  zoomToData?: boolean;
  // 基準線（例：営業開始時点の値）を破線で表示する。
  referenceLine?: { label: string; value: number };
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const values = data.map((d) => d.total);
  const candidateValues = referenceLine ? [...values, referenceLine.value] : values;
  const min = zoomToData ? Math.min(...candidateValues) : Math.min(0, ...candidateValues);
  const max = zoomToData ? Math.max(...candidateValues) : Math.max(0, ...candidateValues);
  const range = max - min || 1;
  const latest = data[data.length - 1].total;

  const points = data.map((d, i) => {
    const x = data.length === 1 ? WIDTH / 2 : (i / (data.length - 1)) * WIDTH;
    const y = HEIGHT - ((d.total - min) / range) * HEIGHT;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${HEIGHT} L0,${HEIGHT} Z`;
  const zeroY = HEIGHT - ((0 - min) / range) * HEIGHT;
  const showZeroLine = min < 0 && max > 0;
  const referenceY =
    referenceLine != null ? HEIGHT - ((referenceLine.value - min) / range) * HEIGHT : null;
  const lastPoint = points[points.length - 1];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-2xl font-bold text-gray-900">
          {latest.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-gray-500">現在値</span>
        </p>
        <p className="text-xs text-gray-500">
          最大 {max.toLocaleString()} ／ 最小 {min.toLocaleString()}
        </p>
      </div>
      <div className="flex gap-2">
        <div className="relative w-14 shrink-0 text-right text-xs text-gray-400" style={{ height: HEIGHT }}>
          <span className="absolute top-0 right-0">{max.toLocaleString()}</span>
          {showZeroLine && (
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
            className="h-40 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
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
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
            <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} />
          </svg>
          {referenceY !== null && referenceLine && (
            <span
              className="pointer-events-none absolute right-1 -translate-y-1/2 rounded bg-white/80 px-1 text-[10px] font-medium text-gray-500"
              style={{ top: `${(referenceY / HEIGHT) * 100}%` }}
            >
              {referenceLine.label} {referenceLine.value.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
