import {
  computeDailyPurchaseCashYenTotals,
  computeDailyTournamentCashYenTotals,
} from "@/lib/balances";
import { MultiLineChart, type MultiLineSeries } from "@/components/MultiLineChart";
import { monthLabelOf } from "@/lib/statsFormat";
import type { ChipTransaction, Denomination, TournamentEntry } from "@/lib/types";

const TRAILING_MONTHS = 12;
const RING_COLOR = "#2563eb";
const TOURNAMENT_COLOR = "#ea580c";

function bucketDailyToMonthly(daily: Map<string, number>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const [date, value] of daily) {
    const monthKey = date.slice(0, 7);
    totals.set(monthKey, (totals.get(monthKey) ?? 0) + value);
  }
  return totals;
}

function formatYen(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

// 店全体の現金の動きを「リングゲーム現金（チップ購入を現金価格で円換算）」と
// 「トーナメント現金（現金エントリーを現金価格で円換算）」の2本に分けて重ね比較する。
// 額面設定で現金価格（price_yen）を入れていない額面は円換算できないため対象外になる。
export function CashFlowComparisonSection({
  transactions,
  tournamentEntries,
  denominations,
  currentMonthKey,
}: {
  transactions: ChipTransaction[];
  tournamentEntries: TournamentEntry[];
  denominations: Denomination[];
  currentMonthKey: string;
}) {
  const hasAnyPrice = denominations.some((d) => d.price_yen != null);

  const monthlyRing = bucketDailyToMonthly(computeDailyPurchaseCashYenTotals(transactions, denominations));
  const monthlyTournament = bucketDailyToMonthly(
    computeDailyTournamentCashYenTotals(tournamentEntries, denominations),
  );

  const allMonthKeys = [...new Set([...monthlyRing.keys(), ...monthlyTournament.keys()])].sort();
  const chartMonthKeys = allMonthKeys.slice(-TRAILING_MONTHS);

  const ringSeries: MultiLineSeries = {
    key: "ring",
    label: "リングゲーム現金",
    color: RING_COLOR,
    data: chartMonthKeys.map((monthKey) => ({
      date: monthKey,
      value: monthlyRing.get(monthKey) ?? 0,
    })),
  };
  const tournamentSeries: MultiLineSeries = {
    key: "tournament",
    label: "トーナメント現金",
    color: TOURNAMENT_COLOR,
    data: chartMonthKeys.map((monthKey) => ({
      date: monthKey,
      value: monthlyTournament.get(monthKey) ?? 0,
    })),
  };

  const currentRing = monthlyRing.get(currentMonthKey) ?? 0;
  const currentTournament = monthlyTournament.get(currentMonthKey) ?? 0;
  const [yearPart, numPart] = currentMonthKey.split("-");
  const monthLabel = `${yearPart}年${Number(numPart)}月`;

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-gray-900">現金の動き</h2>
      <p className="mb-4 text-xs text-gray-500">
        額面設定の「現金価格（円）」を使って、チップ購入（リングゲーム）とトーナメント現金エントリーを
        円換算して比較します。現金価格が未設定の額面は含まれません。
      </p>
      {!hasAnyPrice ? (
        <p className="text-sm text-gray-500">
          額面設定でまだ現金価格（円）が設定されていません。設定＞額面から各額面の現金価格を入力してください。
        </p>
      ) : chartMonthKeys.length === 0 ? (
        <p className="text-sm text-gray-500">まだ記録がありません。</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-gray-500">{monthLabel}のリングゲーム現金</p>
              <p className="text-xl font-bold text-gray-900">{formatYen(currentRing)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{monthLabel}のトーナメント現金</p>
              <p className="text-xl font-bold text-gray-900">{formatYen(currentTournament)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{monthLabel}の現金合計</p>
              <p className="text-xl font-bold text-gray-900">
                {formatYen(currentRing + currentTournament)}
              </p>
            </div>
          </div>
          <MultiLineChart series={[ringSeries, tournamentSeries]} />
          <p className="mt-2 text-xs text-gray-400">
            横軸は月の推移（{monthLabelOf(chartMonthKeys[0])} 〜{" "}
            {monthLabelOf(chartMonthKeys[chartMonthKeys.length - 1])}）です。
          </p>
        </div>
      )}
    </section>
  );
}
