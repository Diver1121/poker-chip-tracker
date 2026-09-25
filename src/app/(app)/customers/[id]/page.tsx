import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import {
  getCustomer,
  getDenominations,
  getTournamentEntriesForCustomer,
  getTransactionsForCustomer,
} from "@/lib/data";
import {
  computeBalances,
  computeCustomerGameResultTimeline,
  computeCustomerResultTimeline,
  computeDailyPurchaseValueTotals,
  computeMonthlyPurchaseValueTotals,
  computePointTotals,
} from "@/lib/balances";
import { CATEGORY_INFO, gameLabel, quantityUnitLabel } from "@/lib/transactionCategory";
import { businessDateKey, businessMonthKey, shiftMonthKey, toJstDatetimeLocal } from "@/lib/businessDay";
import { percentChange, sumThroughDay } from "@/lib/statsFormat";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { EditCustomerNameButton } from "@/components/EditCustomerNameButton";
import { DeleteCustomerButton } from "@/components/DeleteCustomerButton";
import { GameLineChart } from "@/components/GameLineChart";
import { MonthlyBarChart } from "@/components/MonthlyBarChart";
import { MonthlyTrendHeadline } from "@/components/MonthlyTrendHeadline";
import {
  deleteTransaction,
  updateTransactionDate,
} from "@/app/(app)/transactions/actions";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; month?: string }>;
}) {
  const { id } = await params;
  const [{ error, month }, customer, denominations, transactions, tournamentEntries] =
    await Promise.all([
      searchParams,
      getCustomer(id),
      getDenominations(),
      getTransactionsForCustomer(id),
      getTournamentEntriesForCustomer(id),
    ]);

  if (!customer) {
    notFound();
  }

  const customerBalances = computeBalances(transactions).get(customer.id) ?? new Map();
  const totalPoints = computePointTotals(transactions, denominations).get(customer.id) ?? 0;
  const denominationLabel = new Map(denominations.map((d) => [d.id, d.label]));
  const resultChartData = computeCustomerResultTimeline(transactions, denominations);
  const pokerResultChartData = computeCustomerGameResultTimeline(transactions, "poker");
  const blackjackResultChartData = computeCustomerGameResultTimeline(transactions, "blackjack");

  const rankedEntries = tournamentEntries.filter((e) => e.rank !== null);
  const averageRank =
    rankedEntries.length > 0
      ? rankedEntries.reduce((sum, e) => sum + (e.rank ?? 0), 0) / rankedEntries.length
      : null;
  const totalPrize = tournamentEntries.reduce((sum, e) => sum + e.prize_amount, 0);

  // 取引履歴は月ごとに区切って表示する（ずっと更新され続けてスクロールが大変なため）。
  // 指定が無ければ、その客の直近の取引があった月をデフォルトにする
  // （今月まだ来店が無い客だと、素の今月表示では空欄になってしまうため）。
  const currentMonthKey = businessMonthKey(new Date());
  const latestTransactionMonthKey =
    transactions.length > 0 ? businessMonthKey(transactions[0].created_at) : currentMonthKey;
  const requestedMonthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : null;
  const monthKey =
    requestedMonthKey && requestedMonthKey <= currentMonthKey
      ? requestedMonthKey
      : latestTransactionMonthKey;
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const nextMonthKey = shiftMonthKey(monthKey, 1);
  const canGoNext = nextMonthKey <= currentMonthKey;
  const [monthYearPart, monthNumPart] = monthKey.split("-");
  const monthLabel = `${monthYearPart}年${Number(monthNumPart)}月`;
  const monthTransactions = transactions.filter(
    (tx) => businessMonthKey(tx.created_at) === monthKey,
  );

  // この客の利用（購入点数）の月次推移。「先月より使っているか」を一目で見えるようにする。
  // 今月は進行中なので、先月も同じ日数目までに絞ってフェアに比較する。
  const monthlyPurchaseTotals = computeMonthlyPurchaseValueTotals(transactions, denominations);
  const previousMonthKey = shiftMonthKey(currentMonthKey, -1);
  const currentMonthPurchaseValue = monthlyPurchaseTotals.get(currentMonthKey) ?? 0;
  const dailyPurchaseTotals = computeDailyPurchaseValueTotals(transactions, denominations);
  const todayOfMonth = Number(businessDateKey(new Date()).slice(8, 10));
  const previousMonthPurchaseValueThroughSameDay = sumThroughDay(
    dailyPurchaseTotals,
    previousMonthKey,
    todayOfMonth,
  );
  const purchaseChangePercent = percentChange(
    currentMonthPurchaseValue,
    previousMonthPurchaseValueThroughSameDay,
  );
  const purchaseTrendMonthKeys = [...monthlyPurchaseTotals.keys()].sort().slice(-12);
  const purchaseTrendData = purchaseTrendMonthKeys.map((k) => ({
    monthKey: k,
    value: monthlyPurchaseTotals.get(k) ?? 0,
  }));
  const [currentYearPart, currentNumPart] = currentMonthKey.split("-");
  const currentMonthLabel = `${currentYearPart}年${Number(currentNumPart)}月`;

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
            {customer.note && (
              <p className="text-sm text-gray-500">{customer.note}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <EditCustomerNameButton customerId={customer.id} currentName={customer.name} />
            <DeleteCustomerButton customerId={customer.id} customerName={customer.name} />
          </div>
        </div>
        {error === "duplicate" && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            同じ名前の客が既に登録されています。
          </p>
        )}
        <Link
          href="/board"
          className="mt-3 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          来店中ボードで記録する
          <LinkPendingDot />
        </Link>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          現在の保有枚数（合計 {totalPoints.toLocaleString()} 点）
        </h2>
        {denominations.length === 0 ? (
          <p className="text-sm text-gray-500">額面が登録されていません。</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {denominations.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <p className="text-sm text-gray-500">{d.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(customerBalances.get(d.id) ?? 0).toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-gray-500">
                    枚
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">収支の推移</h2>
        <p className="mb-3 text-xs text-gray-500">
          「全体」はバイイン・トーナメント使用をマイナス、アウト・プライズ獲得をプラスとして累計（購入はカウントしません）。
          「ポーカー」「ブラックジャック」はそのゲームのバイイン・アウトだけの収支です。
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {resultChartData.length === 0 ? (
            <p className="text-sm text-gray-500">まだ取引がありません。</p>
          ) : (
            <GameLineChart
              all={resultChartData}
              poker={pokerResultChartData}
              blackjack={blackjackResultChartData}
              gradientId="customerResultFill"
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">利用（購入点数）の月次推移</h2>
        {purchaseTrendData.length === 0 ? (
          <p className="text-sm text-gray-500">まだ購入の記録がありません。</p>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4">
              <MonthlyTrendHeadline
                monthLabel={`${currentMonthLabel}の購入`}
                value={currentMonthPurchaseValue}
                unit="購入"
                changePercent={purchaseChangePercent}
                changeNote={`前月同日比（${todayOfMonth}日まで）`}
              />
            </div>
            <MonthlyBarChart data={purchaseTrendData} label="購入" unit="購入" />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">トーナメント成績</h2>
        {tournamentEntries.length === 0 ? (
          <p className="text-sm text-gray-500">エントリー記録がありません。</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs text-gray-500">エントリー回数</p>
                <p className="text-lg font-bold text-gray-900">{tournamentEntries.length}回</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs text-gray-500">平均順位</p>
                <p className="text-lg font-bold text-gray-900">
                  {averageRank === null ? "-" : `${averageRank.toFixed(1)}位`}
                </p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs text-gray-500">通算獲得</p>
                <p className="text-lg font-bold text-gray-900">
                  {totalPrize.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="max-h-[360px] overflow-y-auto">
                <table className="w-full text-left text-sm [font-variant-numeric:tabular-nums]">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">日時</th>
                      <th className="px-4 py-2 text-right font-medium">順位</th>
                      <th className="px-4 py-2 text-right font-medium">エントリー</th>
                      <th className="px-4 py-2 text-right font-medium">獲得</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tournamentEntries.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-2 text-gray-500">
                          {new Date(e.created_at).toLocaleString("ja-JP")}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {e.rank === null ? "-" : `${e.rank}位`}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {e.entry_fee.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {e.prize_amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">取引履歴</h2>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/customers/${customer.id}?month=${prevMonthKey}`}
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50"
            >
              ← 前月
              <LinkPendingDot />
            </Link>
            <span className="font-medium text-gray-900">{monthLabel}</span>
            {canGoNext ? (
              <Link
                href={`/customers/${customer.id}?month=${nextMonthKey}`}
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
        {monthTransactions.length === 0 ? (
          <p className="text-sm text-gray-500">この月の取引はありません。</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">日時</th>
                  <th className="px-4 py-2 font-medium">種別</th>
                  <th className="px-4 py-2 font-medium">額面</th>
                  <th className="px-4 py-2 font-medium">枚数</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 text-gray-500">
                      <details className="group">
                        <summary className="cursor-pointer list-none hover:underline">
                          {new Date(tx.created_at).toLocaleString("ja-JP")}
                        </summary>
                        <form
                          action={updateTransactionDate}
                          className="mt-2 flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="id" value={tx.id} />
                          <input type="hidden" name="customerId" value={customer.id} />
                          <input
                            type="datetime-local"
                            name="createdAt"
                            defaultValue={toJstDatetimeLocal(tx.created_at)}
                            required
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                          />
                          <SubmitButton className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                            更新
                          </SubmitButton>
                        </form>
                      </details>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 ${CATEGORY_INFO[tx.category].badgeClassName}`}
                      >
                        {CATEGORY_INFO[tx.category].label}
                      </span>
                      {gameLabel(tx.game) && (
                        <span className="ml-1 text-xs text-gray-400">
                          （{gameLabel(tx.game)}）
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {tx.denomination_id
                        ? denominationLabel.get(tx.denomination_id) ?? "(削除済み)"
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {tx.quantity} {quantityUnitLabel(tx.category)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteTransaction}>
                        <input type="hidden" name="id" value={tx.id} />
                        <input type="hidden" name="customerId" value={customer.id} />
                        <ConfirmSubmitButton
                          confirmMessage="この取引を削除しますか？保有枚数の計算からも取り除かれます。"
                          className="text-xs text-red-600 hover:underline"
                        >
                          削除
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
