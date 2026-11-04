"use client";

import { useEffect } from "react";
import Link from "next/link";

// 今までエラー境界が無く、保存操作等で例外が起きるとNext.jsの素のクラッシュ画面
// （黒背景に英語で"This page couldn't load"）がそのまま出ていた。
// ここでキャッチして日本語の案内＋再試行ボタンを出す（ナビ・ヘッダーは
// src/app/(app)/layout.tsxがそのまま残るので、他のページへは普通に移動できる）。
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-4xl">⚠️</p>
      <div>
        <p className="text-base font-bold text-gray-900">エラーが発生しました</p>
        <p className="mt-1 text-sm text-gray-500">
          一時的な通信エラーの可能性があります。もう一度お試しください。
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-gray-400">エラーID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          もう一度試す
        </button>
        <Link
          href="/board"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          来店中ボードへ戻る
        </Link>
      </div>
    </div>
  );
}
