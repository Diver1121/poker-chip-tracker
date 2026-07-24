const JST_OFFSET_MINUTES = 9 * 60;
const BUSINESS_DAY_CUTOFF_HOUR = 5;

function toJstDate(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MINUTES * 60 * 1000);
}

// 朝5時を営業日の区切りとする。5時より前の時刻は前日の営業日として扱う。
// 「営業終了・まとめて退店」ボタンで区切られる想定の1営業日をこのキーで表す。
export function businessDateKey(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const jst = toJstDate(date);
  if (jst.getUTCHours() < BUSINESS_DAY_CUTOFF_HOUR) {
    jst.setUTCDate(jst.getUTCDate() - 1);
  }
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// businessDateKeyの月部分（"YYYY-MM"）。レーキグラフの月切り替えに使う。
export function businessMonthKey(input: string | Date): string {
  return businessDateKey(input).slice(0, 7);
}

// "YYYY-MM"をdelta月ぶんずらす（delta=-1で前月、+1で翌月）。
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// "YYYY-MM"の月に含まれる日付（"YYYY-MM-DD"）を1日から月末まで列挙する。
// レーキグラフで、取引が無い日も0本の棒として表示するために使う。
export function daysInMonth(monthKey: string): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from(
    { length: lastDay },
    (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`,
  );
}

// グラフの横軸ラベル用: 日時文字列（ISO日時 or "YYYY-MM-DD"）-> JSTの "M/D" 表記
export function formatJstMonthDay(input: string): string {
  const jst = toJstDate(new Date(input));
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}

// ISO文字列(UTC) -> <input type="datetime-local"> 用のJST文字列 "YYYY-MM-DDTHH:mm"
export function toJstDatetimeLocal(isoString: string): string {
  const jst = toJstDate(new Date(isoString));
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hours = String(jst.getUTCHours()).padStart(2, "0");
  const minutes = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// <input type="datetime-local"> の値（JSTのつもりで入力された値） -> ISO文字列(UTC)
// サーバーのタイムゾーン設定に依存しないよう、日時の各要素を手計算でUTCに変換する。
export function fromJstDatetimeLocal(localString: string): string {
  const [datePart, timePart] = localString.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute) - JST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs).toISOString();
}
