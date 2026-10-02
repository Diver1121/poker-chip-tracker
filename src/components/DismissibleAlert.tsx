"use client";

import { useEffect, useState } from "react";

// 注意書きの各項目に✖ボタンを付け、押すとこの端末ではその項目だけ閉じられるようにする。
// keyには項目の中身（対象の日付やIDなど）を含めておくことで、同じ内容が続く間は
// 閉じたままになり、内容が変わったら（新しい未実施項目が出てきたら）改めて表示される。
// 1項目ずつキーを持たせているので、他の項目が増減しても既に閉じた項目には影響しない
// （まとめて1つのキーにすると、リストの中身が変わるたびに全部が再表示されてしまうため）。
export type AlertItem = {
  key: string;
  content: React.ReactNode;
};

export function DismissibleAlertList({
  items,
  className,
}: {
  items: AlertItem[];
  className?: string;
}) {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const itemKeysSignature = items.map((item) => item.key).join(",");

  // itemsは呼び出し側で毎レンダー新しい配列になるため、中身が変わった時だけ
  // 読み直せばよい（itemKeysSignatureを依存値にする）。
  useEffect(() => {
    try {
      const stored = new Set<string>();
      for (const item of items) {
        if (localStorage.getItem(`dismissedAlert:${item.key}`) === "1") {
          stored.add(item.key);
        }
      }
      setDismissedKeys(stored);
    } catch {
      // localStorageが使えない環境では常に表示する
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKeysSignature]);

  const visible = items.filter((item) => !dismissedKeys.has(item.key));
  if (visible.length === 0) return null;

  return (
    <div className={className}>
      <div className="space-y-1">
        {visible.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-3">
            <div className="flex-1">{item.content}</div>
            <button
              type="button"
              onClick={() => {
                setDismissedKeys((prev) => {
                  const next = new Set(prev);
                  next.add(item.key);
                  return next;
                });
                try {
                  localStorage.setItem(`dismissedAlert:${item.key}`, "1");
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
        ))}
      </div>
    </div>
  );
}
