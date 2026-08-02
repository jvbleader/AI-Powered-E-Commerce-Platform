"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200/90 bg-white/90 p-8 text-center shadow-2xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 shadow-2xs mb-3.5">
        <Info className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs mb-3">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-slate-200/70", className)} />;
}

export function Toast({
  message,
  tone
}: {
  message?: string;
  tone?: "success" | "danger" | "info";
}) {
  if (!message) return null;
  const Icon = tone === "danger" ? XCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-3.5 text-xs font-semibold shadow-xl"
      role="alert"
      aria-live="polite"
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          tone === "danger" && "text-rose-500",
          tone === "success" && "text-emerald-600",
          tone === "info" && "text-amber-500"
        )}
        aria-hidden="true"
      />
      <span className="text-slate-800">{message}</span>
    </div>
  );
}

export function LoadingInline({ label = "Đang tải" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden="true" />
      {label}
    </span>
  );
}

export function LoadingPage({ message = "Đang tải dữ liệu..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex w-full items-center justify-center bg-[#faf6f0] px-4 overflow-hidden">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center animate-in fade-in-50 duration-200">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 mb-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">{message}</h3>
        <p className="mt-1 text-xs text-slate-500">Vui lòng chờ trong giây lát...</p>
      </div>
    </div>
  );
}
