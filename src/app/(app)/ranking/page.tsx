import { getAllTransactions, getCustomers, getTournamentEntries } from "@/lib/data";
import { businessMonthKey, formatJstMonthDay } from "@/lib/businessDay";
import { getOperationalAlerts } from "@/lib/operationalAlerts";
import { DismissibleAlert } from "@/components/DismissibleAlert";
import { RingGameRankingSection } from "@/components/RingGameRankingSection";
import { SeriesTournamentPointsSection } from "@/components/SeriesTournamentPointsSection";
import { TournamentRankingSection } from "@/components/TournamentRankingSection";

export default async function RankingPage() {
  const [transactions, tournamentEntries, customers, alerts] = await Promise.all([
    getAllTransactions(),
    getTournamentEntries(),
    getCustomers(),
    getOperationalAlerts(),
  ]);

  const currentMonthKey = businessMonthKey(new Date());

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">ランキング</h1>

      {alerts.pendingRankingShareDays.length > 0 && (
        <DismissibleAlert
          storageKey={`ranking-share:${alerts.pendingRankingShareDays
            .map(
              (p) =>
                `${p.dayKey}:${p.missingTournamentShare ? 1 : 0}:${p.missingSeriesShare ? 1 : 0}`,
            )
            .join(",")}`}
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {alerts.pendingRankingShareDays.map((pending) => (
            <div key={pending.dayKey}>
              ⚠️ {formatJstMonthDay(pending.dayKey)}の
              {pending.missingTournamentShare && "「トーナメント成績ランキング」"}
              {pending.missingTournamentShare && pending.missingSeriesShare && "・"}
              {pending.missingSeriesShare && "「シリーズトーナメントポイント」"}
              の投稿ボタンがまだ押されていません。
            </div>
          ))}
        </DismissibleAlert>
      )}

      <RingGameRankingSection
        transactions={transactions}
        customers={customers}
        currentMonthKey={currentMonthKey}
      />

      <SeriesTournamentPointsSection
        tournamentEntries={tournamentEntries}
        customers={customers}
        currentMonthKey={currentMonthKey}
      />

      <TournamentRankingSection
        tournamentEntries={tournamentEntries}
        customers={customers}
        currentMonthKey={currentMonthKey}
      />
    </div>
  );
}
