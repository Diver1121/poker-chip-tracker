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
