"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Clock, Truck, AlertTriangle, RotateCcw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionCenterProps {
  pendingConfirmationCount: number;
  readyToShipCount: number;
  lowStockCount: number;
  returnRefundCount: number;
}

export function ActionCenter({
  pendingConfirmationCount,
  readyToShipCount,
  lowStockCount,
  returnRefundCount
}: ActionCenterProps) {
  const router = useRouter();

  const items = [
    {
      id: "pending_confirm",
      label: "Chờ xác nhận",
      count: pendingConfirmationCount,
      description: "Đơn hàng mới cần duyệt",
      icon: Clock,
      iconColor: "text-amber-600 bg-amber-50",
      href: "/seller/orders?status=PLACED"
    },
    {
      id: "ready_ship",
      label: "Chờ giao hàng",
      count: readyToShipCount,
      description: "Đã duyệt, cần đóng gói & giao",
      icon: Truck,
      iconColor: "text-amber-600 bg-amber-50",
      href: "/seller/orders?status=READY_TO_SHIP"
    },
    {
      id: "low_stock",
      label: "Cảnh báo tồn kho",
      count: lowStockCount,
      description: "Sản phẩm có tồn kho ≤ 5 món",
      icon: AlertTriangle,
      iconColor: "text-amber-600 bg-amber-50",
      href: "/seller/inventory?stock=LOW"
    },
    {
      id: "returns",
      label: "Yêu cầu đổi trả",
      count: returnRefundCount,
      description: "Khiếu nại / hoàn hàng cần xử lý",
      icon: RotateCcw,
      iconColor: "text-amber-600 bg-amber-50",
      href: "/seller/orders?status=RETURN_REQUESTED"
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Danh sách việc cần làm ngay</h2>
        <span className="text-xs text-muted">Hành động ưu tiên cho người bán</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const hasAction = item.count > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className="group flex flex-col justify-between rounded-panel border border-line bg-white p-4 text-left shadow-soft transition-all duration-200 hover:border-slate-300 hover:shadow-md hover:bg-slate-50/50"
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    item.iconColor
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold transition-colors",
                    hasAction
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {item.count}
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink group-hover:text-emerald-700 transition-colors">
                    {item.label}
                  </p>
                  <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-0.5 text-xs text-muted line-clamp-1">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

