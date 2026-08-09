"use client";

import { useEffect, useState } from "react";

// チップ回数・アドオン回数の入力欄とこの表示欄は、グリッド表の離れた列にある
// 別々のコンポーネントのため、共通の親でstateを持てない。そのためinput要素の
// name属性を頼りに、document越しのinputイベント委譲で入力値を追いかけている
// （NumberStepperInputの△▽ボタンもクリック時にinputイベントを発火させる実装にしてある）。
export function TournamentChipBalance({
  chipInputName,
  addonInputName,
  defaultChipCount,
  defaultAddonCount,
  chipValue,
  addonValue,
  baseBalance,
}: {
  chipInputName: string;
  addonInputName: string;
  defaultChipCount: number;
  defaultAddonCount: number;
  chipValue: number;
  addonValue: number;
  baseBalance: number;
}) {
  const [chipCount, setChipCount] = useState(defaultChipCount);
  const [addonCount, setAddonCount] = useState(defaultAddonCount);

  useEffect(() => {
    function handleInput(e: Event) {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.name === chipInputName) {
        setChipCount(Number(target.value) || 0);
      } else if (target.name === addonInputName) {
        setAddonCount(Number(target.value) || 0);
      }
    }
    document.addEventListener("input", handleInput);
    return () => document.removeEventListener("input", handleInput);
  }, [chipInputName, addonInputName]);

  const balance = baseBalance - chipCount * chipValue - addonCount * addonValue;

  return (
    <span
      className={`text-sm font-medium ${balance < 0 ? "text-red-600" : "text-gray-600"}`}
    >
      {balance.toLocaleString()}
    </span>
  );
}
