import type { Denomination, TransactionCategory } from "@/lib/types";

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  "purchase",
  "table_out",
  "table_in",
  "tournament",
  "prize",
];

export const CATEGORY_INFO: Record<
  TransactionCategory,
  { label: string; sign: 1 | -1; badgeClassName: string }
> = {
  purchase: {
    label: "購入",
    sign: 1,
    badgeClassName: "bg-emerald-100 text-emerald-800",
  },
  table_out: {
    label: "バイイン",
    sign: -1,
    badgeClassName: "bg-amber-100 text-amber-800",
  },
  table_in: {
    label: "アウト",
    sign: 1,
    badgeClassName: "bg-sky-100 text-sky-800",
  },
  tournament: {
    label: "トーナメント使用",
    sign: -1,
    badgeClassName: "bg-rose-100 text-rose-800",
  },
  prize: {
    label: "プライズ獲得",
    sign: 1,
    badgeClassName: "bg-purple-100 text-purple-800",
  },
  adjustment: {
    label: "残高調整",
    sign: 1,
    badgeClassName: "bg-gray-100 text-gray-700",
  },
};

export function categoryLabel(category: TransactionCategory) {
  return CATEGORY_INFO[category].label;
}

export function categorySign(category: TransactionCategory) {
  return CATEGORY_INFO[category].sign;
}

export function isTransactionCategory(
  value: string,
): value is TransactionCategory {
  return Object.prototype.hasOwnProperty.call(CATEGORY_INFO, value);
}

// purchase/tournament は額面ごとの枚数を扱うため額面選択が必須。
// table_out/table_in は額面を問わず合計点数のみ扱うため額面選択なし。
export function categoryUsesDenomination(category: TransactionCategory) {
  return category === "purchase" || category === "tournament";
}

export function quantityUnitLabel(category: TransactionCategory) {
  return categoryUsesDenomination(category) ? "枚" : "点";
}

// カテゴリごとに選べる額面だけを絞り込む（購入用/トーナメント用の混在を防ぐ）
export function denominationsForCategory(
  category: TransactionCategory,
  denominations: Denomination[],
): Denomination[] {
  if (category === "purchase") {
    return denominations.filter((d) => d.usable_for_purchase);
  }
  if (category === "tournament") {
    return denominations.filter((d) => d.usable_for_tournament);
  }
  return [];
}
