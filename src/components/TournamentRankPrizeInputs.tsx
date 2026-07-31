"use client";

import { useRef } from "react";

// 順位欄に数値を入力すると、プライズ計算済みの配分表(prizeAmounts、0番目が1位)から
// 対応する獲得点数を獲得欄に「加算」する（上書きではない。獲得欄に既に手入力の
// 数値があってもそれは消さない）。順位を入力し直した/消したときは、前回その順位分
// として足した金額をいったん差し引いてから、新しい順位の分を足し直す
// （そうしないと、入力ミスを直したときに古い加算分が獲得欄に残ってしまう）。
export function TournamentRankPrizeInputs({
  rowIndex,
  defaultRank,
  defaultPrizeAmount,
  prizeAmounts,
  className,
}: {
  rowIndex: number;
  defaultRank: number | "";
  defaultPrizeAmount: number | "";
  prizeAmounts: number[];
  className?: string;
}) {
  const prizeInputRef = useRef<HTMLInputElement>(null);
  // このコンポーネントがこれまでに獲得欄へ加算した金額（手入力分と区別するため）
  const lastContributionRef = useRef(0);

  function handleRankChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rank = Number(e.target.value);
    const contribution =
      Number.isInteger(rank) && rank >= 1 && rank <= prizeAmounts.length
        ? prizeAmounts[rank - 1]
        : 0;
    const delta = contribution - lastContributionRef.current;
    lastContributionRef.current = contribution;
    if (delta !== 0 && prizeInputRef.current) {
      const current = Number(prizeInputRef.current.value) || 0;
      prizeInputRef.current.value = String(current + delta);
    }
  }

  return (
    <>
      <input
        name={`rank-${rowIndex}`}
        type="number"
        step={1}
        defaultValue={defaultRank}
        placeholder="-"
        className={className}
        onChange={handleRankChange}
      />
      <input
        ref={prizeInputRef}
        name={`prizeAmount-${rowIndex}`}
        type="number"
        step={1}
        defaultValue={defaultPrizeAmount}
        placeholder="0"
        className={className}
      />
    </>
  );
}
