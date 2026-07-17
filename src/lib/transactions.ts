import { getSupabaseClient } from "@/lib/supabase";
import {
  categoryUsesDenomination,
  isTransactionCategory,
} from "@/lib/transactionCategory";
import type { TransactionCategory } from "@/lib/types";

export async function insertChipTransaction({
  customerId,
  denominationId,
  category,
  quantity,
  createdAt,
}: {
  customerId: string;
  denominationId: string;
  category: string;
  quantity: number;
  // 未指定ならDB側のdefault now()が使われる。入力し忘れの後追い記録用に、
  // 過去の営業日の時刻を指定できるようにするためのオプション項目。
  createdAt?: string;
}): Promise<string> {
  if (
    !customerId ||
    !isTransactionCategory(category) ||
    !Number.isInteger(quantity)
  ) {
    throw new Error("入力内容が正しくありません。");
  }

  // アウト(table_in)は0（全部負けて手元に残らなかった）もあり得るため0を許可する。
  // トーナメント使用(tournament)は入力ミスの訂正用にマイナスも許可する（0は不可）。
  // それ以外は0枚/0点の記録に意味がないため1以上を必須にする。
  if (category === "table_in") {
    if (quantity < 0) throw new Error("入力内容が正しくありません。");
  } else if (category === "tournament") {
    if (quantity === 0) throw new Error("入力内容が正しくありません。");
  } else if (quantity < 1) {
    throw new Error("入力内容が正しくありません。");
  }

  const needsDenomination = categoryUsesDenomination(category);
  if (needsDenomination && !denominationId) {
    throw new Error("額面を選択してください。");
  }

  if (needsDenomination) {
    await assertDenominationAllowedForCategory(denominationId, category);
  }

  const { data, error } = await getSupabaseClient()
    .from("chip_transactions")
    .insert({
      customer_id: customerId,
      denomination_id: needsDenomination ? denominationId : null,
      category,
      quantity,
      ...(createdAt ? { created_at: createdAt } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function assertDenominationAllowedForCategory(
  denominationId: string,
  category: TransactionCategory,
) {
  const { data, error } = await getSupabaseClient()
    .from("denominations")
    .select("usable_for_purchase, usable_for_tournament")
    .eq("id", denominationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("指定された額面が見つかりません。");
  }

  const allowed =
    category === "purchase" ? data.usable_for_purchase : data.usable_for_tournament;
  if (!allowed) {
    throw new Error("この額面はこの種別では使用できません。");
  }
}
