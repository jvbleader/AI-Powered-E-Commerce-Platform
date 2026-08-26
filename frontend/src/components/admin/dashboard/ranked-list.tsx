"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface RankedListItem {
  id: string | number;
  name: string;
  imageUrl?: string | null;
  primaryText: string;
  secondaryText?: string;
  valueText: string;
}

const RANK_STYLES = [
  "bg-amber-100 text-amber-700",
  "bg-slate-200 text-slate-600",
  "bg-orange-100 text-orange-700"
];

export function RankedList({
  title,
  viewAllHref,
  items,
  avatarShape = "square",
  emptyText = "Chưa có dữ liệu"
}: {
  title: string;
  viewAllHref?: string;
  items: RankedListItem[];
  avatarShape?: "square" | "circle";
  emptyText?: string;
}) {
  return (
    <div className="space-y-3 rounded-panel border border-line bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {viewAllHref ? (
          <Link href={viewAllHref} className="text-xs font-medium text-muted transition-colors hover:text-primary">
            Xem tất cả →
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">{emptyText}</p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((item, idx) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    RANK_STYLES[idx] ?? "bg-slate-100 text-slate-500"
                  )}
                >
                  {idx + 1}
                </span>

                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    className={cn(
                      "h-9 w-9 shrink-0 border border-line object-cover",
                      avatarShape === "circle" ? "rounded-full" : "rounded"
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-slate-100 text-sm font-bold text-slate-600",
                      avatarShape === "circle" ? "rounded-full" : "rounded"
                    )}
                    aria-hidden="true"
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">{item.primaryText}</p>
                  {item.secondaryText ? <p className="text-[11px] text-muted">{item.secondaryText}</p> : null}
                </div>
              </div>

              <span className="shrink-0 text-xs font-bold text-ink">{item.valueText}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
