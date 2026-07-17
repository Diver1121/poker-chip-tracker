import { getAllTransactions, getCustomers, getDenominations } from "@/lib/data";
import { TransactionsSearch } from "@/components/TransactionsSearch";
import { deleteTransaction, updateTransactionDate } from "./actions";

export default async function TransactionsPage() {
  const [transactions, customers, denominations] = await Promise.all([
    getAllTransactions(),
    getCustomers(),
    getDenominations(),
  ]);

  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const denominationLabel = new Map(denominations.map((d) => [d.id, d.label]));

  const rows = transactions.map((tx) => ({
    tx,
    customerName: customerName.get(tx.customer_id) ?? "(削除済み)",
    denominationLabel: tx.denomination_id
      ? (denominationLabel.get(tx.denomination_id) ?? "(削除済み)")
      : null,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">取引履歴</h1>
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-500">まだ取引がありません。</p>
      ) : (
        <TransactionsSearch
          rows={rows}
          updateTransactionDate={updateTransactionDate}
          deleteTransaction={deleteTransaction}
        />
      )}
    </div>
  );
}
