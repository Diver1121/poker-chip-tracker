import Link from "next/link";
import { getCheckedInCustomers, getCustomers, getDenominations } from "@/lib/data";
import { getAllTransactions } from "@/lib/data";
import {
  computeBalances,
  computeCategoryQuantityTotals,
  computePointTotals,
  computeShopTableTotals,
} from "@/lib/balances";
import {
  TRANSACTION_CATEGORIES,
  categoryLabel,
  categoryUsesDenomination,
  denominationsForCategory,
} from "@/lib/transactionCategory";
import { businessDateKey, toJstDatetimeLocal } from "@/lib/businessDay";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import {
  checkInCustomer,
  checkOutAllCustomers,
  recordBoardTransaction,
  undoCheckIn,
} from "./actions";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const [{ sort }, checkedInCustomers, allCustomers, denominations, transactions] =
    await Promise.all([
      searchParams,
      getCheckedInCustomers(),
      getCustomers(),
      getDenominations(),
      getAllTransactions(),
    ]);

  const sortMode = sort === "name" ? "name" : "visit";
  const sortedCheckedInCustomers = [...checkedInCustomers].sort((a, b) => {
    if (sortMode === "name") {
      return a.name.localeCompare(b.name, "ja");
    }
    return (
      new Date(a.checked_in_at ?? 0).getTime() -
      new Date(b.checked_in_at ?? 0).getTime()
    );
  });

  // 来店ボードの保有表示（額面バッジ・保有合計）は客詳細ページと同じく、
  // 全期間の取引から計算した「今持っている本当のチップ数」を表示する。
  const balances = computeBalances(transactions);
  const pointTotals = computePointTotals(transactions, denominations);

  // バイイン/アウト/レーキ、および客ごとのバイイン/アウト表示は前営業日以前を含めず、
  // 当営業日（朝5時区切り）分だけを集計する（営業終了ボタンで区切られる想定）
  const todayKey = businessDateKey(new Date());
  const todaysTransactions = transactions.filter(
    (tx) => businessDateKey(tx.created_at) === todayKey,
  );
  const categoryTotals = computeCategoryQuantityTotals(todaysTransactions);
  const { buyInTotal: shopBuyInTotal, outTotal: shopOutTotal, rake } =
    computeShopTableTotals(todaysTransactions);
  const checkedInIds = new Set(checkedInCustomers.map((c) => c.id));
  const notCheckedIn = allCustomers.filter((c) => !checkedInIds.has(c.id));
  const nowJstLocal = toJstDatetimeLocal(new Date().toISOString());

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900">
            来店中ボード（{checkedInCustomers.length}人）
          </h1>
          <div className="flex gap-1 text-xs">
            <Link
              href="/board?sort=visit"
              className={
                sortMode === "visit"
                  ? "rounded-md bg-indigo-100 px-2 py-1 font-bold text-indigo-700"
                  : "rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
              }
            >
              来店順
            </Link>
            <Link
              href="/board?sort=name"
              className={
                sortMode === "name"
                  ? "rounded-md bg-indigo-100 px-2 py-1 font-bold text-indigo-700"
                  : "rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
              }
            >
              五十音順
            </Link>
          </div>
        </div>
        {checkedInCustomers.length > 0 && (
          <form action={checkOutAllCustomers}>
            <ConfirmSubmitButton
              confirmMessage={`来店中の${checkedInCustomers.length}人を全員退店にしますか？チャットの履歴は消去されます（保有チップ数・取引履歴は消えず残ります）。`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              営業終了・まとめて退店
            </ConfirmSubmitButton>
          </form>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">本日のバイイン</p>
          <p className="text-2xl font-bold text-red-600">
            {shopBuyInTotal.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">本日のアウト</p>
          <p className="text-2xl font-bold text-blue-600">
            {shopOutTotal.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">本日のレーキ（差分）</p>
          <p className="text-2xl font-bold text-gray-900">{rake.toLocaleString()}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">客を来店にセット</h2>
        {notCheckedIn.length === 0 ? (
          <p className="text-sm text-gray-500">
            全ての登録客が来店中です。新しい客は「客一覧」から登録してください。
          </p>
        ) : (
          <form
            action={checkInCustomer}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <CustomerCombobox
                key={checkedInCustomers.length}
                name="customerId"
                customers={notCheckedIn}
                placeholder="客の名前を入力して検索"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              来店
            </button>
          </form>
        )}
      </section>

      <section>
        {checkedInCustomers.length === 0 ? (
          <p className="text-sm text-gray-500">現在、来店中の客はいません。</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sortedCheckedInCustomers.map((customer) => {
            const customerBalances = balances.get(customer.id) ?? new Map();
            const totalPoints = pointTotals.get(customer.id) ?? 0;
            const customerCategoryTotals = categoryTotals.get(customer.id) ?? new Map();
            const buyInTotal = customerCategoryTotals.get("table_out") ?? 0;
            const outTotal = customerCategoryTotals.get("table_in") ?? 0;
            const prizeTotal = customerCategoryTotals.get("prize") ?? 0;

            return (
              <div
                key={customer.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-500">
                      保有合計 {totalPoints.toLocaleString()} 点
                    </p>
                  </div>
                  <form action={undoCheckIn}>
                    <input type="hidden" name="customerId" value={customer.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`「${customer.name}」のチェックインを取り消しますか？間違えて来店にセットした場合に使ってください（来店頻度の記録からも削除されます）。保有チップ数は変わりません。`}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                    >
                      取消
                    </ConfirmSubmitButton>
                  </form>
                </div>

                {(denominations.some((d) => (customerBalances.get(d.id) ?? 0) !== 0) ||
                  buyInTotal !== 0 ||
                  outTotal !== 0 ||
                  prizeTotal !== 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {denominations
                      .filter((d) => (customerBalances.get(d.id) ?? 0) !== 0)
                      .map((d) => (
                        <span
                          key={d.id}
                          className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                        >
                          {d.label}: {Math.abs(customerBalances.get(d.id) ?? 0).toLocaleString()}
                        </span>
                      ))}
                    {buyInTotal !== 0 && (
                      <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                        バイイン {buyInTotal.toLocaleString()}
                      </span>
                    )}
                    {buyInTotal !== 0 && (
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                        アウト {outTotal.toLocaleString()}
                      </span>
                    )}
                    {prizeTotal !== 0 && (
                      <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                        プライズ獲得 {prizeTotal.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {TRANSACTION_CATEGORIES.map((category) => {
                    const needsDenomination = categoryUsesDenomination(category);
                    const categoryDenominations = needsDenomination
                      ? denominationsForCategory(category, denominations)
                      : [];
                    const disabled = needsDenomination && categoryDenominations.length === 0;
                    const borderClass =
                      category === "table_out"
                        ? "border-red-300"
                        : category === "table_in"
                          ? "border-blue-300"
                          : "border-gray-200";
                    const summaryClass = disabled
                      ? "cursor-not-allowed list-none rounded-md px-3 py-1.5 text-xs font-medium text-gray-400"
                      : category === "table_out"
                        ? "cursor-pointer list-none rounded-md px-3 py-1.5 text-xs font-bold bg-red-200 text-red-900 hover:bg-red-300 group-open:bg-red-300"
                        : category === "table_in"
                          ? "cursor-pointer list-none rounded-md px-3 py-1.5 text-xs font-bold bg-blue-200 text-blue-900 hover:bg-blue-300 group-open:bg-blue-300"
                          : "cursor-pointer list-none rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 group-open:bg-gray-100";
                    return (
                      <details
                        key={category}
                        className={`group rounded-md border ${borderClass}`}
                      >
                        <summary className={summaryClass}>
                          {categoryLabel(category)}
                        </summary>
                        {!disabled && (
                          <form
                            action={recordBoardTransaction}
                            className="flex flex-wrap items-end gap-2 border-t border-gray-200 p-3"
                          >
                            <input type="hidden" name="customerId" value={customer.id} />
                            <input type="hidden" name="category" value={category} />
                            {needsDenomination && (
                              <select
                                name="denominationId"
                                required
                                defaultValue=""
                                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
                              >
                                <option value="" disabled>
                                  額面
                                </option>
                                {categoryDenominations.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            <input
                              type="number"
                              name="quantity"
                              min={
                                category === "table_in"
                                  ? 0
                                  : category === "tournament"
                                    ? undefined
                                    : 1
                              }
                              step={1}
                              required
                              placeholder={
                                category === "tournament" ? "数量（訂正時は-）" : "数量"
                              }
                              className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
                            />
                            <input
                              type="datetime-local"
                              name="createdAt"
                              defaultValue={nowJstLocal}
                              required
                              title="日時（入力し忘れの後追い記録の場合はここで日時を変更）"
                              className="rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                            >
                              確定
                            </button>
                          </form>
                        )}
                      </details>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </section>
    </div>
  );
}
