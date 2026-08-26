"use client";

import React from "react";
import Link from "next/link";
import {
  AlertOctagon,
  FolderTree,
  Store,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { AdminActionCounts } from "@/services/admin-api";
import { cn } from "@/lib/utils";

interface ActionCenterProps {
  counts: AdminActionCounts | null;
  loading?: boolean;
}

export function ActionCenter({ counts, loading }: ActionCenterProps) {
  if (!counts && !loading) return null;

  const pendingSellers = counts?.pending_seller_applications ?? 0;
  const pendingViolations = counts?.pending_violation_reports ?? 0;
  const pendingCategories = counts?.pending_category_suggestions ?? 0;

  const totalPending =
    pendingSellers + pendingViolations + pendingCategories;

  const items = [
    {
      id: "sellers",
      label: "Duyệt Người Bán",
      count: pendingSellers,
      subtext: "hồ sơ chờ xác minh",
      href: "/admin/sellers?status=PENDING",
      icon: Store,
      colorClass: "bg-orange-50 border-orange-200/80 text-orange-900 hover:bg-orange-100/80 hover:border-orange-300",
      badgeClass: "bg-orange-500 text-white",
      iconClass: "bg-orange-100 text-orange-700",
    },
    {
      id: "violations",
      label: "Báo Cáo Vi Phạm",
      count: pendingViolations,
      subtext: "báo cáo cần kiểm duyệt",
      href: "/admin/violation-reports?status=PENDING",
      icon: AlertOctagon,
      colorClass: "bg-rose-50 border-rose-200/80 text-rose-900 hover:bg-rose-100/80 hover:border-rose-300",
      badgeClass: "bg-rose-500 text-white",
      iconClass: "bg-rose-100 text-rose-700",
    },
    {
      id: "categories",
      label: "Đề Xuất Danh Mục",
      count: pendingCategories,
      subtext: "đề xuất mới từ shop",
      href: "/admin/categories",
      icon: FolderTree,
      colorClass: "bg-blue-50 border-blue-200/80 text-blue-900 hover:bg-blue-100/80 hover:border-blue-300",
      badgeClass: "bg-blue-500 text-white",
      iconClass: "bg-blue-100 text-blue-700",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Tác vụ cần xử lý ngay
          </h3>
          {totalPending > 0 ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              {totalPending} việc chờ
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Đã thông suốt
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const hasCount = item.count > 0;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group relative flex items-center justify-between rounded-xl border p-3 transition-all duration-200 shadow-sm",
                item.colorClass,
                !hasCount && "opacity-75 grayscale-[20%]"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform group-hover:scale-105",
                    item.iconClass
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-700">
                    <strong className={cn(hasCount ? "text-slate-950 font-bold" : "text-slate-700")}>
                      {item.count}
                    </strong>{" "}
                    {item.subtext}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {hasCount && (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-xs",
                      item.badgeClass
                    )}
                  >
                    {item.count}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-700 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
