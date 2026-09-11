"use client";

import { useLinkStatus } from "next/link";

// タップ直後、ページ切り替えが終わるまでの間もその場で押した反応が見えるようにする
// （useLinkStatusはLinkの子コンポーネントの中でしか呼べないため、ここで分離している）。
export function LinkPendingDot({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className={`ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 align-middle ${className}`}
      aria-hidden
    />
  );
}
