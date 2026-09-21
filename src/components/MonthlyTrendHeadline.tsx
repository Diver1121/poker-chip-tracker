import { formatPercentSigned, signColorClass } from "@/lib/statsFormat";

// 「今月の値 + 先月比」を見出しとして表示する小さな部品。
// 店全体の売上推移・客ごとの利用推移の両方で同じ見た目に揃えるために共通化している。
export function MonthlyTrendHeadline({
  monthLabel,
  value,
  unit,
  changePercent,
  changeNote,
}: {
  monthLabel: string;
  value: number;
  unit: string;
  changePercent: number | null;
  // 「前月比」の但し書き（例: 今月がまだ途中の場合の「同日時点比」の注記）。
  changeNote?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="text-xs text-gray-500">{monthLabel}</p>
      <p className="text-2xl font-bold text-gray-900">
        {value.toLocaleString()}
        <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>
      </p>
      {changePercent !== null ? (
        <span className={`text-sm font-medium ${signColorClass(changePercent)}`}>
          {changePercent > 0 ? "▲" : changePercent < 0 ? "▼" : "―"}{" "}
          {formatPercentSigned(changePercent)}
          <span className="ml-1 text-xs font-normal text-gray-400">
            {changeNote ?? "前月比"}
          </span>
        </span>
      ) : (
        <span className="text-xs text-gray-400">前月データなし</span>
      )}
    </div>
  );
}
