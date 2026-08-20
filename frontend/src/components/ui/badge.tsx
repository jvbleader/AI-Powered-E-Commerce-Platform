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
  tone?: "success" | "warning" | "danger" | "neutral" | "info" | "purple" | "indigo";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "status-pill rounded-full border",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warning" && "border-orange-200 bg-orange-50 text-orange-800",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-800",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600",
        tone === "info" && "border-blue-200 bg-blue-50 text-blue-800",
        tone === "purple" && "border-purple-200 bg-purple-50 text-purple-700",
        tone === "indigo" && "border-indigo-200 bg-indigo-50 text-indigo-700",
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
