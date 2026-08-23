"use client";

import Link from "next/link";
import { useState } from "react";
import { normalizeForMatch } from "@/lib/textMatch";

type SortMode = "name" | "holding";

export function CustomerListSearch({
  customers,
}: {
  customers: {
    id: string;
    name: string;
    note: string | null;
    holding: number;
    lastVisit: string | null;
  }[];
}) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const normalizedQuery = normalizeForMatch(query);
  const filtered = normalizedQuery
    ? customers.filter((c) => normalizeForMatch(c.name).includes(normalizedQuery))
    : customers;
  // customersはサーバー側ですでに五十音順。保有数順のときだけ並べ替える。
  const sorted =
    sortMode === "holding" ? [...filtered].sort((a, b) => b.holding - a.holding) : filtered;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="客の名前で検索"
        autoComplete="off"
        className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
      />
      <div className="mb-3 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setSortMode("name")}
          className={`rounded-md border px-3 py-1.5 font-medium ${
            sortMode === "name"
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          五十音順
        </button>
        <button
          type="button"
          onClick={() => setSortMode("holding")}
          className={`rounded-md border px-3 py-1.5 font-medium ${
            sortMode === "holding"
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          保有数の多い順
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">該当する客がいません。</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {sorted.map((c) => {
            const expanded = expandedId === c.id;
            return (
              <div key={c.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(expanded ? null : c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(expanded ? null : c.id);
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <Link
                      href={`/customers/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-gray-400">
                      最終来店:{" "}
                      {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString("ja-JP") : "来店記録なし"}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm text-gray-500">
                    {c.holding.toLocaleString()}点
                  </p>
                </div>
                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-sm text-gray-600">
                    {c.note || "備考なし"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
