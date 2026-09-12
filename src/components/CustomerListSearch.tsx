"use client";

import Link from "next/link";
import { useState } from "react";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import { normalizeForMatch } from "@/lib/textMatch";

type SortMode = "name" | "holding";

// 600人近い客を一度に全員レンダリングすると重いため、まずこの件数だけ表示し、
// 「もっと見る」を押すたびに追加で出す。検索・並び替えを変えたら最初からやり直す。
const PAGE_SIZE = 50;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const normalizedQuery = normalizeForMatch(query);
  const filtered = normalizedQuery
    ? customers.filter((c) => normalizeForMatch(c.name).includes(normalizedQuery))
    : customers;
  // customersはサーバー側ですでに五十音順。保有数順のときだけ並べ替える。
  const sorted =
    sortMode === "holding" ? [...filtered].sort((a, b) => b.holding - a.holding) : filtered;
  const visible = sorted.slice(0, visibleCount);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setVisibleCount(PAGE_SIZE);
        }}
        placeholder="客の名前で検索"
        autoComplete="off"
        className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
      />
      <div className="mb-3 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setSortMode("name");
            setVisibleCount(PAGE_SIZE);
          }}
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
          onClick={() => {
            setSortMode("holding");
            setVisibleCount(PAGE_SIZE);
          }}
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
        <>
          <p className="mb-2 text-xs text-gray-500">
            {sorted.length.toLocaleString()}人中 {visible.length.toLocaleString()}人を表示
          </p>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {visible.map((c) => {
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
                      <LinkPendingDot />
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
          {visibleCount < sorted.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="mt-3 w-full rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              もっと見る（残り{(sorted.length - visibleCount).toLocaleString()}人）
            </button>
          )}
        </>
      )}
    </div>
  );
}
