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
import { businessDateKey, businessMonthKey } from "@/lib/businessDay";
import { MonthlyOperationsSummarySection } from "@/components/MonthlyOperationsSummarySection";
import { PurchaseBreakdownSection } from "@/components/PurchaseBreakdownSection";
import { ShopCurrentTotalCard } from "@/components/ShopCurrentTotalCard";
import { ShopTotalTrendSection } from "@/components/ShopTotalTrendSection";
import { TournamentSummarySection } from "@/components/TournamentSummarySection";
import { WeekdayBreakdownSection } from "@/components/WeekdayBreakdownSection";

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

  // 「営業開始時点」の基準線：当営業日（朝5時区切り）が始まった時点の保有点数。
  // 当日分の増減（delta）を現在値から差し引くことで求める。
  const todayKey = businessDateKey(new Date());
  const lastDaily = dailyTotals[dailyTotals.length - 1];
  const businessStartTotal =
    lastDaily && lastDaily.date === todayKey ? lastDaily.total - lastDaily.delta : shopCurrentTotal;

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">データ</h1>

      <ShopCurrentTotalCard
        shopCurrentTotal={shopCurrentTotal}
        businessStartTotal={businessStartTotal}
        dailyTotals={dailyTotals}
      />

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

      <WeekdayBreakdownSection
        transactions={transactions}
        visits={visits}
        denominations={denominations}
        lastClosedAt={shopSettings.lastClosedAt}
      />
    </div>
  );
}
