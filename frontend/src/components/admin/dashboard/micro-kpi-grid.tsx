"use client";

import React from "react";
import {
  RotateCcw,
  Receipt,
  Eye,
  Percent,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { AdminMicroKpis } from "@/services/admin-api";
import { formatVnd } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface MicroKpiGridProps {
  kpis: AdminMicroKpis | null;
  loading?: boolean;
}

export function MicroKpiGrid({ kpis, loading }: MicroKpiGridProps) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-100 bg-white p-3 shadow-xs"
          >
            <div className="h-3 w-16 bg-slate-100 rounded mb-2" />
            <div className="h-5 w-24 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const items = [
    {
      id: "return_rate",
      title: "Tỷ lệ đơn hoàn",
      value: `${kpis.return_rate.current_value}%`,
      delta: kpis.return_rate.delta_pct,
      invertTrendColor: true, // Thấp hơn là tốt hơn
      icon: RotateCcw,
    },
    {
      id: "aov",
      title: "Giá trị TB đơn",
      value: formatVnd(kpis.aov.current_value),
      delta: kpis.aov.delta_pct,
      icon: Receipt,
    },
    {
      id: "visits",
      title: "Lượt truy cập",
      value: Number(kpis.total_visits.current_value).toLocaleString("vi-VN"),
      delta: kpis.total_visits.delta_pct,
      icon: Eye,
    },
    {
      id: "cvr",
      title: "Tỷ lệ chuyển đổi",
      value: `${kpis.conversion_rate.current_value}%`,
      delta: kpis.conversion_rate.delta_pct,
      icon: Percent,
    },
    {
      id: "reviews",
      title: "Tổng số đánh giá",
      value: Number(kpis.total_reviews.current_value).toLocaleString("vi-VN"),
      delta: kpis.total_reviews.delta_pct,
      icon: Star,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        const isUp = item.delta !== null && item.delta > 0;
        const isZero = item.delta === 0;
        const isGood = item.invertTrendColor ? !isUp : isUp;
        const deltaDisplay =
          item.delta !== null ? `${isUp ? "+" : ""}${item.delta}%` : "--";

        return (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-600 truncate">
                  {item.title}
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {item.value}
                </div>
              </div>
            </div>

            {item.delta !== null && (
              <div
                className={cn(
                  "flex items-center text-[10px] font-semibold shrink-0 ml-1.5",
                  isZero
                    ? "text-slate-500"
                    : isGood
                    ? "text-emerald-600"
                    : "text-rose-600"
                )}
              >
                {isZero ? (
                  <Minus className="mr-0.5 h-2.5 w-2.5" />
                ) : isUp ? (
                  <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="mr-0.5 h-2.5 w-2.5" />
                )}
                <span>{deltaDisplay}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
