import Link from "next/link";
import {
  getAllTransactions,
  getAllVisits,
  getCustomers,
  getDenominations,
  getShopSettings,
  getTournamentEntries,
  getTournaments,
} from "@/lib/data";
import {
  computeDailyRakeTotals,
  computeDailyTotals,
  computeDailyVisitCounts,
  computeVisitCountsByCustomer,
} from "@/lib/balances";
import { businessDateKey, businessMonthKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import { LineChart } from "@/components/LineChart";
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

// 日別詳細の1回ぶん（参加率などのカード＋エントリー表）。複数の回が並行していた日は
// これを回ごとに繰り返し描画する。
function TournamentSessionCard({
  label,
  denomLabel,
  summary,
  entries,
}: {
  label: string;
  denomLabel: string;
  summary: TournamentSessionSummary;
  entries: TournamentEntry[];
}) {
  return (
    <div>
      <h4 className="text-sm font-bold text-gray-900">
        {label}
        <span className="ml-1 font-normal text-gray-400">・{denomLabel}</span>
      </h4>

      <div className="mt-2 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500">参加率</p>
          <p className="text-lg font-bold text-gray-900">
            {summary.participationRate === null
              ? "-"
              : `${Math.round(summary.participationRate * 100)}%`}
          </p>
          <p className="text-[10px] text-gray-400">{summary.participantCount}名</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500">アドオン率</p>
          <p className="text-lg font-bold text-gray-900">
            {summary.addonRate === null ? "-" : `${Math.round(summary.addonRate * 100)}%`}
          </p>
          <p className="text-[10px] text-gray-400">
            {summary.addonParticipantCount}/{summary.entryCount}名
          </p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500">現金エントリー率</p>
          <p className="text-lg font-bold text-gray-900">
            {summary.cashRate === null ? "-" : `${Math.round(summary.cashRate * 100)}%`}
          </p>
          <p className="text-[10px] text-gray-400">
            {summary.cashParticipantCount}/{summary.entryCount}名
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-gray-500">
            <tr>
              <th className="px-2 py-1 font-medium">NAME</th>
              <th className="px-2 py-1 font-medium">エントリー</th>
              <th className="px-2 py-1 font-medium">現金</th>
              <th className="px-2 py-1 font-medium">チップ</th>
              <th className="px-2 py-1 font-medium">チケット</th>
              <th className="px-2 py-1 font-medium">アドオン現金</th>
              <th className="px-2 py-1 font-medium">アドオン</th>
              <th className="px-2 py-1 font-medium">順位</th>
              <th className="px-2 py-1 font-medium">獲得</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-2 py-1 text-gray-900">{e.name}</td>
                <td className="px-2 py-1 text-gray-900">{e.entry_fee.toLocaleString()}</td>
                <td className="px-2 py-1 text-gray-900">{e.cash_amount.toLocaleString()}</td>
                <td className="px-2 py-1 text-gray-900">{e.chip_amount.toLocaleString()}</td>
                <td className="px-2 py-1 text-gray-900">{e.ticket_amount.toLocaleString()}</td>
                <td className="px-2 py-1 text-gray-900">
                  {e.addon_cash_amount.toLocaleString()}
                </td>
                <td className="px-2 py-1 text-gray-900">{e.addon_amount.toLocaleString()}</td>
                <td className="px-2 py-1 text-gray-900">{e.rank ?? "-"}</td>
                <td className="px-2 py-1 text-gray-900">{e.prize_amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-bold text-gray-900">
              <td className="px-2 py-1">合計</td>
              <td className="px-2 py-1">{summary.totals.entryFee.toLocaleString()}</td>
              <td className="px-2 py-1">{summary.totals.cash.toLocaleString()}</td>
              <td className="px-2 py-1">{summary.totals.chip.toLocaleString()}</td>
              <td className="px-2 py-1">{summary.totals.ticket.toLocaleString()}</td>
              <td className="px-2 py-1">{summary.totals.addonCash.toLocaleString()}</td>
              <td className="px-2 py-1">{summary.totals.addon.toLocaleString()}</td>
              <td className="px-2 py-1" />
              <td className="px-2 py-1">{summary.totals.prize.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
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
    customers,
    shopSettings,
    tournamentEntries,
    tournaments,
  ] = await Promise.all([
    searchParams,
    getAllTransactions(),
    getDenominations(),
    getAllVisits(),
    getCustomers(),
    getShopSettings(),
    getTournamentEntries(),
    getTournaments(),
  ]);
  const denominationLabelById = new Map(denominations.map((d) => [d.id, d.label]));

  const dailyTotals = computeDailyTotals(transactions, denominations);
  const shopCurrentTotal =
    dailyTotals.length > 0 ? dailyTotals[dailyTotals.length - 1].total : 0;

  // 「営業開始時点」の基準線：当営業日（朝5時区切り）が始まった時点の保有点数。
  // 当日分の増減（delta）を現在値から差し引くことで求める。
  const todayKey = businessDateKey(new Date());
  const lastDaily = dailyTotals[dailyTotals.length - 1];
  const businessStartTotal =
    lastDaily && lastDaily.date === todayKey ? lastDaily.total - lastDaily.delta : shopCurrentTotal;
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
  const rakeTableData = daysInMonth(monthKey).map((date) => {
    const finalized = date !== todayKey || todayClosed;
    const daily = dailyRakeByDate.get(date);
    const [rYear, rMonth, rDay] = date.split("-").map(Number);
    const weekday = WEEKDAY_LABELS[new Date(Date.UTC(rYear, rMonth - 1, rDay)).getUTCDay()];
    return {
      date,
      day: rDay,
      weekday,
      visitCount: dailyVisitCountByDate.get(date) ?? 0,
      rake: finalized ? (daily?.rake ?? 0) : 0,
      tournamentChipUsage: finalized ? (daily?.tournamentTotal ?? 0) : 0,
      // トーナメント単体の純レーキ（使用額からプライズ払い出し分を差し引いたもの）
      tournamentRake: finalized ? (daily?.tournamentTotal ?? 0) - (daily?.prizeTotal ?? 0) : 0,
      rakeWithTournament: finalized ? (daily?.rakeWithTournament ?? 0) : 0,
    };
  });
  const monthlyRakeWithTournamentTotal = rakeTableData.reduce(
    (sum, d) => sum + d.rakeWithTournament,
    0,
  );
  const monthlyRakeTotal = rakeTableData.reduce((sum, d) => sum + d.rake, 0);
  const monthlyTournamentChipUsageTotal = rakeTableData.reduce(
    (sum, d) => sum + d.tournamentChipUsage,
    0,
  );
  const monthlyTournamentRakeTotal = rakeTableData.reduce(
    (sum, d) => sum + d.tournamentRake,
    0,
  );
  const monthlyVisitCountTotal = rakeTableData.reduce((sum, d) => sum + d.visitCount, 0);

  const visitCountsByCustomer = computeVisitCountsByCustomer(visits);

  const topVisitors = customers
    .map((c) => ({ customer: c, count: visitCountsByCustomer.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

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

  // 同じ営業日に複数のトーナメント(回)が並行していた場合に、日別詳細を回ごとに
  // 分けて表示するためのグルーピング。
  const sessionsByDay = new Map<string, typeof tournaments>();
  for (const t of tournaments) {
    const key = businessDateKey(t.created_at);
    const list = sessionsByDay.get(key) ?? [];
    list.push(t);
    sessionsByDay.set(key, list);
  }
  for (const list of sessionsByDay.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }
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
  const [selYearPart, selMonthPart, selDayPart] = selectedDayKey.split("-").map(Number);
  const selectedWeekday =
    WEEKDAY_LABELS[new Date(Date.UTC(selYearPart, selMonthPart - 1, selDayPart)).getUTCDay()];
  const selectedDayLabel = `${selYearPart}年${selMonthPart}月${selDayPart}日（${selectedWeekday}）`;

  function statsHref(next: { month?: string; tMonth?: string; tDate?: string }) {
    const params = new URLSearchParams();
    params.set("month", next.month ?? monthKey);
    params.set("tMonth", next.tMonth ?? tMonthKey);
    const dateValue = next.tDate ?? selectedDayKey;
    if (dateValue) params.set("tDate", dateValue);
    return `/stats?${params.toString()}`;
  }

  // その日にチェックインした客の集合。参加率の分母として回ごとに共有する。
  const dayVisitCustomerIds = new Set(
    visits
      .filter((v) => businessDateKey(v.checked_in_at) === selectedDayKey)
      .map((v) => v.customer_id),
  );

  const selectedDaySessions = sessionsByDay.get(selectedDayKey) ?? [];
  // 万一tournament_idがどの回にも一致しない古いデータがあれば「(未分類)」として拾う
  // （通常はバックフィル後に発生しない想定の防御的なフォールバック）。
  const assignedEntryIds = new Set(
    selectedDaySessions.flatMap((t) => (entriesByTournamentId.get(t.id) ?? []).map((e) => e.id)),
  );
  const unassignedEntries = (entriesByDay.get(selectedDayKey) ?? []).filter(
    (e) => !assignedEntryIds.has(e.id),
  );

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
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {dailyTotals.length === 0 ? (
            <p className="text-sm text-gray-500">まだ取引がありません。</p>
          ) : (
            <LineChart
              data={dailyTotals}
              color="#4f46e5"
              gradientId="shopTotalFill"
              zoomToData
              referenceLine={{ label: "営業開始", value: businessStartTotal }}
            />
          )}
        </div>
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
            </Link>
            <span className="font-medium text-gray-900">{monthLabel}</span>
            {canGoNext ? (
              <Link
                href={statsHref({ month: nextMonthKey })}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                翌月 →
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-gray-200 px-2 py-1 text-gray-300">
                翌月 →
              </span>
            )}
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          {monthLabel}の月間合計 来店数 {monthlyVisitCountTotal.toLocaleString()}人／レーキ {monthlyRakeTotal.toLocaleString()}点／トナメ使用数 {monthlyTournamentChipUsageTotal.toLocaleString()}点／トナメレーキ {monthlyTournamentRakeTotal.toLocaleString()}点／総レーキ {monthlyRakeWithTournamentTotal.toLocaleString()}点。
          本日分のレーキは「営業終了・まとめて退店」を押すまで反映されません。
        </p>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">日付</th>
                  <th className="px-4 py-2 text-right font-medium">来店数</th>
                  <th className="px-4 py-2 text-right font-medium">レーキ</th>
                  <th className="px-4 py-2 text-right font-medium">トナメ使用数</th>
                  <th className="px-4 py-2 text-right font-medium">トナメレーキ</th>
                  <th className="px-4 py-2 text-right font-medium">総レーキ</th>
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
                    <td className={`px-4 py-2 text-right ${signColorClass(d.rake)}`}>
                      {formatSigned(d.rake)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${signColorClass(d.tournamentChipUsage)}`}
                    >
                      {formatSigned(d.tournamentChipUsage)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${signColorClass(d.tournamentRake)}`}
                    >
                      {formatSigned(d.tournamentRake)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${signColorClass(d.rakeWithTournament)}`}
                    >
                      {formatSigned(d.rakeWithTournament)}
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
                  <td className={`px-4 py-2 text-right ${signColorClass(monthlyRakeTotal)}`}>
                    {formatSigned(monthlyRakeTotal)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right ${signColorClass(monthlyTournamentChipUsageTotal)}`}
                  >
                    {formatSigned(monthlyTournamentChipUsageTotal)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right ${signColorClass(monthlyTournamentRakeTotal)}`}
                  >
                    {formatSigned(monthlyTournamentRakeTotal)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right ${signColorClass(monthlyRakeWithTournamentTotal)}`}
                  >
                    {formatSigned(monthlyRakeWithTournamentTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">来店頻度ランキング</h2>
        {topVisitors.length === 0 ? (
          <p className="text-sm text-gray-500">まだ来店記録がありません。</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">客</th>
                  <th className="px-4 py-2 font-medium">来店回数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topVisitors.map(({ customer, count }) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-2 text-gray-900">{customer.name}</td>
                    <td className="px-4 py-2 text-gray-900">{count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">トーナメント</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              日付を選ぶと、トーナメントページで「記録保存」した表と参加率などを振り返れます。
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={statsHref({ tMonth: prevTMonthKey })}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前月
            </Link>
            <span className="font-medium text-gray-900">{tMonthLabel}</span>
            {canGoNextT ? (
              <Link
                href={statsHref({ tMonth: nextTMonthKey })}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
              >
                翌月 →
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-gray-200 px-2 py-1 text-gray-300">
                翌月 →
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 rounded-lg border border-gray-200 bg-white p-3 text-center text-xs">
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
                <span>{dayNum}</span>
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

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-bold text-gray-900">{selectedDayLabel}</h3>
          {selectedDaySessions.length === 0 && unassignedEntries.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">この日の記録はありません。</p>
          ) : (
            <div className="mt-3 space-y-6">
              {selectedDaySessions.map((t, idx) => (
                <TournamentSessionCard
                  key={t.id}
                  label={t.label || `${idx + 1}回目`}
                  denomLabel={denominationLabelById.get(t.denomination_id ?? "") ?? "種類未設定"}
                  summary={summarizeTournamentSession(
                    entriesByTournamentId.get(t.id) ?? [],
                    dayVisitCustomerIds,
                  )}
                  entries={entriesByTournamentId.get(t.id) ?? []}
                />
              ))}
              {unassignedEntries.length > 0 && (
                <TournamentSessionCard
                  label="(未分類)"
                  denomLabel="-"
                  summary={summarizeTournamentSession(unassignedEntries, dayVisitCustomerIds)}
                  entries={unassignedEntries}
                />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
