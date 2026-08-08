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

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
  } else {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

export function ChatScrollArea({
  scrollRef,
  onScroll,
  className,
  children,
  overlay,
}: ChatScrollAreaProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState({ height: 0, top: 0, visible: false });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      assignRef(scrollRef, node);
    },
    [scrollRef]
  );

  const updateThumb = useCallback(() => {
    const el = localRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb({ height: 0, top: 0, visible: false });
      return;
    }

    const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 28);
    const maxTop = clientHeight - thumbHeight;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);
    const top = scrollRatio * maxTop;

    setThumb({ height: thumbHeight, top, visible: true });
  }, []);

  const handleScroll = () => {
    updateThumb();
    onScroll?.();
  };

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;

    updateThumb();
    const observer = new ResizeObserver(updateThumb);
    observer.observe(el);
    el.querySelectorAll("img, video").forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [updateThumb, children]);

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
