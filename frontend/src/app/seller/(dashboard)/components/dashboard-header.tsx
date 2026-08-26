"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Plus, ShoppingBag, Store, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { sellerStatusLabel } from "@/lib/helpers";
import type { SellerStatus } from "@/types/models";

const formatLocalTime = (isoString?: string | null) => {
  if (!isoString) return "";
  let cleanIso = isoString;
  if (!cleanIso.endsWith("Z") && !cleanIso.includes("+") && !cleanIso.includes("-", 10)) {
    cleanIso += "Z";
  }
  const date = new Date(cleanIso);
  if (isNaN(date.getTime())) return isoString;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);

  return `${parts.hour}:${parts.minute}:${parts.second} ${parts.day}/${parts.month}/${parts.year}`;
};

export interface DashboardHeaderProps {
  shopName: string;
  shopStatus?: SellerStatus;
  updatedAt?: string | null;
  recalculating: boolean;
  cooldownLeft: number;
  onRefresh: () => void;
}

export function DashboardHeader({
  shopName,
  shopStatus = "APPROVED",
  updatedAt,
  recalculating,
  cooldownLeft,
  onRefresh
}: DashboardHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 rounded-panel border border-line bg-white p-5 shadow-soft lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Store className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">
            Xin chào, {shopName}!
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            {updatedAt
              ? `Cập nhật gần nhất: ${formatLocalTime(updatedAt)}`
              : "Chưa đồng bộ thống kê CSDL"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={recalculating || cooldownLeft > 0}
            className="inline-flex items-center gap-1 font-medium text-coral transition-colors hover:text-coral/80 disabled:cursor-not-allowed disabled:text-muted"
          >
            <RefreshCcw className={`h-3 w-3 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating
              ? "Đang tính toán..."
              : cooldownLeft > 0
              ? `Cập nhật lại sau (${Math.floor(cooldownLeft / 60)}:${String(cooldownLeft % 60).padStart(2, "0")})`
              : "Làm mới CSDL"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="secondary"
          onClick={() => router.push("/seller/orders")}
          className="flex items-center gap-1.5 text-sm"
        >
          <ShoppingBag className="h-4 w-4" />
          Quản lý đơn hàng
        </Button>
        <Button
          onClick={() => router.push("/seller/products/new")}
          className="flex items-center gap-1.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          Thêm sản phẩm mới
        </Button>
      </div>
    </div>
  );
}
