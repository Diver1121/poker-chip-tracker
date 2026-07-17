"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string };

const STORAGE_KEY = "chip-tracker-nav-order";

export function AppNav({ items }: { items: NavItem[] }) {
  const [order, setOrder] = useState<NavItem[]>(items);
  const [draggingHref, setDraggingHref] = useState<string | null>(null);
  const orderRef = useRef(order);
  const draggedRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

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
      {order.map((item) => (
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
          className={`touch-none cursor-grab rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 select-none hover:bg-gray-100 active:cursor-grabbing ${
            draggingHref === item.href ? "bg-indigo-50 text-indigo-700" : ""
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
