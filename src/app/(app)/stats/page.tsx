import Link from "next/link";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import {
  getAllTransactions,
  getAllVisits,
  getDenominations,
  getShopSettings,
  getTournamentEntries,
  getTournaments,
} from "@/lib/data";
import {
  computeDailyPokerOperatingMinutes,
  computeDailyRakeTotals,
  computeDailyTotals,
  computeDailyVisitCounts,
} from "@/lib/balances";
import { businessDateKey, businessMonthKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import { PurchaseBreakdownSection } from "@/components/PurchaseBreakdownSection";
import type { TournamentEntry } from "@/lib/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// レーキ表: プラスは青、マイナスは赤、0はグレーで表示して符号がひと目でわかるようにする
function signColorClass(n: number): string {
  if (n > 0) return "text-blue-600";
  if (n < 0) return "text-red-600";
  return "text-gray-400";
}
function formatSigned(n: number): string {
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

type TournamentSessionSummary = {
  participationRate: number | null;
  participantCount: number;
  addonRate: number | null;
  addonParticipantCount: number;
  cashRate: number | null;
  cashParticipantCount: number;
  entryCount: number;
  totals: {
    entryFee: number;
    cash: number;
    chip: number;
    ticket: number;
    addonCash: number;
    addon: number;
    prize: number;
  };
};

// トーナメントの回ごとに、参加率・アドオン率・現金エントリー率・合計値を集計する。
// 参加率の分母(dayVisitCustomerIds)はその営業日にチェックインした客の集合を共有し、
// 分子はその回にエントリーした客だけを数える（回ごとに独立させるため）。
function summarizeTournamentSession(
  sessionEntries: TournamentEntry[],
  dayVisitCustomerIds: Set<string>,
): TournamentSessionSummary {
  const participantCustomerIds = new Set(
    sessionEntries.map((e) => e.customer_id).filter((id): id is string => Boolean(id)),
  );
  const participationRate =
    dayVisitCustomerIds.size > 0 ? participantCustomerIds.size / dayVisitCustomerIds.size : null;

  const entryCount = sessionEntries.length;
  const addonParticipantCount = sessionEntries.filter((e) => e.addon_count >= 1).length;
  const addonRate = entryCount > 0 ? addonParticipantCount / entryCount : null;
  const cashParticipantCount = sessionEntries.filter((e) => e.cash_amount >= 1).length;
  const cashRate = entryCount > 0 ? cashParticipantCount / entryCount : null;

  const totals = sessionEntries.reduce(
    (acc, e) => ({
      entryFee: acc.entryFee + e.entry_fee,
      cash: acc.cash + e.cash_amount,
      chip: acc.chip + e.chip_amount,
      ticket: acc.ticket + e.ticket_amount,
      addonCash: acc.addonCash + e.addon_cash_amount,
      addon: acc.addon + e.addon_amount,
      prize: acc.prize + e.prize_amount,
    }),
    { entryFee: 0, cash: 0, chip: 0, ticket: 0, addonCash: 0, addon: 0, prize: 0 },
  );

  return {
    participationRate,
    participantCount: participantCustomerIds.size,
    addonRate,
    addonParticipantCount,
    cashRate,
    cashParticipantCount,
    entryCount,
    totals,
  };
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tMonth?: string; tDate?: string }>;
}) {
  const [
    { month, tMonth, tDate },
    transactions,
    denominations,
    visits,
    shopSettings,
    tournamentEntries,
    tournaments,
  ] = await Promise.all([
    searchParams,
    getAllTransactions(),
    getDenominations(),
    getAllVisits(),
    getShopSettings(),
    getTournamentEntries(),
    getTournaments(),
  ]);
  const dailyTotals = computeDailyTotals(transactions, denominations);
  const shopCurrentTotal =
    dailyTotals.length > 0 ? dailyTotals[dailyTotals.length - 1].total : 0;

  const todayKey = businessDateKey(new Date());
  // レーキグラフ: 月切り替え（未来月には行けない）＋ 月内の全日を0埋めして棒を揃える。
  const currentMonthKey = businessMonthKey(new Date());
  const requestedMonthKey =
    month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthKey;
  const monthKey = requestedMonthKey > currentMonthKey ? currentMonthKey : requestedMonthKey;
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const nextMonthKey = shiftMonthKey(monthKey, 1);
  const canGoNext = nextMonthKey <= currentMonthKey;
  const [monthYearPart, monthNumPart] = monthKey.split("-");
  const monthLabel = `${monthYearPart}年${Number(monthNumPart)}月`;

  // 退店処理（営業終了・まとめて退店）が押されるまで、当日分はまだプレイ中で
  // 未回収のチップを含んでしまうため「未確定」として0のまま表示する。
  const todayClosed = Boolean(
    shopSettings.lastClosedAt && businessDateKey(shopSettings.lastClosedAt) === todayKey,
  );
  const dailyRakeByDate = new Map(
    computeDailyRakeTotals(transactions, denominations).map((d) => [d.date, d]),
  );
  // 来店数はレーキ表に合体させ、日ごとの動きを1つの表でまとめて見られるようにする
  // （営業終了前でも実際の来店数をそのまま表示してよいので、finalizedの判定は適用しない）。
  const dailyVisitCountByDate = new Map(
    computeDailyVisitCounts(visits).map((d) => [d.date, d.count]),
  );
  const dailyPokerOperatingMinutesByDate = computeDailyPokerOperatingMinutes(transactions);
  const rakeTableData = daysInMonth(monthKey).map((date) => {
    const finalized = date !== todayKey || todayClosed;
    const daily = dailyRakeByDate.get(date);
    const [rYear, rMonth, rDay] = date.split("-").map(Number);
    const weekday = WEEKDAY_LABELS[new Date(Date.UTC(rYear, rMonth - 1, rDay)).getUTCDay()];
    const rakeWithTournament = finalized ? (daily?.rakeWithTournament ?? 0) : 0;
    const operatingMinutes = finalized ? (dailyPokerOperatingMinutesByDate.get(date) ?? null) : null;
    return {
      date,
      day: rDay,
      weekday,
      visitCount: dailyVisitCountByDate.get(date) ?? 0,
      rakeWithTournament,
      operatingMinutes,
      // 稼働時間1時間あたりのレーキ。稼働時間が無い日（アウト未入力・未確定日）は算出不可。
      rakePerHour:
        operatingMinutes && operatingMinutes > 0
          ? (rakeWithTournament / operatingMinutes) * 60
          : null,
    };
  });
  const monthlyRakeWithTournamentTotal = rakeTableData.reduce(
    (sum, d) => sum + d.rakeWithTournament,
    0,
  );
  const monthlyVisitCountTotal = rakeTableData.reduce((sum, d) => sum + d.visitCount, 0);
  const monthlyAvgOperatingMinutes = average(
    rakeTableData
      .map((d) => d.operatingMinutes)
      .filter((m): m is number => m !== null),
  );
  const monthlyAvgRakePerHour = average(
    rakeTableData
      .map((d) => d.rakePerHour)
      .filter((r): r is number => r !== null),
  );

  // トーナメント欄: 「記録保存」された tournament_entries を営業日ごとにまとめ、
  // カレンダーで過去を振り返れるようにする。
  const entriesByDay = new Map<string, typeof tournamentEntries>();
  for (const entry of tournamentEntries) {
    const key = businessDateKey(entry.created_at);
    const list = entriesByDay.get(key) ?? [];
    list.push(entry);
    entriesByDay.set(key, list);
  }
  const dayKeysWithEntries = [...entriesByDay.keys()].sort();

  const entriesByTournamentId = new Map<string, typeof tournamentEntries>();
  for (const entry of tournamentEntries) {
    if (!entry.tournament_id) continue;
    const list = entriesByTournamentId.get(entry.tournament_id) ?? [];
    list.push(entry);
    entriesByTournamentId.set(entry.tournament_id, list);
  }
  const latestDayKeyWithEntries = dayKeysWithEntries[dayKeysWithEntries.length - 1] ?? null;

  const requestedTMonthKey =
    tMonth && /^\d{4}-\d{2}$/.test(tMonth)
      ? tMonth
      : (latestDayKeyWithEntries?.slice(0, 7) ?? currentMonthKey);
  const tMonthKey = requestedTMonthKey > currentMonthKey ? currentMonthKey : requestedTMonthKey;
  const prevTMonthKey = shiftMonthKey(tMonthKey, -1);
  const nextTMonthKey = shiftMonthKey(tMonthKey, 1);
  const canGoNextT = nextTMonthKey <= currentMonthKey;
  const [tMonthYearPart, tMonthNumPart] = tMonthKey.split("-");
  const tMonthLabel = `${tMonthYearPart}年${Number(tMonthNumPart)}月`;

  const tMonthDays = daysInMonth(tMonthKey);
  const firstWeekday = new Date(
    Date.UTC(Number(tMonthYearPart), Number(tMonthNumPart) - 1, 1),
  ).getUTCDay();

  const latestDayInDisplayedMonth =
    dayKeysWithEntries.filter((k) => tMonthDays.includes(k)).pop() ?? null;
  const requestedTDateKey = tDate && /^\d{4}-\d{2}-\d{2}$/.test(tDate) ? tDate : null;
  const selectedDayKey =
    requestedTDateKey ?? latestDayInDisplayedMonth ?? latestDayKeyWithEntries ?? todayKey;

  function statsHref(next: { month?: string; tMonth?: string; tDate?: string }) {
    const params = new URLSearchParams();
    params.set("month", next.month ?? monthKey);
    params.set("tMonth", next.tMonth ?? tMonthKey);
    const dateValue = next.tDate ?? selectedDayKey;
    if (dateValue) params.set("tDate", dateValue);
    return `/stats?${params.toString()}`;
  }

  // トーナメントの月間平均。参加率は営業日単位のチェックイン客数を分母にするため、
  // 回（セッション）ごとにその開催日のチェックイン客集合を求めてから平均する。
  // tournament_idが無い古いデータ（未分類扱い）はどの回にも属さないため平均には含めない。
  const tMonthSessions = tournaments.filter((t) =>
    tMonthDays.includes(businessDateKey(t.created_at)),
  );
  const tMonthSessionSummaries = tMonthSessions.map((t) => {
    const sessionDayKey = businessDateKey(t.created_at);
    const sessionDayVisitCustomerIds = new Set(
      visits
        .filter((v) => businessDateKey(v.checked_in_at) === sessionDayKey)
        .map((v) => v.customer_id),
    );
    return summarizeTournamentSession(
      entriesByTournamentId.get(t.id) ?? [],
      sessionDayVisitCustomerIds,
    );
  });
  const tMonthSessionCount = tMonthSessionSummaries.length;
  const avgParticipationRate = average(
    tMonthSessionSummaries.map((s) => s.participationRate).filter((r): r is number => r !== null),
  );
  const avgAddonRate = average(
    tMonthSessionSummaries.map((s) => s.addonRate).filter((r): r is number => r !== null),
  );
  const avgCashRate = average(
    tMonthSessionSummaries.map((s) => s.cashRate).filter((r): r is number => r !== null),
  );
  const avgEntryCount = average(tMonthSessionSummaries.map((s) => s.entryCount)) ?? 0;
  const avgTotals = {
    entryFee: average(tMonthSessionSummaries.map((s) => s.totals.entryFee)) ?? 0,
    cash: average(tMonthSessionSummaries.map((s) => s.totals.cash)) ?? 0,
    chip: average(tMonthSessionSummaries.map((s) => s.totals.chip)) ?? 0,
    ticket: average(tMonthSessionSummaries.map((s) => s.totals.ticket)) ?? 0,
    addonCash: average(tMonthSessionSummaries.map((s) => s.totals.addonCash)) ?? 0,
    addon: average(tMonthSessionSummaries.map((s) => s.totals.addon)) ?? 0,
    prize: average(tMonthSessionSummaries.map((s) => s.totals.prize)) ?? 0,
  };
  const totalEntryCount = tMonthSessionSummaries.reduce((sum, s) => sum + s.entryCount, 0);
  const sumTotals = {
    entryFee: tMonthSessionSummaries.reduce((sum, s) => sum + s.totals.entryFee, 0),
    cash: tMonthSessionSummaries.reduce((sum, s) => sum + s.totals.cash, 0),
    chip: tMonthSessionSummaries.reduce((sum, s) => sum + s.totals.chip, 0),
    ticket: tMonthSessionSummaries.reduce((sum, s) => sum + s.totals.ticket, 0),
    addonCash: tMonthSessionSummaries.reduce((sum, s) => sum + s.totals.addonCash, 0),
    addon: tMonthSessionSummaries.reduce((sum, s) => sum + s.totals.addon, 0),
    prize: tMonthSessionSummaries.reduce((sum, s) => sum + s.totals.prize, 0),
  };

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">グラフ</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">店全体の保有チップ量（現在）</p>
        <p className="text-3xl font-bold text-indigo-600">
          {shopCurrentTotal.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-gray-500">点</span>
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">店全体の保有点数の推移</h2>
        {dailyTotals.length === 0 ? (
          <p className="text-sm text-gray-500">まだ取引がありません。</p>
        ) : (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <span className="inline-block transition-transform group-open:rotate-90">▶</span>
              日別の内訳を表示
            </summary>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">日付</th>
                      <th className="px-4 py-2 text-right font-medium">増減</th>
                      <th className="px-4 py-2 text-right font-medium">保有点数合計</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...dailyTotals].reverse().map((d) => {
                      const [ty, tm, td] = d.date.split("-").map(Number);
                      return (
                        <tr key={d.date} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-left text-gray-900">
                            {ty}年{tm}月{td}日
                          </td>
                          <td className={`px-4 py-2 text-right ${signColorClass(d.delta)}`}>
                            {formatSigned(d.delta)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {d.total.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">来店数・レーキ</h2>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={statsHref({ month: prevMonthKey })}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前月
              <LinkPendingDot />
            </Link>
            <span className="font-medium text-gray-900">{monthLabel}</span>
            {canGoNext ? (
              <Link
                href={statsHref({ month: nextMonthKey })}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                翌月 →
                <LinkPendingDot />
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-gray-200 px-2 py-1 text-gray-300">
                翌月 →
              </span>
            )}
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          {monthLabel}の月間合計 来店数 {monthlyVisitCountTotal.toLocaleString()}人／店全体 {monthlyRakeWithTournamentTotal.toLocaleString()}点。
          本日分は「営業終了・まとめて退店」を押すまで反映されません。
        </p>
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            日別の内訳を表示
          </summary>
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
                <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">日付</th>
                    <th className="px-4 py-2 text-right font-medium">来店数</th>
                    <th className="px-4 py-2 text-right font-medium">店全体</th>
                    <th className="px-4 py-2 text-right font-medium">ポーカー稼働時間</th>
                    <th className="px-4 py-2 text-right font-medium">1時間あたりレーキ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rakeTableData.map((d) => (
                    <tr key={d.date} className="hover:bg-gray-50">
                      <td
                        className={`px-4 py-2 text-left ${
                          d.weekday === "日" ? "text-red-500" : d.weekday === "土" ? "text-blue-500" : "text-gray-900"
                        }`}
                      >
                        {d.day}日（{d.weekday}）
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {d.visitCount > 0 ? d.visitCount.toLocaleString() : "-"}
                      </td>
                      <td
                        className={`px-4 py-2 text-right ${signColorClass(d.rakeWithTournament)}`}
                      >
                        {formatSigned(d.rakeWithTournament)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {d.operatingMinutes === null ? "-" : formatMinutes(d.operatingMinutes)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right ${
                          d.rakePerHour === null ? "text-gray-400" : signColorClass(d.rakePerHour)
                        }`}
                      >
                        {d.rakePerHour === null ? "-" : formatSigned(Math.round(d.rakePerHour))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-gray-50">
                  <tr className="border-t border-gray-200 font-bold">
                    <td className="px-4 py-2 text-left text-gray-900">合計</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {monthlyVisitCountTotal.toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${signColorClass(monthlyRakeWithTournamentTotal)}`}
                    >
                      {formatSigned(monthlyRakeWithTournamentTotal)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {monthlyAvgOperatingMinutes === null
                        ? "-"
                        : `平均 ${formatMinutes(Math.round(monthlyAvgOperatingMinutes))}`}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        monthlyAvgRakePerHour === null ? "text-gray-400" : signColorClass(monthlyAvgRakePerHour)
                      }`}
                    >
                      {monthlyAvgRakePerHour === null
                        ? "-"
                        : `平均 ${formatSigned(Math.round(monthlyAvgRakePerHour))}`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </details>
      </section>

      <PurchaseBreakdownSection
        transactions={transactions}
        denominations={denominations}
        currentMonthKey={currentMonthKey}
      />

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">トーナメント</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              カレンダーは「記録保存」された日の目安です。下は{tMonthLabel}の月間平均です。
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={statsHref({ tMonth: prevTMonthKey })}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前月
              <LinkPendingDot />
            </Link>
            <span className="font-medium text-gray-900">{tMonthLabel}</span>
            {canGoNextT ? (
              <Link
                href={statsHref({ tMonth: nextTMonthKey })}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                翌月 →
                <LinkPendingDot />
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-gray-200 px-2 py-1 text-gray-300">
                翌月 →
              </span>
            )}
          </div>
        </div>

        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            カレンダーを表示
          </summary>
          <div className="mt-3 grid grid-cols-7 gap-1 rounded-lg border border-gray-200 bg-white p-3 text-center text-xs">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="py-1 font-medium text-gray-400">
                {w}
              </div>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {tMonthDays.map((dayKey) => {
              const dayEntries = entriesByDay.get(dayKey) ?? [];
              const hasEntries = dayEntries.length > 0;
              const isSelected = dayKey === selectedDayKey;
              const dayNum = Number(dayKey.slice(-2));
              return (
                <Link
                  key={dayKey}
                  href={statsHref({ tDate: dayKey })}
                  className={`flex flex-col items-center rounded-md py-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : hasEntries
                        ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        : "text-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <span>
                    {dayNum}
                    <LinkPendingDot />
                  </span>
                  {hasEntries && (
                    <span
                      className={`mt-0.5 text-[10px] ${
                        isSelected ? "text-indigo-100" : "text-indigo-500"
                      }`}
                    >
                      {dayEntries.length}名
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </details>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-bold text-gray-900">
            {tMonthLabel}の月間平均
            <span className="ml-1 font-normal text-gray-400">（{tMonthSessionCount}回開催）</span>
          </h3>
          {tMonthSessionCount === 0 ? (
            <p className="mt-2 text-sm text-gray-500">この月の記録はありません。</p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">平均参加率</p>
                  <p className="text-lg font-bold text-gray-900">
                    {avgParticipationRate === null
                      ? "-"
                      : `${Math.round(avgParticipationRate * 100)}%`}
                  </p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">平均アドオン率</p>
                  <p className="text-lg font-bold text-gray-900">
                    {avgAddonRate === null ? "-" : `${Math.round(avgAddonRate * 100)}%`}
                  </p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">平均現金エントリー率</p>
                  <p className="text-lg font-bold text-gray-900">
                    {avgCashRate === null ? "-" : `${Math.round(avgCashRate * 100)}%`}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="px-2 py-1 font-medium"></th>
                      <th className="px-2 py-1 font-medium">エントリー数</th>
                      <th className="px-2 py-1 font-medium">エントリー</th>
                      <th className="px-2 py-1 font-medium">現金</th>
                      <th className="px-2 py-1 font-medium">チップ</th>
                      <th className="px-2 py-1 font-medium">チケット</th>
                      <th className="px-2 py-1 font-medium">アドオン現金</th>
                      <th className="px-2 py-1 font-medium">アドオン</th>
                      <th className="px-2 py-1 font-medium">獲得</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-2 py-1 font-medium text-gray-500">月合計</td>
                      <td className="px-2 py-1 text-gray-900">
                        {totalEntryCount.toLocaleString()}人
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {sumTotals.entryFee.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">{sumTotals.cash.toLocaleString()}</td>
                      <td className="px-2 py-1 text-gray-900">{sumTotals.chip.toLocaleString()}</td>
                      <td className="px-2 py-1 text-gray-900">
                        {sumTotals.ticket.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {sumTotals.addonCash.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {sumTotals.addon.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {sumTotals.prize.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-medium text-gray-500">月平均</td>
                      <td className="px-2 py-1 text-gray-900">{avgEntryCount.toFixed(1)}人</td>
                      <td className="px-2 py-1 text-gray-900">
                        {Math.round(avgTotals.entryFee).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {Math.round(avgTotals.cash).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {Math.round(avgTotals.chip).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {Math.round(avgTotals.ticket).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {Math.round(avgTotals.addonCash).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {Math.round(avgTotals.addon).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-gray-900">
                        {Math.round(avgTotals.prize).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
