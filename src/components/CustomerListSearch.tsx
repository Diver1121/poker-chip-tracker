"use client";

import Link from "next/link";
import { useState } from "react";

export function CustomerListSearch({
  customers,
}: {
  customers: { id: string; name: string; note: string | null }[];
}) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? customers.filter((c) => c.name.includes(query))
    : customers;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="客の名前で検索"
        autoComplete="off"
        className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">該当する客がいません。</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="block px-4 py-3 hover:bg-gray-50"
            >
              <p className="font-medium text-gray-900">{c.name}</p>
              {c.note && <p className="text-sm text-gray-500">{c.note}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
