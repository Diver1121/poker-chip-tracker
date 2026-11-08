"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD_PX = 70;
// 横移動が縦移動のこの倍数以上あるときだけスワイプ（ページ送り）とみなし、
// それ以外は縦スクロールとして無視する。
const HORIZONTAL_DOMINANCE_RATIO = 1.5;

// メインナビ（来店中・MTT・ランキング…）の並び順で、左右スワイプで前後のページに移動できる
// ようにするラッパー。タップでの移動（AppNav）はそのまま残し、追加の移動手段として使う。
export function SwipeNavigator({
  hrefs,
  children,
}: {
  hrefs: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [dragX, setDragX] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const currentIndex = hrefs.findIndex(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );

  // 実際にページが切り替わったら、スライドアウトしていた位置を即座に0へ戻す
  // （タイマーではなくpathnameの変化そのものを合図にすることで、通信が遅い時も
  // 古い画面が一瞬戻って見えるちらつきを防ぐ）。
  useEffect(() => {
    setTransitioning(false);
    setDragX(0);
  }, [pathname]);

  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    const target = e.target as HTMLElement;
    // 表の横スクロール（トーナメント結果表など）とジェスチャーが衝突しないよう、
    // data-no-swipe-navが付いた要素の上から始まった操作は無視する
    if (target.closest("[data-no-swipe-nav]")) return;
    start.current = { x: e.clientX, y: e.clientY };
    swiping.current = false;
    setTransitioning(false);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!swiping.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE_RATIO) {
        // 縦スクロールと判断し、このジェスチャーはもう追わない
        start.current = null;
        return;
      }
      swiping.current = true;
    }
    const atStart = currentIndex <= 0 && dx > 0;
    const atEnd = currentIndex === hrefs.length - 1 && dx < 0;
    // 先頭・末尾ページで逆方向に引いた時は、重く抵抗するだけで実際には動かさない
    setDragX(atStart || atEnd || currentIndex === -1 ? dx * 0.15 : dx);
  }

  function handlePointerUp() {
    if (!swiping.current || currentIndex === -1) {
      resetDrag(true);
      return;
    }
    const dx = dragX;
    if (dx <= -SWIPE_THRESHOLD_PX && currentIndex < hrefs.length - 1) {
      navigateTo(hrefs[currentIndex + 1], -1);
    } else if (dx >= SWIPE_THRESHOLD_PX && currentIndex > 0) {
      navigateTo(hrefs[currentIndex - 1], 1);
    } else {
      resetDrag(true);
    }
  }

  function navigateTo(href: string, direction: -1 | 1) {
    start.current = null;
    swiping.current = false;
    setTransitioning(true);
    setDragX(direction * window.innerWidth);
    router.push(href);
  }

  function resetDrag(animated: boolean) {
    start.current = null;
    swiping.current = false;
    setTransitioning(animated);
    setDragX(0);
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => resetDrag(true)}
      style={{
        transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined,
        transition: transitioning ? "transform 0.2s ease-out" : "none",
        touchAction: "pan-y",
      }}
    >
      {children}
    </div>
  );
}
