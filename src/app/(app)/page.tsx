import Link from "next/link";
import { getAllTransactions, getCustomers, getDenominations } from "@/lib/data";
import { computePointTotals, computeShopTableTotals } from "@/lib/balances";
import { businessDateKey } from "@/lib/businessDay";

export default async function DashboardPage() {
  const [customers, denominations, transactions] = await Promise.all([
    getCustomers(),
    getDenominations(),
    getAllTransactions(),
  ]);

  const todayKey = businessDateKey(new Date());
  const todaysTransactions = transactions.filter(
    (tx) => businessDateKey(tx.created_at) === todayKey,
  );
  const { buyInTotal, outTotal, rake } = computeShopTableTotals(todaysTransactions);
  const pointTotals = computePointTotals(transactions, denominations);

  const topHolders = customers
    .map((c) => ({ customer: c, points: pointTotals.get(c.id) ?? 0 }))
    .filter((c) => c.points !== 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">ダッシュボード</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">登録客数</p>
          <p className="text-2xl font-bold text-gray-900">
            {customers.length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">本日のバイイン</p>
          <p className="text-2xl font-bold text-red-600">{buyInTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">本日のアウト</p>
          <p className="text-2xl font-bold text-blue-600">{outTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">本日のレーキ</p>
          <p className="text-2xl font-bold text-gray-900">{rake.toLocaleString()}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">保有点数の多い客</h2>
        {topHolders.length === 0 ? (
          <p className="text-sm text-gray-500">まだ取引がありません。</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">客</th>
                  <th className="px-4 py-2 font-medium">保有点数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topHolders.map(({ customer, points }) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {points.toLocaleString()}
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
