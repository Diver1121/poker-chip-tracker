"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";
import { businessDateKey } from "@/lib/businessDay";

// トーナメント成績ランキング/シリーズトーナメントポイントの投稿ボタンが押された記録を残す。
// 来店中ボードのナビに出す「押し忘れ！」の判定（src/lib/operationalAlerts.ts）に使うだけで、
// 投稿ボタン自体の動作（共有・コピー）には影響しない。
export async function recordRankingShare(rankingType: "tournament" | "series") {
  await requireAuth();

  const { error } = await getSupabaseClient().from("ranking_share_log").insert({
    ranking_type: rankingType,
    business_date: businessDateKey(new Date()),
  });
  if (error) throw error;

  revalidatePath("/ranking");
  revalidatePath("/board");
  revalidatePath("/tournament");
}
