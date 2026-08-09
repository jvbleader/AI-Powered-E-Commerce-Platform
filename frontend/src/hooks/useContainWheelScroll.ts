"use client";

import { useEffect, type RefObject } from "react";

function canScrollAxis(el: HTMLElement, axis: "x" | "y") {
  const style = getComputedStyle(el);
  if (axis === "y") {
    const oy = style.overflowY;
    return (oy === "auto" || oy === "scroll" || oy === "overlay") && el.scrollHeight > el.clientHeight + 1;
  }
  const ox = style.overflowX;
  return (ox === "auto" || ox === "scroll" || ox === "overlay") && el.scrollWidth > el.clientWidth + 1;
}

function findScrollable(target: EventTarget | null, root: HTMLElement, axis: "x" | "y") {
  let el = target instanceof HTMLElement ? target : null;
  while (el && root.contains(el)) {
    if (canScrollAxis(el, axis)) return el;
    if (el === root) break;
    el = el.parentElement;
  }
  return null;
}

/**
 * Khi chuột ở trong root, chặn scroll chaining ra document/page.
 * - Có vùng scroll trong hướng wheel: cho native scroll; nếu đã ở biên thì preventDefault.
 * - Không có vùng scroll: luôn preventDefault.
 * Dùng listener non-passive để preventDefault có hiệu lực.
 */
export function useContainWheelScroll(rootRef: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const axis: "x" | "y" = absX > absY ? "x" : "y";
      const delta = axis === "y" ? e.deltaY : e.deltaX;

      if (delta === 0) return;

      const scrollable = findScrollable(e.target, root, axis);
      if (!scrollable) {
        e.preventDefault();
        return;
      }

      if (axis === "y") {
        const { scrollTop, scrollHeight, clientHeight } = scrollable;
        const atTop = scrollTop <= 0;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
        if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
          e.preventDefault();
        }
      } else {
        const { scrollLeft, scrollWidth, clientWidth } = scrollable;
        const atStart = scrollLeft <= 0;
        const atEnd = scrollLeft + clientWidth >= scrollWidth - 1;
        if ((delta < 0 && atStart) || (delta > 0 && atEnd)) {
          e.preventDefault();
        }
      }
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [rootRef, enabled]);
}
