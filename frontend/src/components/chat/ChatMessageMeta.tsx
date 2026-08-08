"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ChatMessageMeta({
  time,
  children,
  className,
}: {
  time: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 float-right ml-2 mt-1 text-[11px] leading-none select-none translate-y-0.5",
        className
      )}
    >
      <span>{time}</span>
      {children}
    </span>
  );
}
