"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/helpers";

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-[6px] border px-2 py-0.5 text-xs font-semibold",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warning" && "border-amber/30 bg-amber/15 text-[#8a5a00]",
        tone === "danger" && "border-coral/30 bg-coral/10 text-coral",
        tone === "neutral" && "border-line bg-white text-muted",
        tone === "info" && "border-sky/30 bg-sky/10 text-sky",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? status}</Badge>;
}
