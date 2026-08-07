// トーナメントのプライズ配分。対象人数ごとに「上位ほど多く、人数が増えるほど
// 緩やかに減る」配分率(%)を調和数列(1/順位)ベースで算出し、合計が
// ちょうど100%になるよう端数を上位から大きい順に配る（最大剰余法）。
function payoutPercentages(count: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => 1 / (i + 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / weightSum) * 100);
  const floors = raw.map(Math.floor);
  const remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) floors[byFraction[k].i] += 1;
  return floors;
}

// プライズ総額(点)を対象人数に配分し、各順位の獲得点数を返す（配列の0番目が1位）。
// 配分率を掛けた際の端数は最下位に寄せて、合計が必ずprizeTotalと一致するようにする。
// さらに1位以外は一の位を切り捨て、切り捨てた分は全て1位に加算する。
export function computePrizeAmounts(prizeCount: number, prizeTotal: number): number[] {
  if (prizeCount <= 0 || prizeTotal <= 0) return [];
  const percentages = payoutPercentages(prizeCount);
  const amounts = percentages.map((p) => Math.round((prizeTotal * p) / 100));
  const diff = prizeTotal - amounts.reduce((a, b) => a + b, 0);
  if (diff !== 0) amounts[amounts.length - 1] += diff;

  let carry = 0;
  for (let i = 1; i < amounts.length; i++) {
    const rounded = Math.floor(amounts[i] / 10) * 10;
    carry += amounts[i] - rounded;
    amounts[i] = rounded;
  }
  amounts[0] += carry;

  return amounts;
}
