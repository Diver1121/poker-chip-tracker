// チップ保有期間（来店最終日から1年）にまつわる判定ロジック。
// 実際の削除はスタッフの確認操作を経て行う（自動では消さない）。

const DAY_MS = 24 * 60 * 60 * 1000;

export const CHIP_RETENTION_DAYS = 365;
export const RETENTION_WARNING_DAYS = 30;

export function retentionDueAt(lastVisitIso: string): Date {
  return new Date(new Date(lastVisitIso).getTime() + CHIP_RETENTION_DAYS * DAY_MS);
}

// 来店から1年経過し、消去対象になっているか
export function isPastRetention(lastVisitIso: string, now: Date = new Date()): boolean {
  return now.getTime() >= retentionDueAt(lastVisitIso).getTime();
}

// 消去まで1ヶ月以内（かつまだ消去対象ではない）か
export function isNearRetention(lastVisitIso: string, now: Date = new Date()): boolean {
  const dueAt = retentionDueAt(lastVisitIso).getTime();
  const warnAt = dueAt - RETENTION_WARNING_DAYS * DAY_MS;
  const nowMs = now.getTime();
  return nowMs >= warnAt && nowMs < dueAt;
}

export function daysUntil(target: Date, now: Date = new Date()): number {
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}
