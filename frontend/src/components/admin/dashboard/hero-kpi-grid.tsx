"use client";

import React from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Users,
  Store,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { AdminHeroKpis } from "@/services/admin-api";
import { formatVnd } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface HeroKpiGridProps {
  kpis: AdminHeroKpis | null;
  loading?: boolean;
}

export function HeroKpiGrid({ kpis, loading }: HeroKpiGridProps) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="h-3.5 w-20 rounded bg-slate-100 mb-2" />
                <div className="h-6 w-28 rounded bg-slate-200" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-100" />
            </div>
            <div className="h-4 w-32 rounded-full bg-slate-100 mt-3 pt-2 border-t border-slate-50" />
          </div>
        ))}
      </div>
    );
  }

  const items = [
    {
      id: "revenue",
      title: "Doanh thu (Tổng)",
      value: formatVnd(kpis.revenue.current_value),
      delta: kpis.revenue.delta_pct,
      icon: ShoppingBag,
      bgIconClass: "bg-emerald-50 text-emerald-600",
      accentBorder: "hover:border-emerald-200",
    },
    {
      id: "orders",
      title: "Đơn hàng",
      value: Number(kpis.orders.current_value).toLocaleString("vi-VN"),
      delta: kpis.orders.delta_pct,
      icon: ShoppingCart,
      bgIconClass: "bg-blue-50 text-blue-600",
      accentBorder: "hover:border-blue-200",
    },
    {
      id: "new_users",
      title: "Người dùng mới",
      value: Number(kpis.new_users.current_value).toLocaleString("vi-VN"),
      delta: kpis.new_users.delta_pct,
      icon: Users,
      bgIconClass: "bg-orange-50 text-orange-600",
      accentBorder: "hover:border-orange-200",
    },
    {
      id: "new_sellers",
      title: "Người bán mới",
      value: Number(kpis.new_sellers.current_value).toLocaleString("vi-VN"),
      delta: kpis.new_sellers.delta_pct,
      icon: Store,
      bgIconClass: "bg-purple-50 text-purple-600",
      accentBorder: "hover:border-purple-200",
    },
    {
      id: "products",
      title: "Sản phẩm",
      value: Number(kpis.products.current_value).toLocaleString("vi-VN"),
      delta: kpis.products.delta_pct,
      icon: Package,
      bgIconClass: "bg-rose-50 text-rose-600",
      accentBorder: "hover:border-rose-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        const isPositive = item.delta !== null && item.delta > 0;
        const isZero = item.delta === 0;
        const deltaText =
          item.delta !== null
            ? `${isPositive ? "+" : ""}${item.delta}%`
            : "--";

        return (
          <div
            key={item.id}
            className={cn(
              "group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 transition-all duration-200 shadow-sm hover:shadow-md",
              item.accentBorder
            )}
          >
            {/* Top row: Title on left, Compact Icon on top-right */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-slate-500">
                {item.title}
              </span>
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
                  item.bgIconClass
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            {/* Middle row: Amount spans 100% full width of card */}
            <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap overflow-visible">
              {item.value}
            </div>

            <div className="mt-3.5 flex items-center gap-1.5 text-[11px] pt-2 border-t border-slate-100">
              {item.delta !== null ? (
                <>
                  <div
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold text-[10.5px]",
                      isZero
                        ? "bg-slate-100 text-slate-600"
                        : isPositive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    )}
                  >
                    {isZero ? (
                      <Minus className="h-3 w-3" />
                    ) : isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{deltaText}</span>
                  </div>
                  <span className="text-slate-500 font-medium">so với kỳ trước</span>
                </>
              ) : (
                <span className="text-slate-400">Không có dữ liệu</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
