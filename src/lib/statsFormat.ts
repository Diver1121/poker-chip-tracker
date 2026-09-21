// レーキ等の数値表示: プラスは青、マイナスは赤、0はグレーで表示して符号がひと目でわかるようにする
export function signColorClass(n: number): string {
  if (n > 0) return "text-blue-600";
  if (n < 0) return "text-red-600";
  return "text-gray-400";
}

export function formatSigned(n: number): string {
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

export function monthLabelOf(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}年${Number(m)}月`;
}

// 前月比などの増減率（%）。基準値が0だと算出できないためnullを返す
// （0→何かへの変化は「無限%増」になってしまい意味のある数字にならないため）。
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPercentSigned(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return rounded > 0 ? `+${rounded.toFixed(1)}%` : `${rounded.toFixed(1)}%`;
}

// 日別合計マップ（date -> value, dateは"YYYY-MM-DD"）から、指定した月の1日目〜maxDay日目
// までの合計だけを取り出す。進行中の今月と先月をフェアに比べるために使う
// （先月の月末までの合計とそのまま比べると、月の前半ほど不当に「減っている」ように見えるため）。
export function sumThroughDay(
  dailyTotals: Map<string, number>,
  monthKey: string,
  maxDay: number,
): number {
  let sum = 0;
  for (const [date, value] of dailyTotals) {
    if (!date.startsWith(monthKey)) continue;
    if (Number(date.slice(8, 10)) <= maxDay) sum += value;
  }
  return sum;
}
