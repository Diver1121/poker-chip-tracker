"use client";

import { useState } from "react";
import { LineChart } from "@/components/LineChart";

type Mode = "all" | "poker" | "blackjack";

const MODE_LABELS: Record<Mode, string> = {
  all: "全体",
  poker: "ポーカー",
  blackjack: "ブラックジャック",
};

// 全体/ポーカー/ブラックジャックをボタンで切り替えられるLineChart。
// レーキグラフ・客ごとの収支グラフの両方で使う。
export function GameLineChart({
  all,
  poker,
  blackjack,
  color = "#4f46e5",
  gradientId,
  zoomToData = false,
}: {
  all: { date: string; total: number }[];
  poker: { date: string; total: number }[];
  blackjack: { date: string; total: number }[];
  color?: string;
  gradientId: string;
  zoomToData?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("all");
  const data = mode === "all" ? all : mode === "poker" ? poker : blackjack;

  return (
    <div>
      <div className="mb-3 flex gap-2 text-xs">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md border px-3 py-1.5 font-medium ${
              mode === m
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">データがありません。</p>
      ) : (
        <LineChart data={data} color={color} gradientId={gradientId} zoomToData={zoomToData} />
      )}
    </div>
  );
}
