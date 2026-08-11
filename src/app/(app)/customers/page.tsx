import { getAllTransactions, getAllVisits, getCustomers, getDenominations } from "@/lib/data";
import { computeLastVisitByCustomer, computePointTotals } from "@/lib/balances";
import {
  CHIP_RETENTION_DAYS,
  daysUntil,
  isNearRetention,
  isPastRetention,
  retentionDueAt,
} from "@/lib/retention";
import { CustomerListSearch } from "@/components/CustomerListSearch";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { createCustomer, deleteExpiredCustomer } from "./actions";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, customers, visits, transactions, denominations] = await Promise.all([
    searchParams,
    getCustomers(),
    getAllVisits(),
    getAllTransactions(),
    getDenominations(),
  ]);

  // 客一覧の検索欄で「保有数の多い順」に切り替えられるようにするための保有合計。
  const pointTotals = computePointTotals(transactions, denominations);
  const customersWithHolding = customers.map((c) => ({
    id: c.id,
    name: c.name,
    note: c.note,
    holding: pointTotals.get(c.id) ?? 0,
  }));

  // チップ保有期間（来店最終日から1年）の判定。来店記録が無い客は登録日を起点にする。
  const lastVisitByCustomer = computeLastVisitByCustomer(visits);
  const retentionInfo = customers.map((c) => {
    const lastVisit = lastVisitByCustomer.get(c.id) ?? c.created_at;
    return { customer: c, lastVisit, dueAt: retentionDueAt(lastVisit) };
  });
  const expiredCustomers = retentionInfo
    .filter((r) => isPastRetention(r.lastVisit))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const nearExpiryCustomers = retentionInfo
    .filter((r) => isNearRetention(r.lastVisit))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">客一覧（{customers.length}人）</h1>

      {expiredCustomers.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="mb-1 text-sm font-bold text-red-800">
            消去対象（来店から{CHIP_RETENTION_DAYS}日経過）
          </h2>
          <p className="mb-3 text-xs text-red-700">
            チップ保有期間を過ぎています。確認のうえ削除してください（取引履歴・チャットログも一緒に削除されます）。
          </p>
          <div className="divide-y divide-red-100 rounded-md border border-red-100 bg-white">
            {expiredCustomers.map(({ customer, lastVisit }) => (
              <div
                key={customer.id}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <div>
                  <p className="font-medium text-gray-900">{customer.name}</p>
                  <p className="text-xs text-gray-500">
                    最終来店: {new Date(lastVisit).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                <form action={deleteExpiredCustomer}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`「${customer.name}」を削除しますか？取引履歴・チャットログもすべて削除され、元に戻せません（自動バックアップには残ります）。`}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    削除
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {nearExpiryCustomers.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-1 text-sm font-bold text-amber-800">
            消去予定（1ヶ月以内にチップ保有期間が切れます）
          </h2>
          <p className="mb-3 text-xs text-amber-700">
            この期間内に来店があれば起点がリセットされ、消去対象から外れます。
          </p>
          <div className="divide-y divide-amber-100 rounded-md border border-amber-100 bg-white">
            {nearExpiryCustomers.map(({ customer, lastVisit, dueAt }) => (
              <div key={customer.id} className="px-4 py-2">
                <p className="font-medium text-gray-900">{customer.name}</p>
                <p className="text-xs text-gray-500">
                  最終来店: {new Date(lastVisit).toLocaleDateString("ja-JP")} ／ あと
                  {daysUntil(dueAt)}日で消去対象になります
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">新しい客を登録</h2>
        {error === "duplicate" && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            同じ名前の客が既に登録されています。
          </p>
        )}
        <form
          action={createCustomer}
          className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              名前
            </label>
            <input
              id="name"
              name="name"
              required
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="note" className="mb-1 block text-sm font-medium text-gray-700">
              メモ（任意）
            </label>
            <input
              id="note"
              name="note"
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="initialPoints"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              初期保有点数（他システムからの移行時のみ）
            </label>
            <input
              id="initialPoints"
              name="initialPoints"
              type="number"
              step={1}
              min={0}
              placeholder="0"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <SubmitButton className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            登録
          </SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">客を検索</h2>
        <CustomerListSearch customers={customersWithHolding} />
      </section>
    </div>
  );
}
