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
        "status-pill rounded-full border",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-800",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-800",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {label ?? status}
    </Badge>
  );
}
