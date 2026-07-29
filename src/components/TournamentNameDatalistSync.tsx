"use client";

import { useEffect } from "react";

// NAME欄に入力するたび、既に他の行で使われている名前を候補（datalist）から除外する。
// 40行ぶんの入力にそれぞれコンポーネントを持たせる代わりに、documentレベルで
// input イベントを拾って共有のdatalistを書き換える（イベント委譲）。
export function TournamentNameDatalistSync({ datalistId }: { datalistId: string }) {
  useEffect(() => {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;

    let allNames: string[] = [];
    try {
      allNames = JSON.parse(datalist.dataset.allNames ?? "[]");
    } catch {
      allNames = [];
    }

    function refresh() {
      const used = new Set(
        Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="name-"]'))
          .map((el) => el.value.trim())
          .filter(Boolean),
      );
      const options = allNames
        .filter((n) => !used.has(n))
        .map((n) => {
          const opt = document.createElement("option");
          opt.value = n;
          return opt;
        });
      datalist?.replaceChildren(...options);
    }

    function handleInput(e: Event) {
      const target = e.target;
      if (target instanceof HTMLInputElement && target.name.startsWith("name-")) {
        refresh();
      }
    }

    document.addEventListener("input", handleInput);
    return () => document.removeEventListener("input", handleInput);
  }, [datalistId]);

  return null;
}
