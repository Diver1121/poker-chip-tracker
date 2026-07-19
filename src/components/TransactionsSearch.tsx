"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORY_INFO, quantityUnitLabel } from "@/lib/transactionCategory";
import { toJstDatetimeLocal } from "@/lib/businessDay";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { normalizeForMatch } from "@/lib/textMatch";
import type { ChipTransaction } from "@/lib/types";

type Row = {
  tx: ChipTransaction;
  customerName: string;
  denominationLabel: string | null;
};

export function TransactionsSearch({
  rows,
  updateTransactionDate,
  deleteTransaction,
}: {
  rows: Row[];
  updateTransactionDate: (formData: FormData) => void;
  deleteTransaction: (formData: FormData) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeForMatch(query);

  // 該当する客の取引を上部にまとめる（並べ替えは安定ソートなので、
  // マッチする/しない各グループ内の元の並び順＝日時順は保たれる）
  const sortedRows = normalizedQuery
    ? [...rows].sort((a, b) => {
        const aMatch = normalizeForMatch(a.customerName).includes(normalizedQuery);
        const bMatch = normalizeForMatch(b.customerName).includes(normalizedQuery);
        return aMatch === bMatch ? 0 : aMatch ? -1 : 1;
      })
    : rows;

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="客の名前で検索（該当する取引が上に表示されます）"
        autoComplete="off"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
      />
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">日時</th>
              <th className="px-4 py-2 font-medium">客</th>
              <th className="px-4 py-2 font-medium">種別</th>
              <th className="px-4 py-2 font-medium">額面</th>
              <th className="px-4 py-2 font-medium">枚数</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.map(({ tx, customerName, denominationLabel }) => {
              const isMatch =
                normalizedQuery !== "" &&
                normalizeForMatch(customerName).includes(normalizedQuery);
              return (
                <tr key={tx.id} className={isMatch ? "bg-indigo-50" : undefined}>
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
                        <input type="hidden" name="customerId" value={tx.customer_id} />
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
                    <Link
                      href={`/customers/${tx.customer_id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 ${CATEGORY_INFO[tx.category].badgeClassName}`}
                    >
                      {CATEGORY_INFO[tx.category].label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-900">{denominationLabel ?? "-"}</td>
                  <td className="px-4 py-2 text-gray-900">
                    {tx.quantity} {quantityUnitLabel(tx.category)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={tx.id} />
                      <input type="hidden" name="customerId" value={tx.customer_id} />
                      <ConfirmSubmitButton
                        confirmMessage="この取引を削除しますか？保有枚数の計算からも取り除かれます。"
                        className="text-xs text-red-600 hover:underline"
                      >
                        削除
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
