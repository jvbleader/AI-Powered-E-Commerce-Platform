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
    <div className="rounded-panel border border-dashed border-line bg-white p-8 text-center">
      <Info className="mx-auto h-9 w-9 text-sky" aria-hidden="true" />
      <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">{description}</p> : null}
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
    <div className="rounded-panel border border-coral/30 bg-coral/10 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-coral" aria-hidden="true" />
        <div>
          <h3 className="font-bold text-ink">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-panel bg-line/70", className)} />;
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
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-3 rounded-panel border border-line bg-white p-3 text-sm shadow-soft"
      role="alert"
      aria-live="polite"
    >
      <Icon
        className={cn(
          "h-5 w-5",
          tone === "danger" && "text-coral",
          tone === "success" && "text-primary",
          tone === "info" && "text-sky"
        )}
        aria-hidden="true"
      />
      <span className="text-ink">{message}</span>
    </div>
  );
}

export function LoadingInline({ label = "Đang tải" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}
