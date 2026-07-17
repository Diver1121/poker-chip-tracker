// 複数系列を重ねて描く軽量SVG折れ線グラフ。外部ライブラリなし。
// 全系列の日付集合を横軸として統合し、系列ごとに値が無い日は線をつながず飛ばす。

const WIDTH = 600;
const HEIGHT = 200;

export type MultiLineSeries = {
  key: string;
  label: string;
  color: string;
  data: { date: string; value: number }[];
};

export function MultiLineChart({ series }: { series: MultiLineSeries[] }) {
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

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-48 w-full"
        preserveAspectRatio="none"
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
        {series.map((s) => {
          const valueByDate = new Map(s.data.map((d) => [d.date, d.value]));
          const points = allDates
            .filter((date) => valueByDate.has(date))
            .map((date) => ({ x: xForDate(date), y: yForValue(valueByDate.get(date)!) }));
          if (points.length === 0) return null;
          const path = points
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(" ");
          return (
            <path
              key={s.key}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
