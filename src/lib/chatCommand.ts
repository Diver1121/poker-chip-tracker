import {
  TRANSACTION_CATEGORIES,
  categoryLabel,
  categoryUsesDenomination,
  denominationsForCategory,
} from "@/lib/transactionCategory";
import type { Customer, Denomination, TransactionCategory } from "@/lib/types";

// 「ダイバー　購入300」「ダイバー　トーナメントターボ」のような一行コマンドから
// 客・種別・額面・枚数を読み取る。曖昧な場合や候補が複数/0件の場合は自動選択せずエラーにする。

const CATEGORY_ALIASES: Record<TransactionCategory, string[]> = {
  purchase: ["購入"],
  table_out: ["バイイン"],
  table_in: ["アウト"],
  tournament: ["トーナメント使用", "トーナメント"],
  prize: ["プライズ獲得", "プライズ"],
  adjustment: [],
};

export type ParsedChatCommand =
  | {
      ok: true;
      customerId: string;
      customerName: string;
      // 入力欄に打たれた客名がそのまま完全一致したか、部分一致で1件に絞り込んだかの区別。
      // partialの場合は誤爆の可能性があるため呼び出し側で警告を出す。
      customerMatchType: "exact" | "partial";
      customerQuery: string;
      category: TransactionCategory;
      categoryLabel: string;
      denominationId?: string;
      denominationLabel?: string;
      quantity: number;
    }
  | { ok: false; error: string };

function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .trim();
}

function labelDigits(label: string): string {
  return label.match(/\d+/)?.[0] ?? label;
}

// textからkeywordの部分を取り除き、空白1つに置き換える（前後の語が結合しないように）
function removeKeyword(text: string, index: number, length: number): string {
  return text.slice(0, index) + " " + text.slice(index + length);
}

function extractNumbers(text: string): string[] {
  return [...text.matchAll(/-?\d+/g)].map((m) => m[0]);
}

function stripNumbers(text: string): string {
  return text.replace(/-?\d+/g, " ").replace(/\s+/g, " ").trim();
}

// 額面のラベル本体、または設定画面で登録した別名（例:「ターボ」「turbo」）が
// テキスト中に含まれていれば、その額面を選ぶ。大文字小文字は区別しない。
function findDenominationByKeyword(
  haystack: string,
  candidates: Denomination[],
): { denomination: Denomination; index: number; length: number } | null {
  const lowerHaystack = haystack.toLowerCase();
  let best: { denomination: Denomination; index: number; length: number } | null = null;
  for (const denomination of candidates) {
    const keywords = [denomination.label, ...denomination.aliases];
    for (const keyword of keywords) {
      const lowerKeyword = keyword.trim().toLowerCase();
      if (!lowerKeyword) continue;
      const index = lowerHaystack.indexOf(lowerKeyword);
      if (index === -1) continue;
      if (
        !best ||
        index < best.index ||
        (index === best.index && lowerKeyword.length > best.length)
      ) {
        best = { denomination, index, length: lowerKeyword.length };
      }
    }
  }
  return best;
}

export function parseChatCommand(
  rawText: string,
  customers: Customer[],
  denominations: Denomination[],
): ParsedChatCommand {
  const text = normalize(rawText);
  if (!text) {
    return { ok: false, error: "入力してください。" };
  }

  let bestMatch: { category: TransactionCategory; alias: string; index: number } | null = null;
  for (const category of TRANSACTION_CATEGORIES) {
    for (const alias of CATEGORY_ALIASES[category]) {
      const index = text.indexOf(alias);
      if (index === -1) continue;
      if (
        !bestMatch ||
        index < bestMatch.index ||
        (index === bestMatch.index && alias.length > bestMatch.alias.length)
      ) {
        bestMatch = { category, alias, index };
      }
    }
  }

  if (!bestMatch) {
    return {
      ok: false,
      error: "種別が読み取れません（購入・バイイン・アウト・トーナメント・プライズ のいずれかを含めてください）。",
    };
  }

  const category = bestMatch.category;
  // 種別キーワードを取り除いた残り。ここから額面・枚数・客名を読み取る。
  const withoutCategory = removeKeyword(text, bestMatch.index, bestMatch.alias.length);

  let denomination: Denomination | undefined;
  let denomQuantitySource = withoutCategory;

  if (categoryUsesDenomination(category)) {
    const candidates = denominationsForCategory(category, denominations);

    // まず額面のラベル/別名（「ターボ」「K.O.BOUNTY」など文字のキーワード）で探す。
    const byKeyword = findDenominationByKeyword(withoutCategory, candidates);
    if (byKeyword) {
      denomination = byKeyword.denomination;
      denomQuantitySource = removeKeyword(withoutCategory, byKeyword.index, byKeyword.length);
    } else {
      // 見つからなければ「300」のような数字を額面ラベルの数字部分と突き合わせる。
      const numbers = extractNumbers(withoutCategory);
      if (numbers.length === 0) {
        return {
          ok: false,
          error: `額面が読み取れません（例: ${categoryLabel(category)}300 / ${categoryLabel(category)}ターボ）。`,
        };
      }
      const denomNumber = numbers[0];
      denomination =
        candidates.find((d) => labelDigits(d.label) === denomNumber) ??
        candidates.find((d) => d.label === denomNumber);
      if (!denomination) {
        return {
          ok: false,
          error: `額面「${denomNumber}」が見つかりません（使える額面: ${candidates.map((d) => d.label).join("、") || "なし"}）。`,
        };
      }
      // 額面番号として使った数字は枚数に使わないよう取り除く
      denomQuantitySource = withoutCategory.replace(denomNumber, " ");
    }
  }

  const numbersForQuantity = extractNumbers(denomQuantitySource);
  const quantity =
    categoryUsesDenomination(category)
      ? numbersForQuantity[0]
        ? Number(numbersForQuantity[0])
        : 1
      : numbersForQuantity[0]
        ? Number(numbersForQuantity[0])
        : undefined;

  if (!categoryUsesDenomination(category) && quantity === undefined) {
    return {
      ok: false,
      error: `枚数（点数）が読み取れません（例: ${categoryLabel(category)}500）。`,
    };
  }

  const customerQueryRaw = stripNumbers(denomQuantitySource);
  if (!customerQueryRaw) {
    return { ok: false, error: "客の名前が読み取れません。" };
  }
  const customerQuery = customerQueryRaw.replace(/(さん|様)$/, "").trim();

  const exact = customers.find((c) => c.name === customerQueryRaw || c.name === customerQuery);
  let matchedCustomer: Customer | undefined = exact;
  let customerMatchType: "exact" | "partial" = "exact";
  if (!matchedCustomer) {
    const partial = customers.filter(
      (c) => c.name.includes(customerQuery) || customerQuery.includes(c.name),
    );
    if (partial.length === 1) {
      matchedCustomer = partial[0];
      customerMatchType = "partial";
    } else if (partial.length > 1) {
      return {
        ok: false,
        error: `客名「${customerQuery}」が複数の候補に一致しました（${partial.map((c) => c.name).join("、")}）。正式な名前で入力してください。`,
      };
    }
  }
  if (!matchedCustomer) {
    return { ok: false, error: `客「${customerQuery}」が見つかりません。` };
  }

  return {
    ok: true,
    customerId: matchedCustomer.id,
    customerName: matchedCustomer.name,
    customerMatchType,
    customerQuery,
    category,
    categoryLabel: categoryLabel(category),
    denominationId: denomination?.id,
    denominationLabel: denomination?.label,
    quantity: quantity as number,
  };
}
