"use client";

import { useState, type ReactNode } from "react";

export type StatBreakdownRow = { label: string; value: string };

export function ExpandableStatCard({
  label,
  value,
  caption,
  breakdown,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  breakdown?: StatBreakdownRow[];
}) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = Boolean(breakdown && breakdown.length > 0);

  return (
    <div
      role={hasBreakdown ? "button" : undefined}
      tabIndex={hasBreakdown ? 0 : undefined}
      onClick={hasBreakdown ? () => setOpen((v) => !v) : undefined}
      onKeyDown={
        hasBreakdown
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((v) => !v);
              }
            }
          : undefined
      }
      className={`rounded-md border border-gray-200 bg-white p-3 ${
        hasBreakdown ? "cursor-pointer hover:bg-gray-50" : ""
      }`}
    >
      <p className="text-xs text-gray-500">
        {label}
        {hasBreakdown && "（タップで月別）"}
      </p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {caption && <p className="text-xs text-gray-400">{caption}</p>}
      {open && breakdown && (
        <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto border-t border-gray-100 pt-2 text-left text-xs text-gray-500">
          {breakdown.map((row) => (
            <p key={row.label} className="flex justify-between gap-2">
              <span>{row.label}</span>
              <span className="text-gray-700">{row.value}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
