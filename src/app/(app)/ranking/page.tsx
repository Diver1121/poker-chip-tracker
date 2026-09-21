import { getAllTransactions, getCustomers, getTournamentEntries } from "@/lib/data";
import { businessMonthKey } from "@/lib/businessDay";
import { RingGameRankingSection } from "@/components/RingGameRankingSection";
import { TournamentRankingSection } from "@/components/TournamentRankingSection";

export default async function RankingPage() {
  const [transactions, tournamentEntries, customers] = await Promise.all([
    getAllTransactions(),
    getTournamentEntries(),
    getCustomers(),
  ]);

  const currentMonthKey = businessMonthKey(new Date());

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">ランキング</h1>

      <RingGameRankingSection
        transactions={transactions}
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
