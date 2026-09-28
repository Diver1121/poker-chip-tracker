import { cache } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { businessDateKey } from "@/lib/businessDay";
import { SERIES_START_DATE } from "@/lib/seriesConfig";

// この機能をデプロイした日。ランキング投稿の記録（ranking_share_log）はこの日から
// 取り始めるため、それより前のトーナメントは「投稿していない」も「順位未入力」も
// 今さら直しようがない過去分として対象外にする（この日以降の回だけをチェックする）。
const ALERTS_START_DATE = "2026-09-28";

export type PendingTournamentSession = {
  id: string;
  dayKey: string;
  label: string;
  missingRank: boolean;
  missingBounty: boolean;
};

export type PendingRankingShareDay = {
  dayKey: string;
  missingTournamentShare: boolean;
  missingSeriesShare: boolean;
};

export type OperationalAlerts = {
  boardClosePendingDayKey: string | null;
  pendingTournamentSessions: PendingTournamentSession[];
  pendingRankingShareDays: PendingRankingShareDay[];
};

// レイアウトのナビバッジと各ページのバナーが同じ内容を必要とするため、
// 1リクエスト内で何度呼ばれても実際のDB問い合わせは1回だけにする。
export const getOperationalAlerts = cache(async (): Promise<OperationalAlerts> => {
  const supabase = getSupabaseClient();
  const todayKey = businessDateKey(new Date());

  const [
    { data: checkedInCustomers, error: customersError },
    { data: tournaments, error: tournamentsError },
    { data: mysteryBountyDenoms, error: denomError },
    { data: shareLogRows, error: shareLogError },
  ] = await Promise.all([
    supabase.from("customers").select("checked_in_at").not("checked_in_at", "is", null),
    // 営業日はJST5時区切りなのでUTCの日付とは1日ずれ得る。SQL側の絞り込みは
    // 安全マージンとして1日早めに取り、正確な判定はbusinessDateKeyでJS側で行う。
    supabase
      .from("tournaments")
      .select("id, label, denomination_id, created_at")
      .gte(
        "created_at",
        new Date(new Date(`${ALERTS_START_DATE}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000).toISOString(),
      ),
    supabase.from("denominations").select("id").eq("is_mystery_bounty", true),
    supabase
      .from("ranking_share_log")
      .select("ranking_type, business_date")
      .gte("business_date", ALERTS_START_DATE),
  ]);
  if (customersError) throw customersError;
  if (tournamentsError) throw tournamentsError;
  if (denomError) throw denomError;
  if (shareLogError) throw shareLogError;

  // 1. 営業終了忘れ: 前営業日以前からチェックインしたままの客がいないか
  const pastCheckInDays = checkedInCustomers
    .map((c) => businessDateKey(c.checked_in_at as string))
    .filter((d) => d < todayKey)
    .sort();
  const boardClosePendingDayKey = pastCheckInDays[0] ?? null;

  // 対象トーナメントの回だけ、エントリーを絞って取得する（全件のtournament_entriesは不要）。
  const tournamentIds = tournaments.map((t) => t.id);
  const entries =
    tournamentIds.length === 0
      ? []
      : await (async () => {
          const { data, error } = await supabase
            .from("tournament_entries")
            .select("tournament_id, rank, bounty_points")
            .in("tournament_id", tournamentIds);
          if (error) throw error;
          return data;
        })();

  const isMysteryBountyDenom = new Set(mysteryBountyDenoms.map((d) => d.id));
  const entriesByTournament = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!e.tournament_id) continue;
    const list = entriesByTournament.get(e.tournament_id) ?? [];
    list.push(e);
    entriesByTournament.set(e.tournament_id, list);
  }

  // 2. トーナメント結果入力忘れ: 過去営業日の回で、順位が1件も入っていない/
  //    ミステリーバウンティの回なのにバウンティが1件も入っていない
  const pendingTournamentSessions: PendingTournamentSession[] = [];
  for (const t of tournaments) {
    const dayKey = businessDateKey(t.created_at);
    if (dayKey < ALERTS_START_DATE) continue; // この機能のデプロイより前の回は対象外
    if (dayKey >= todayKey) continue; // 今日の回はまだ進行中の可能性があるので対象外
    const sessionEntries = entriesByTournament.get(t.id) ?? [];
    if (sessionEntries.length === 0) continue; // エントリーが無い回は何も入力しようがない
    const missingRank = sessionEntries.every((e) => e.rank === null);
    const missingBounty =
      t.denomination_id !== null &&
      isMysteryBountyDenom.has(t.denomination_id) &&
      sessionEntries.every((e) => e.bounty_points === 0);
    if (missingRank || missingBounty) {
      pendingTournamentSessions.push({
        id: t.id,
        dayKey,
        label: t.label || "トーナメント",
        missingRank,
        missingBounty,
      });
    }
  }
  pendingTournamentSessions.sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  // 3. ランキング投稿忘れ: 過去営業日にトーナメントがあった日で、その日の投稿記録が無い
  const tournamentDayKeys = new Set(
    tournaments
      .map((t) => businessDateKey(t.created_at))
      .filter((d) => d >= ALERTS_START_DATE && d < todayKey),
  );
  const sharedDaysByType = new Map<string, Set<string>>();
  for (const row of shareLogRows) {
    const set = sharedDaysByType.get(row.ranking_type) ?? new Set<string>();
    set.add(row.business_date);
    sharedDaysByType.set(row.ranking_type, set);
  }
  const sharedTournamentDays = sharedDaysByType.get("tournament") ?? new Set<string>();
  const sharedSeriesDays = sharedDaysByType.get("series") ?? new Set<string>();

  const pendingRankingShareDays: PendingRankingShareDay[] = [];
  for (const dayKey of tournamentDayKeys) {
    const missingTournamentShare = !sharedTournamentDays.has(dayKey);
    // シリーズ開始日より前の回はそもそもシリーズポイントが存在しないので対象外
    const missingSeriesShare = dayKey >= SERIES_START_DATE && !sharedSeriesDays.has(dayKey);
    if (missingTournamentShare || missingSeriesShare) {
      pendingRankingShareDays.push({ dayKey, missingTournamentShare, missingSeriesShare });
    }
  }
  pendingRankingShareDays.sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  return { boardClosePendingDayKey, pendingTournamentSessions, pendingRankingShareDays };
});
