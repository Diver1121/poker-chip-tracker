import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomer,
  getDenominations,
  getTransactionsForCustomer,
} from "@/lib/data";
import {
  computeBalances,
  computeCustomerResultTimeline,
  computePointTotals,
} from "@/lib/balances";
import { CATEGORY_INFO, quantityUnitLabel } from "@/lib/transactionCategory";
import { toJstDatetimeLocal } from "@/lib/businessDay";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { EditCustomerNameButton } from "@/components/EditCustomerNameButton";
import { DeleteCustomerButton } from "@/components/DeleteCustomerButton";
import { LineChart } from "@/components/LineChart";
import {
  deleteTransaction,
  updateTransactionDate,
} from "@/app/(app)/transactions/actions";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const [{ error }, customer, denominations, transactions] = await Promise.all([
    searchParams,
    getCustomer(id),
    getDenominations(),
    getTransactionsForCustomer(id),
  ]);

  if (!customer) {
    notFound();
  }

  const customerBalances = computeBalances(transactions).get(customer.id) ?? new Map();
  const totalPoints = computePointTotals(transactions, denominations).get(customer.id) ?? 0;
  const denominationLabel = new Map(denominations.map((d) => [d.id, d.label]));
  const resultChartData = computeCustomerResultTimeline(transactions, denominations);

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
          バイイン・トーナメント使用はマイナス、アウト（テーブルからカウント）・プライズ獲得はプラスとして累計しています（購入はカウントしません）。
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {resultChartData.length === 0 ? (
            <p className="text-sm text-gray-500">まだ取引がありません。</p>
          ) : (
            <LineChart
              data={resultChartData}
              color="#dc2626"
              gradientId="customerResultFill"
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">取引履歴</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">まだ取引がありません。</p>
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
                {transactions.map((tx) => (
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
                          <button
                            type="submit"
                            className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            更新
                          </button>
                        </form>
                      </details>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 ${CATEGORY_INFO[tx.category].badgeClassName}`}
                      >
                        {CATEGORY_INFO[tx.category].label}
                      </span>
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
