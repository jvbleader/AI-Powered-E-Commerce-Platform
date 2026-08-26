"use client";

import React from "react";
import { AdminRecentActivityItem } from "@/services/admin-api";

interface RecentAuditLogsProps {
  activities: AdminRecentActivityItem[];
  loading?: boolean;
}

export function RecentAuditLogs({ activities, loading }: RecentAuditLogsProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">Hoạt động gần đây</h3>
        <p className="text-xs text-slate-600">Nhật ký kiểm duyệt và thao tác quản trị</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-600 font-semibold">
              <th className="pb-2.5">Thời gian</th>
              <th className="pb-2.5">Hành động</th>
              <th className="pb-2.5">Đối tượng</th>
              <th className="pb-2.5 text-right">Người thực hiện</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-2.5">
                    <div className="h-4 w-20 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5">
                    <div className="h-4 w-32 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5">
                    <div className="h-4 w-28 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="h-4 w-12 rounded bg-slate-100 ml-auto" />
                  </td>
                </tr>
              ))
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                  Chưa có nhật ký hoạt động gần đây
                </td>
              </tr>
            ) : (
              activities.map((act) => (
                <tr key={act.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 text-slate-600 font-mono text-[11px]">
                    {act.time}
                  </td>
                  <td className="py-2.5 font-medium text-slate-900">
                    {act.action}
                  </td>
                  <td className="py-2.5 text-slate-600 truncate max-w-[140px]">
                    {act.target}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {act.actor}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
