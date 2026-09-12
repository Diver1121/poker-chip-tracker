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
