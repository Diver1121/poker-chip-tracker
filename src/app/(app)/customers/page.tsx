import { getCustomers } from "@/lib/data";
import { CustomerListSearch } from "@/components/CustomerListSearch";
import { createCustomer } from "./actions";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, customers] = await Promise.all([searchParams, getCustomers()]);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold text-gray-900">客一覧（{customers.length}人）</h1>

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
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            登録
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">客を検索</h2>
        <CustomerListSearch customers={customers} />
      </section>
    </div>
  );
}
