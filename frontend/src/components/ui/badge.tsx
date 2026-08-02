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
        "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold transition-all duration-200 shadow-2xs",
        tone === "success" && "border-emerald-200 bg-emerald-50/90 text-emerald-800",
        tone === "warning" && "border-amber-200 bg-amber-50/90 text-amber-900",
        tone === "danger" && "border-rose-200 bg-rose-50/90 text-rose-800",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600",
        tone === "info" && "border-sky-200 bg-sky-50/90 text-sky-800",
        className
      )}
    >
      {tone === "success" && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      )}
      {tone === "warning" && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        </span>
      )}
      {tone === "danger" && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? status}</Badge>;
}
