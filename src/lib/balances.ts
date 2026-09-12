import type { ChipTransaction, Denomination, TransactionCategory, Visit } from "@/lib/types";
import { categorySign } from "@/lib/transactionCategory";
import { businessDateKey } from "@/lib/businessDay";

// customerId -> denominationId -> 現在の保有枚数（purchase/tournamentのみが対象）
export type BalanceMap = Map<string, Map<string, number>>;

export function computeBalances(transactions: ChipTransaction[]): BalanceMap {
  const balances: BalanceMap = new Map();

  for (const tx of transactions) {
    if (!tx.denomination_id) continue;
    const delta = categorySign(tx.category) * tx.quantity;
    if (!balances.has(tx.customer_id)) {
      balances.set(tx.customer_id, new Map());
    }
    const customerBalances = balances.get(tx.customer_id)!;
    customerBalances.set(
      tx.denomination_id,
      (customerBalances.get(tx.denomination_id) ?? 0) + delta,
    );
  }

  return balances;
}

export function computeDenominationTotals(
  transactions: ChipTransaction[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.denomination_id) continue;
    const delta = categorySign(tx.category) * tx.quantity;
    totals.set(tx.denomination_id, (totals.get(tx.denomination_id) ?? 0) + delta);
  }
  return totals;
}

// customerId -> 保有点数合計。purchase/tournamentは額面の点数換算、
// table_out/table_inは入力された点数をそのまま加減算する。
export function computePointTotals(
  transactions: ChipTransaction[],
  denominations: Denomination[],
): Map<string, number> {
  const valueByDenomination = new Map(denominations.map((d) => [d.id, d.value]));
  const totals = new Map<string, number>();

  for (const tx of transactions) {
    const points = tx.denomination_id
      ? tx.quantity * (valueByDenomination.get(tx.denomination_id) ?? 0)
      : tx.quantity;
    const delta = categorySign(tx.category) * points;
    totals.set(tx.customer_id, (totals.get(tx.customer_id) ?? 0) + delta);
  }

  return totals;
}

// 日付（JST）ごとの保有点数合計の推移。dateは "YYYY-MM-DD"、
// deltaはその日の増減、totalはその日終了時点での累計保有点数合計。
export function computeDailyTotals(
  transactions: ChipTransaction[],
  denominations: Denomination[],
): { date: string; delta: number; total: number }[] {
  const valueByDenomination = new Map(denominations.map((d) => [d.id, d.value]));
  const deltaByDate = new Map<string, number>();

  for (const tx of transactions) {
    const points = tx.denomination_id
      ? tx.quantity * (valueByDenomination.get(tx.denomination_id) ?? 0)
      : tx.quantity;
    const delta = categorySign(tx.category) * points;
    const date = businessDateKey(tx.created_at);
    deltaByDate.set(date, (deltaByDate.get(date) ?? 0) + delta);
  }

  const sortedDates = [...deltaByDate.keys()].sort();
  let running = 0;
  return sortedDates.map((date) => {
    const delta = deltaByDate.get(date)!;
    running += delta;
    return { date, delta, total: running };
  });
}

