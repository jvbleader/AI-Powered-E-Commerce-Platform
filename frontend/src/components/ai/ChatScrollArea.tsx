"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ChatScrollAreaProps = {
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: () => void;
  className?: string;
  children: React.ReactNode;
  overlay?: React.ReactNode;
};

type ThumbState = { height: number; top: number; visible: boolean };

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
  } else {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function thumbEqual(a: ThumbState, b: ThumbState) {
  return a.height === b.height && a.top === b.top && a.visible === b.visible;
}

export function ChatScrollArea({
  scrollRef,
  onScroll,
  className,
  children,
  overlay,
}: ChatScrollAreaProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<ThumbState>({ height: 0, top: 0, visible: false });
  const [thumb, setThumb] = useState<ThumbState>(thumbRef.current);
  const scrollRafRef = useRef(0);
  const thumbRafRef = useRef(0);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      assignRef(scrollRef, node);
    },
    [scrollRef]
  );

  const commitThumb = useCallback((next: ThumbState) => {
    if (thumbEqual(thumbRef.current, next)) return;
    thumbRef.current = next;
    setThumb(next);
  }, []);

  const updateThumb = useCallback(() => {
    const el = localRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      commitThumb({ height: 0, top: 0, visible: false });
      return;
    }

    const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 28);
    const maxTop = clientHeight - thumbHeight;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);
    const top = scrollRatio * maxTop;

    commitThumb({ height: thumbHeight, top, visible: true });
  }, [commitThumb]);

  const scheduleThumbUpdate = useCallback(() => {
    if (thumbRafRef.current) return;
    thumbRafRef.current = requestAnimationFrame(() => {
      thumbRafRef.current = 0;
      updateThumb();
    });
  }, [updateThumb]);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      updateThumb();
      onScroll?.();
    });
  }, [onScroll, updateThumb]);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;

    updateThumb();
    // Chỉ observe container — bỏ MutationObserver/querySelectorAll (gây jank khi list đổi)
    const ro = new ResizeObserver(scheduleThumbUpdate);
    ro.observe(el);

    return () => {
      ro.disconnect();
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      if (thumbRafRef.current) cancelAnimationFrame(thumbRafRef.current);
    };
  }, [scheduleThumbUpdate, updateThumb]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={setRefs}
        onScroll={handleScroll}
        className={cn("chat-widget-scroll-native-hidden absolute inset-0 overflow-x-hidden overflow-y-auto", className)}
      >
        {children}
      </div>

      {thumb.visible ? (
        <div
          className="pointer-events-none absolute bottom-2 right-1 top-2 z-[1] w-[3px]"
          aria-hidden
        >
          <div
            className="absolute right-0 w-[3px] rounded-full bg-slate-300/70"
            style={{ height: thumb.height, top: thumb.top }}
          />
        </div>
      ) : null}

      {overlay}
    </div>
  );
}
