"use client";

import React from "react";
import { AdminBottomSummary } from "@/services/admin-api";
import { formatVnd } from "@/lib/helpers";

interface BottomSummaryBarProps {
  summary: AdminBottomSummary | null;
  loading?: boolean;
}

export function BottomSummaryBar({ summary, loading }: BottomSummaryBarProps) {
  if (loading || !summary) {
    return (
      <div className="h-16 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm" />
    );
  }

  const items = [
    {
      label: `Tổng doanh thu năm ${summary.year}`,
      value: formatVnd(summary.total_revenue_ytd),
      color: "text-emerald-700",
    },
    {
      label: `Tổng đơn hàng trong năm ${summary.year}`,
      value: summary.total_orders_ytd.toLocaleString("vi-VN"),
      color: "text-sky-700",
    },
    {
      label: "Tổng người dùng",
      value: summary.total_users.toLocaleString("vi-VN"),
      color: "text-amber-700",
    },
    {
      label: "Tổng người bán",
      value: summary.total_sellers.toLocaleString("vi-VN"),
      color: "text-purple-700",
    },
    {
      label: "Tổng sản phẩm",
      value: summary.total_products.toLocaleString("vi-VN"),
      color: "text-rose-700",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
        Tổng kết nhanh
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {items.map((item, idx) => (
          <div key={item.label} className={idx !== 0 ? "sm:pl-4 pt-2 sm:pt-0" : ""}>
            <div className="text-[11px] font-medium text-slate-600 truncate">
              {item.label}
            </div>
            <div className={`mt-1 text-base font-extrabold ${item.color} truncate`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