// 日付（JST）ごとの来店（チェックイン）件数。来店頻度グラフに使う。
export function computeDailyVisitCounts(visits: Visit[]): { date: string; count: number }[] {
  const countByDate = new Map<string, number>();

  for (const visit of visits) {
    const date = businessDateKey(visit.checked_in_at);
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }

  return [...countByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

// customerId -> 来店（チェックイン）回数の合計。来店頻度ランキングに使う。
export function computeVisitCountsByCustomer(visits: Visit[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const visit of visits) {
    counts.set(visit.customer_id, (counts.get(visit.customer_id) ?? 0) + 1);
  }
  return counts;
}

// customerId -> 最終来店日時（ISO文字列）。チップ保有期間（来店から1年）の判定に使う。
export function computeLastVisitByCustomer(visits: Visit[]): Map<string, string> {
  const lastVisit = new Map<string, string>();
  for (const visit of visits) {
    const current = lastVisit.get(visit.customer_id);
    if (!current || visit.checked_in_at > current) {
      lastVisit.set(visit.customer_id, visit.checked_in_at);
    }
  }
  return lastVisit;
}

// 店全体の累計バイイン/アウト、およびその差分（レーキ）。
// バイイン(table_out)の合計からアウト(table_in)の合計を引いた分は、
// テーブルに残ったまま回収されていない＝店が徴収したレーキとみなす。
export function computeShopTableTotals(transactions: ChipTransaction[]): {
  buyInTotal: number;
  outTotal: number;
  rake: number;
} {
  let buyInTotal = 0;
  let outTotal = 0;
  for (const tx of transactions) {
    if (tx.category === "table_out") buyInTotal += tx.quantity;
    if (tx.category === "table_in") outTotal += tx.quantity;
  }
  return { buyInTotal, outTotal, rake: buyInTotal - outTotal };
}

// 日付（JST）ごとのバイイン/アウト/トーナメント使用/レーキ。レーキグラフに使う。
// pokerRake/blackjackRakeはそれぞれのゲームのバイイン-アウトのみ（rake = 両者の合計と一致）。
// game未設定（機能追加前の過去データ）のバイイン/アウトはポーカー扱いにする。
// rakeWithTournamentはそれにトーナメント使用分を加えたもの。
// トーナメント使用は額面の枚数で記録されているため、denominationsで点数に換算して合算する
// （訂正用のマイナス入力もそのまま加算されるので相殺される）。
// プライズ獲得（prize）は店から客への払い出しなので、rakeWithTournamentからは差し引く
// （差し引かないと、トーナメントで実際に店が得た取り分より多く見えてしまうため）。
// 取引が無い日はキーごと出現しない（呼び出し側で0埋めする）。
export function computeDailyRakeTotals(
  transactions: ChipTransaction[],
  denominations: Denomination[],
): {
  date: string;
  buyInTotal: number;
  outTotal: number;
  pokerRake: number;
  blackjackRake: number;
  tournamentTotal: number;
  prizeTotal: number;
  rake: number;
  rakeWithTournament: number;
}[] {
  const valueByDenomination = new Map(denominations.map((d) => [d.id, d.value]));
  const totalsByDate = new Map<
    string,
    {
      buyInTotal: number;
      outTotal: number;
      pokerRake: number;
      blackjackRake: number;
      tournamentTotal: number;
      prizeTotal: number;
    }
  >();
  for (const tx of transactions) {
    if (
      tx.category !== "table_out" &&
      tx.category !== "table_in" &&
      tx.category !== "tournament" &&
      tx.category !== "prize"
    ) {
      continue;
    }
    const date = businessDateKey(tx.created_at);
    const current =
      totalsByDate.get(date) ??
      { buyInTotal: 0, outTotal: 0, pokerRake: 0, blackjackRake: 0, tournamentTotal: 0, prizeTotal: 0 };
    if (tx.category === "table_out" || tx.category === "table_in") {
      const delta = (tx.category === "table_out" ? 1 : -1) * tx.quantity;
      if (tx.category === "table_out") current.buyInTotal += tx.quantity;
      else current.outTotal += tx.quantity;
      if (tx.game === "blackjack") current.blackjackRake += delta;
      else current.pokerRake += delta;
    } else if (tx.category === "tournament") {
      current.tournamentTotal += tx.quantity * (valueByDenomination.get(tx.denomination_id ?? "") ?? 0);
    } else {
      current.prizeTotal += tx.quantity;
    }
    totalsByDate.set(date, current);
  }

  return [...totalsByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { buyInTotal, outTotal, pokerRake, blackjackRake, tournamentTotal, prizeTotal }]) => {
      const rake = buyInTotal - outTotal;
      return {
        date,
        buyInTotal,
        outTotal,
        pokerRake,
        blackjackRake,
        tournamentTotal,
        prizeTotal,
        rake,
        rakeWithTournament: rake + tournamentTotal - prizeTotal,
      };
    });
}

// 日付（JST）ごとのポーカーテーブル稼働時間（分）。その日最初のバイイン（table_out）
// から最後のアウト（table_in）までを稼働時間とみなす。ブラックジャックは含めない。
// バイインかアウトの片方しか無い日（営業中でまだアウトが無い当日など）は
// 算出できないため結果に含めない。
export function computeDailyPokerOperatingMinutes(
  transactions: ChipTransaction[],
): Map<string, number> {
  const firstBuyInByDate = new Map<string, number>();
  const lastOutByDate = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.game !== "poker") continue;
    if (tx.category !== "table_out" && tx.category !== "table_in") continue;
    const date = businessDateKey(tx.created_at);
    const time = new Date(tx.created_at).getTime();
    if (tx.category === "table_out") {
      const current = firstBuyInByDate.get(date);
      if (current === undefined || time < current) firstBuyInByDate.set(date, time);
    } else {
      const current = lastOutByDate.get(date);
      if (current === undefined || time > current) lastOutByDate.set(date, time);
    }
  }

  const result = new Map<string, number>();
  for (const [date, firstBuyIn] of firstBuyInByDate) {
    const lastOut = lastOutByDate.get(date);
    if (lastOut === undefined || lastOut <= firstBuyIn) continue;
    result.set(date, Math.round((lastOut - firstBuyIn) / 60000));
  }
  return result;
}

// 客ごとの収支グラフ専用の符号（保有チップ数の符号 categorySign とは別の意味）。
// 購入は手元のチップが増えるだけで収支には関係しない（ノーカウント）。
// バイイン（テーブルへ持ち出し）・トーナメント使用は客が投じた分としてマイナス、
// アウト・プライズ獲得は客が得た分としてプラスで扱う。残高調整は収支に含めない。
function resultSign(category: TransactionCategory): number {
  if (category === "table_in" || category === "prize") return 1;
  if (category === "purchase" || category === "adjustment") return 0;
  return -1;
}

