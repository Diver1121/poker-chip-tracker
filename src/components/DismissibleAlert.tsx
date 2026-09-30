"use client";

import { useEffect, useState } from "react";

// 注意書きに✖ボタンを付け、押すとこの端末ではいったん閉じられるようにする。
// storageKeyには警告の中身（対象の日付やIDなど）を含めておくことで、
// 同じ内容が続く間は閉じたままになり、内容が変わったら（新しい未実施項目が
// 出てきたら）改めて表示される。
export function DismissibleAlert({
  storageKey,
  className,
  children,
}: {
  storageKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(`dismissedAlert:${storageKey}`) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">{children}</div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(`dismissedAlert:${storageKey}`, "1");
            } catch {
              // 保存できなくても今回の表示だけは閉じる
            }
          }}
          aria-label="この注意を閉じる"
          className="shrink-0 text-red-500 hover:text-red-800"
        >
          ✖
        </button>
      </div>
    </div>
  );
}
