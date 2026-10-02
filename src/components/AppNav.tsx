"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LinkPendingDot } from "@/components/LinkPendingDot";
import { ALERT_DISMISSED_EVENT } from "@/components/DismissibleAlert";

type NavItem = { href: string; label: string; alertKeys?: string[] };

const STORAGE_KEY = "chip-tracker-nav-order";

function readDismissedSet(keys: string[]): Set<string> {
  const dismissed = new Set<string>();
  try {
    for (const key of keys) {
      if (localStorage.getItem(`dismissedAlert:${key}`) === "1") {
        dismissed.add(key);
      }
    }
  } catch {
    // localStorageが使えない環境では何も閉じていない扱いにする
  }
  return dismissed;
}

export function AppNav({ items }: { items: NavItem[] }) {
  const [order, setOrder] = useState<NavItem[]>(items);
  const [draggingHref, setDraggingHref] = useState<string | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const orderRef = useRef(order);
  const draggedRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const allAlertKeysSignature = items.flatMap((item) => item.alertKeys ?? []).join(",");

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  // 保存された並び順を復元する。並び順に無い新しい項目（機能追加分）は末尾に足す。
  // SSR時点ではlocalStorageが無いのでデフォルト順のまま返し、マウント後に反映する
  // （直後に1回だけ並び替わるちらつきは許容）。
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const savedHrefs: string[] = JSON.parse(saved);
      const byHref = new Map(items.map((item) => [item.href, item]));
      const reordered = savedHrefs
        .map((href) => byHref.get(href))
        .filter((item): item is NavItem => Boolean(item));
      const missing = items.filter((item) => !savedHrefs.includes(item.href));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorageはSSRで読めないためマウント後に反映する必要がある
      setOrder([...reordered, ...missing]);
    } catch {
      // 壊れた保存データは無視してデフォルト順のまま
    }
    // itemsはビルド時に固定の定数配列なので初回だけでよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // alertKeys（押し忘れ！バッジの元データ）はナビゲーションのたびにサーバー側で再計算された
  // 最新値がitemsプロップとして渡ってくる。orderは並び替え保持のためのローカルstateなので、
  // 並び順はそのままにalertKeysの値だけ都度反映する。
  useEffect(() => {
    setOrder((current) =>
      current.map((item) => {
        const fresh = items.find((i) => i.href === item.href);
        return fresh && fresh.alertKeys !== item.alertKeys
          ? { ...item, alertKeys: fresh.alertKeys }
          : item;
      }),
    );
  }, [items]);

  // 各ページの注意バナーで✖を押して閉じた項目は、ナビの！バッジからも消す
  // （バナーは閉じたのにナビだけ！が残ると紛らわしいため）。同じタブ内での
  // 即時反映にはカスタムイベント、他タブからの変更の反映にはstorageイベントを使う。
  useEffect(() => {
    const allAlertKeys = allAlertKeysSignature ? allAlertKeysSignature.split(",") : [];
    const update = () => setDismissedKeys(readDismissedSet(allAlertKeys));
    update();
    window.addEventListener(ALERT_DISMISSED_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(ALERT_DISMISSED_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [allAlertKeysSignature]);

  function handlePointerDown(e: React.PointerEvent<HTMLAnchorElement>, href: string) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStart.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
    setDraggingHref(href);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (!draggingHref || !pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (!draggedRef.current && Math.hypot(dx, dy) < 6) return;
    draggedRef.current = true;

    const targetHref = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-nav-href]")?.dataset.navHref;
    if (!targetHref || targetHref === draggingHref) return;

    const current = orderRef.current;
    const fromIndex = current.findIndex((item) => item.href === draggingHref);
    const toIndex = current.findIndex((item) => item.href === targetHref);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrder(next);
  }

  function handlePointerUp() {
    if (draggingHref) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(orderRef.current.map((item) => item.href)),
      );
    }
    setDraggingHref(null);
    pointerStart.current = null;
  }

  return (
    <nav className="mt-3 flex flex-wrap gap-2">
      {order.map((item) => {
        const hasAlert = (item.alertKeys ?? []).some((key) => !dismissedKeys.has(key));
        return (
          <Link
            key={item.href}
            href={item.href}
            data-nav-href={item.href}
            onPointerDown={(e) => handlePointerDown(e, item.href)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={(e) => {
              if (draggedRef.current) {
                e.preventDefault();
                draggedRef.current = false;
              }
            }}
            className={`touch-none cursor-grab rounded-md px-3 py-1.5 text-sm font-medium text-purple-100 select-none hover:bg-white/15 hover:text-white active:cursor-grabbing ${
              draggingHref === item.href ? "bg-white/20 text-white" : ""
            }`}
          >
            {item.label}
            {hasAlert && (
              <span
                title="未対応の作業があります"
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
              >
                !
              </span>
            )}
            <LinkPendingDot />
          </Link>
        );
      })}
    </nav>
  );
}
