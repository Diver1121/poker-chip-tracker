import {
  getAllTransactions,
  getAllVisits,
  getCustomers,
  getDenominations,
  getShopSettings,
  getTournamentEntries,
  getTournaments,
} from "@/lib/data";
import { computeDailyTotals } from "@/lib/balances";
import { businessMonthKey } from "@/lib/businessDay";
import { MonthlyOperationsSummarySection } from "@/components/MonthlyOperationsSummarySection";
import { PurchaseBreakdownSection } from "@/components/PurchaseBreakdownSection";
import { ShopTotalTrendSection } from "@/components/ShopTotalTrendSection";
import { TournamentSummarySection } from "@/components/TournamentSummarySection";

export default async function StatsPage() {
  const [transactions, denominations, visits, shopSettings, tournamentEntries, tournaments, customers] =
    await Promise.all([
      getAllTransactions(),
      getDenominations(),
      getAllVisits(),
      getShopSettings(),
      getTournamentEntries(),
      getTournaments(),
      getCustomers(),
    ]);

  const dailyTotals = computeDailyTotals(transactions, denominations);
  const shopCurrentTotal = dailyTotals.length > 0 ? dailyTotals[dailyTotals.length - 1].total : 0;
  const currentMonthKey = businessMonthKey(new Date());

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">データ</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">店全体の保有チップ量（現在）</p>
        <p className="text-3xl font-bold text-indigo-600">
          {shopCurrentTotal.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-gray-500">点</span>
        </p>
      </div>

      <ShopTotalTrendSection dailyTotals={dailyTotals} currentMonthKey={currentMonthKey} />

      <MonthlyOperationsSummarySection
        transactions={transactions}
        visits={visits}
        denominations={denominations}
        customers={customers}
        lastClosedAt={shopSettings.lastClosedAt}
        currentMonthKey={currentMonthKey}
      />

      <PurchaseBreakdownSection
        transactions={transactions}
        denominations={denominations}
        currentMonthKey={currentMonthKey}
      />

      <TournamentSummarySection
        tournamentEntries={tournamentEntries}
        tournaments={tournaments}
        visits={visits}
        currentMonthKey={currentMonthKey}
      />
    </div>
  );
}
