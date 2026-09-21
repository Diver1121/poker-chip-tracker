"use client";

import { useState } from "react";

// データページが縦に長くなりすぎたため、目的別にタブへ分けて必要な部分だけ見えるようにする。
// 各タブの中身はサーバーコンポーネントのままここへ子要素として渡ってくる
// （タブ切り替え自体だけをクライアント側で行う）。
export function StatsTabSwitcher({
  tabs,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
}) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-gray-300 p-0.5 text-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveKey(tab.key)}
            className={`rounded px-3 py-1.5 font-medium ${
              activeTab?.key === tab.key
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="space-y-8">{activeTab?.content}</div>
    </div>
  );
}
