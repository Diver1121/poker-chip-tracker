"use client";

import { useState } from "react";
import { LineChart } from "@/components/LineChart";

export function ShopCurrentTotalCard({
  shopCurrentTotal,
  businessStartTotal,
  dailyTotals,
}: {
  shopCurrentTotal: number;
  businessStartTotal: number;
  dailyTotals: { date: string; delta: number; total: number }[];
}) {
  const [showChart, setShowChart] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">店全体の保有チップ量（現在）</p>
      <p className="text-3xl font-bold text-indigo-600">
        {shopCurrentTotal.toLocaleString()}
        <span className="ml-1 text-sm font-normal text-gray-500">点</span>
      </p>
      <button
        type="button"
        onClick={() => setShowChart((v) => !v)}
        className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        {showChart ? "グラフを閉じる" : "グラフを表示"}
      </button>
      {showChart && (
        <div className="mt-3">
          {dailyTotals.length === 0 ? (
            <p className="text-sm text-gray-500">まだ取引がありません。</p>
          ) : (
            <LineChart
              data={dailyTotals}
              color="#4f46e5"
              gradientId="shopTotalFill"
              zoomToData
              referenceLine={{ label: "営業開始", value: businessStartTotal }}
            />
          )}
        </div>
      )}
    </div>
  );
}
