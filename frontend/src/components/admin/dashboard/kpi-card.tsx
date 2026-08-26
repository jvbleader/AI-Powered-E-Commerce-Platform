"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/ui/containers";
import { cn } from "@/lib/utils";

export interface KpiDelta {
  pct: number;
  label?: string;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  chipClass,
  delta = null,
  footer,
  loading = false
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  chipClass?: string;
  delta?: KpiDelta | null;
  footer?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Panel className="hover-lift p-4">
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", chipClass ?? "bg-emerald-50 text-primary")}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <DeltaBadge delta={delta} />
      </div>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>

      {loading ? (
        <div className="mt-1.5 h-7 w-28 animate-pulse rounded bg-slate-200/70" />
      ) : (
        <p className="mt-1 text-2xl font-bold leading-tight tracking-tight text-ink">{value}</p>
      )}

      {footer ? <div className="mt-2 text-xs text-muted">{footer}</div> : null}
    </Panel>
  );
}

function DeltaBadge({ delta }: { delta: KpiDelta | null }) {
  if (!delta || !Number.isFinite(delta.pct)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
        <Minus className="h-3 w-3" aria-hidden="true" />
        {delta?.label ?? "—"}
      </span>
    );
  }

  const rounded = Math.round(delta.pct * 10) / 10;
  const isUp = rounded > 0;
  const isFlat = rounded === 0;

  if (isFlat) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
        <Minus className="h-3 w-3" aria-hidden="true" />
        0%
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        isUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
      )}
      title={delta.label}
    >
      {isUp ? (
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      ) : (
        <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
      )}
      {Math.abs(rounded)}%
    </span>
  );
}
