import { getAllTransactions, getCustomers, getTournamentEntries } from "@/lib/data";
import { businessMonthKey, formatJstMonthDay } from "@/lib/businessDay";
import { getOperationalAlerts, rankingShareAlertKey } from "@/lib/operationalAlerts";
import { DismissibleAlertList } from "@/components/DismissibleAlert";
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
        <DismissibleAlertList
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          items={alerts.pendingRankingShareDays.map((pending) => ({
            key: rankingShareAlertKey(pending),
            content: (
              <>
                ⚠️ {formatJstMonthDay(pending.dayKey)}の
                {pending.missingTournamentShare && "「トーナメント成績ランキング」"}
                {pending.missingTournamentShare && pending.missingSeriesShare && "・"}
                {pending.missingSeriesShare && "「シリーズトーナメントポイント」"}
                の投稿ボタンがまだ押されていません。
              </>
            ),
          }))}
        />
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
