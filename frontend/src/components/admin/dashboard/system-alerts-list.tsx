"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { AdminSystemAlertItem } from "@/services/admin-api";
import { cn } from "@/lib/utils";

interface SystemAlertsListProps {
  alerts: AdminSystemAlertItem[];
  loading?: boolean;
}

export function SystemAlertsList({ alerts, loading }: SystemAlertsListProps) {
  const getIconAndStyle = (type: string) => {
    switch (type) {
      case "danger":
        return {
          icon: AlertCircle,
          iconClass: "text-rose-600 bg-rose-50 border-rose-200",
        };
      case "warning":
        return {
          icon: AlertTriangle,
          iconClass: "text-orange-600 bg-orange-50 border-orange-200",
        };
      case "success":
        return {
          icon: CheckCircle2,
          iconClass: "text-emerald-600 bg-emerald-50 border-emerald-200",
        };
      case "info":
      default:
        return {
          icon: Info,
          iconClass: "text-blue-600 bg-blue-50 border-blue-200",
        };
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">Thông báo hệ thống</h3>
        <p className="text-xs text-slate-600">Cảnh báo và sự kiện vận hành nền tảng</p>
      </div>

      <div className="space-y-2.5">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-2.5"
            />
          ))
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-slate-500">
            <CheckCircle2 className="h-7 w-7 text-emerald-500 mb-1 opacity-80" />
            <p className="text-xs font-medium text-slate-700">Hệ thống hoạt động ổn định</p>
            <p className="text-[11px] text-slate-400">Không có cảnh báo nào cần xử lý</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const { icon: Icon, iconClass } = getIconAndStyle(alert.type);

            const content = (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-100/70 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs shadow-xs mt-0.5",
                      iconClass
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 leading-snug">
                      {alert.title}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 leading-snug line-clamp-1">
                      {alert.description}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-600 block">
                    {alert.time_ago}
                  </span>
                </div>
              </div>
            );

            return alert.action_url ? (
              <Link key={alert.id} href={alert.action_url} className="block group">
                {content}
              </Link>
            ) : (
              <div key={alert.id}>{content}</div>
            );
          })
        )}
      </div>
    </div>
  );
}
