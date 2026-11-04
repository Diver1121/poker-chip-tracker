"use client";

import { useEffect } from "react";

// ルートレイアウト自体やログインページなど、src/app/(app)/error.tsxの外で
// 例外が起きた場合の最後の砦。滅多に出ないが、ここが無いとNext.jsの素の
// クラッシュ画面になってしまう。独自の<html><body>が必要（ルートlayoutを丸ごと置き換えるため）。
export default function GlobalError({
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
    <html lang="ja">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
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
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          もう一度試す
        </button>
      </body>
    </html>
  );
}
