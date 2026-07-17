// 外部ライブラリなしで折れ線グラフを描く軽量SVGコンポーネント。
// data は時系列順で渡すこと。totalの推移を1本の線＋グラデーション塗りで表示する。

const WIDTH = 600;
const HEIGHT = 160;

export function LineChart({
  data,
  color = "#4f46e5",
  gradientId,
}: {
  data: { date: string; total: number }[];
  color?: string;
  gradientId: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">データがありません。</p>;
  }

  const values = data.map((d) => d.total);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
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
          <line
            x1={0}
            x2={WIDTH}
            y1={zeroY}
            y2={zeroY}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
          <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} />
        </svg>
      </div>
    </div>
  );
}
