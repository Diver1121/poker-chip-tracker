"use client";

import { useState } from "react";
import { businessDateKey, daysInMonth, shiftMonthKey } from "@/lib/businessDay";
import { average } from "@/lib/statsFormat";
import type { Tournament, TournamentEntry, Visit } from "@/lib/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type ViewMode = "month" | "total";

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

export function TournamentSummarySection({
  tournamentEntries,
  tournaments,
  visits,
  currentMonthKey,
}: {
  tournamentEntries: TournamentEntry[];
  tournaments: Tournament[];
  visits: Visit[];
  currentMonthKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const entriesByDay = new Map<string, TournamentEntry[]>();
  for (const entry of tournamentEntries) {
    const key = businessDateKey(entry.created_at);
    const list = entriesByDay.get(key) ?? [];
    list.push(entry);
    entriesByDay.set(key, list);
  }

  const entriesByTournamentId = new Map<string, TournamentEntry[]>();
  for (const entry of tournamentEntries) {
    if (!entry.tournament_id) continue;
    const list = entriesByTournamentId.get(entry.tournament_id) ?? [];
    list.push(entry);
    entriesByTournamentId.set(entry.tournament_id, list);
  }

  const monthDays = daysInMonth(monthKey);
  const [monthYearPart, monthNumPart] = monthKey.split("-");
  const firstWeekday = new Date(
    Date.UTC(Number(monthYearPart), Number(monthNumPart) - 1, 1),
  ).getUTCDay();
  const monthLabel = `${monthYearPart}年${Number(monthNumPart)}月`;
  const canGoNextMonth = shiftMonthKey(monthKey, 1) <= currentMonthKey;

  // 集計対象の回: 「月」なら選択中の月だけ、「トータル」なら全期間の全ての回。
  const targetSessions =
    viewMode === "month"
      ? tournaments.filter((t) => monthDays.includes(businessDateKey(t.created_at)))
      : tournaments;

  const sessionSummaries = targetSessions.map((t) => {
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

  const sessionCount = sessionSummaries.length;
  const avgParticipationRate = average(
    sessionSummaries.map((s) => s.participationRate).filter((r): r is number => r !== null),
  );
  const avgAddonRate = average(
    sessionSummaries.map((s) => s.addonRate).filter((r): r is number => r !== null),
  );
  const avgCashRate = average(
    sessionSummaries.map((s) => s.cashRate).filter((r): r is number => r !== null),
  );
  const avgEntryCount = average(sessionSummaries.map((s) => s.entryCount)) ?? 0;
  const avgTotals = {
    entryFee: average(sessionSummaries.map((s) => s.totals.entryFee)) ?? 0,
    cash: average(sessionSummaries.map((s) => s.totals.cash)) ?? 0,
    chip: average(sessionSummaries.map((s) => s.totals.chip)) ?? 0,
    ticket: average(sessionSummaries.map((s) => s.totals.ticket)) ?? 0,
    addonCash: average(sessionSummaries.map((s) => s.totals.addonCash)) ?? 0,
    addon: average(sessionSummaries.map((s) => s.totals.addon)) ?? 0,
    prize: average(sessionSummaries.map((s) => s.totals.prize)) ?? 0,
  };
  const totalEntryCount = sessionSummaries.reduce((sum, s) => sum + s.entryCount, 0);
  const sumTotals = {
    entryFee: sessionSummaries.reduce((sum, s) => sum + s.totals.entryFee, 0),
    cash: sessionSummaries.reduce((sum, s) => sum + s.totals.cash, 0),
    chip: sessionSummaries.reduce((sum, s) => sum + s.totals.chip, 0),
    ticket: sessionSummaries.reduce((sum, s) => sum + s.totals.ticket, 0),
    addonCash: sessionSummaries.reduce((sum, s) => sum + s.totals.addonCash, 0),
    addon: sessionSummaries.reduce((sum, s) => sum + s.totals.addon, 0),
    prize: sessionSummaries.reduce((sum, s) => sum + s.totals.prize, 0),
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">トーナメント</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            カレンダーは「記録保存」された日の目安です。下は集計結果です。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex gap-1 rounded-md border border-gray-300 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded px-2 py-1 font-medium ${
                viewMode === "month"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              月
            </button>
            <button
              type="button"
              onClick={() => setViewMode("total")}
              className={`rounded px-2 py-1 font-medium ${
                viewMode === "total"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              トータル
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前月
            </button>
            <span className="font-medium text-gray-900">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setMonthKey((k) => shiftMonthKey(k, 1))}
              disabled={!canGoNextMonth}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              翌月 →
            </button>
          </div>
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
          {monthDays.map((dayKey) => {
            const dayEntries = entriesByDay.get(dayKey) ?? [];
            const hasEntries = dayEntries.length > 0;
            const isSelected = dayKey === selectedDayKey;
            const dayNum = Number(dayKey.slice(-2));
            return (
              <button
                type="button"
                key={dayKey}
                onClick={() => setSelectedDayKey(dayKey)}
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
              </button>
            );
          })}
        </div>
      </details>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">
          {viewMode === "month" ? `${monthLabel}の集計` : "全期間の集計"}
          <span className="ml-1 font-normal text-gray-400">（{sessionCount}回開催）</span>
        </h3>
        {sessionCount === 0 ? (
          <p className="mt-2 text-sm text-gray-500">記録がありません。</p>
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
                    <td className="px-2 py-1 font-medium text-gray-500">合計</td>
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
                    <td className="px-2 py-1 font-medium text-gray-500">平均</td>
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
  );
}