// customerId -> 日付（JST）ごとの収支累計。/statsの客ごと収支比較グラフに使う。
// 客同士で横軸（日付）を揃えて重ねられるよう、取引日時ではなく日付単位で集計する。
export function computeCustomerResultTimelinesByDate(
  transactions: ChipTransaction[],
  denominations: Denomination[],
): Map<string, { date: string; total: number }[]> {
  const valueByDenomination = new Map(denominations.map((d) => [d.id, d.value]));
  const byCustomer = new Map<string, ChipTransaction[]>();
  for (const tx of transactions) {
    if (!byCustomer.has(tx.customer_id)) {
      byCustomer.set(tx.customer_id, []);
    }
    byCustomer.get(tx.customer_id)!.push(tx);
  }

  const result = new Map<string, { date: string; total: number }[]>();
  for (const [customerId, txs] of byCustomer) {
    const sorted = [...txs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const totalByDate = new Map<string, number>();
    let running = 0;
    for (const tx of sorted) {
      const points = tx.denomination_id
        ? tx.quantity * (valueByDenomination.get(tx.denomination_id) ?? 0)
        : tx.quantity;
      running += resultSign(tx.category) * points;
      totalByDate.set(businessDateKey(tx.created_at), running);
    }
    result.set(
      customerId,
      [...totalByDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total })),
    );
  }
  return result;
}

// 客一人分の取引を時系列順に並べ、収支（購入/バイイン/トーナメントは-、アウトは+）を
// 累計したグラフ用データ列。dateは取引日時、deltaはその取引による増減、
// totalはその時点までの収支累計。
export function computeCustomerResultTimeline(
  transactions: ChipTransaction[],
  denominations: Denomination[],
): { id: string; date: string; delta: number; total: number }[] {
  const valueByDenomination = new Map(denominations.map((d) => [d.id, d.value]));
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let running = 0;
  return sorted.map((tx) => {
    const points = tx.denomination_id
      ? tx.quantity * (valueByDenomination.get(tx.denomination_id) ?? 0)
      : tx.quantity;
    const delta = resultSign(tx.category) * points;
    running += delta;
    return { id: tx.id, date: tx.created_at, delta, total: running };
  });
}

// computeCustomerResultTimelineのゲーム限定版。指定ゲームのバイイン/アウトだけを
// 時系列に並べて収支を累計する（トーナメント・購入等は含めない）。
// gameが明示的にタグ付けされた取引だけを対象にし、機能導入前の古いデータは
// 引き継がない（=導入した日から0で始まる）。先頭には0点の起点を1つ足しておく。
export function computeCustomerGameResultTimeline(
  transactions: ChipTransaction[],
  game: "poker" | "blackjack",
): { id: string; date: string; delta: number; total: number }[] {
  const sorted = transactions
    .filter(
      (tx) => (tx.category === "table_out" || tx.category === "table_in") && tx.game === game,
    )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (sorted.length === 0) return [];

  const anchorDate = new Date(new Date(sorted[0].created_at).getTime() - 1000).toISOString();
  const series: { id: string; date: string; delta: number; total: number }[] = [
    { id: "start", date: anchorDate, delta: 0, total: 0 },
  ];

  let running = 0;
  for (const tx of sorted) {
    const delta = (tx.category === "table_in" ? 1 : -1) * tx.quantity;
    running += delta;
    series.push({ id: tx.id, date: tx.created_at, delta, total: running });
  }
  return series;
}

// 額面（denomination）ごとの購入回数・購入枚数の集計。/statsの購入内訳表に使う。
export function computePurchaseTotalsByDenomination(
  transactions: ChipTransaction[],
): Map<string, { count: number; quantity: number }> {
  const totals = new Map<string, { count: number; quantity: number }>();
  for (const tx of transactions) {
    if (tx.category !== "purchase" || !tx.denomination_id) continue;
    const current = totals.get(tx.denomination_id) ?? { count: 0, quantity: 0 };
    current.count += 1;
    current.quantity += tx.quantity;
    totals.set(tx.denomination_id, current);
  }
  return totals;
}

// customerId -> category -> 入力された点数の合計（符号なし、そのまま合算）。
// 「バイイン合計」「アウト合計」のように、カテゴリごとの動きをそのまま見せたい場合に使う。
export function computeCategoryQuantityTotals(
  transactions: ChipTransaction[],
): Map<string, Map<TransactionCategory, number>> {
  const totals = new Map<string, Map<TransactionCategory, number>>();
  for (const tx of transactions) {
    if (!totals.has(tx.customer_id)) {
      totals.set(tx.customer_id, new Map());
    }
    const customerTotals = totals.get(tx.customer_id)!;
    customerTotals.set(
      tx.category,
      (customerTotals.get(tx.category) ?? 0) + tx.quantity,
    );
  }
  return totals;
}
