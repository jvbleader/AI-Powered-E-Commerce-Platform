"use client";

import React from "react";
import { DollarSign, ShoppingBag, ClipboardList, Package } from "lucide-react";
import { formatVnd } from "@/lib/helpers";
import { cn } from "@/lib/utils";

export interface KpiMetricsProps {
  totalRevenue: number;
  totalSold: number;
  totalOrders: number;
  totalProducts: number;
}

export function KpiMetrics({
  totalRevenue,
  totalSold,
  totalOrders,
  totalProducts
}: KpiMetricsProps) {
  const metrics = [
    {
      id: "revenue",
      label: "Doanh thu hoàn tất",
      value: formatVnd(totalRevenue),
      subtext: "Tiền hàng từ các đơn hoàn tất",
      icon: DollarSign,
      iconBg: "bg-emerald-100 text-emerald-700",
      borderAccent: "border-emerald-100"
    },
    {
      id: "total_sold",
      label: "Tổng đã bán",
      value: totalSold.toLocaleString("vi-VN"),
      subtext: "Số lượng sản phẩm bán ra",
      icon: ShoppingBag,
      iconBg: "bg-blue-100 text-blue-700",
      borderAccent: "border-blue-100"
    },
    {
      id: "total_orders",
      label: "Tổng đơn hàng",
      value: totalOrders.toLocaleString("vi-VN"),
      subtext: "Tất cả đơn hàng phát sinh",
      icon: ClipboardList,
      iconBg: "bg-amber-100 text-amber-700",
      borderAccent: "border-amber-100"
    },
    {
      id: "total_products",
      label: "Sản phẩm của shop",
      value: totalProducts.toLocaleString("vi-VN"),
      subtext: "Tổng mặt hàng đang quản lý",
      icon: Package,
      iconBg: "bg-purple-100 text-purple-700",
      borderAccent: "border-purple-100"
    }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.id}
            className={cn(
              "flex flex-col justify-between rounded-panel border bg-white p-5 shadow-soft transition-all duration-200 hover:shadow-md",
              metric.borderAccent
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                {metric.label}
              </span>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", metric.iconBg)}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black tracking-tight text-ink">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-muted">
                {metric.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

