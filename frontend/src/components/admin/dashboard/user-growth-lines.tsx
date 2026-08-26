"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AdminUserGrowthSeriesPoint } from "@/services/admin-api";

interface UserGrowthLinesProps {
  data: AdminUserGrowthSeriesPoint[];
  loading?: boolean;
}

export function UserGrowthLines({ data, loading }: UserGrowthLinesProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const newU = payload.find((p: any) => p.dataKey === "new_users")?.value || 0;
      const actU = payload.find((p: any) => p.dataKey === "active_users")?.value || 0;

      return (
        <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-sm">
          <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2">
            Mốc: {label}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 text-emerald-700 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Người dùng mới:
              </span>
              <span className="font-bold">{newU.toLocaleString("vi-VN")}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-purple-700 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Người dùng tích cực:
              </span>
              <span className="font-bold">{actU.toLocaleString("vi-VN")}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">Tăng trưởng người dùng</h3>
        <p className="text-xs text-slate-600">
          Số lượng người dùng mới và người dùng tích cực
        </p>
      </div>

      <div className="h-[280px] w-full">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-slate-50" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 24, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval={data.length > 24 ? "preserveStartEnd" : 0}
                padding={{ left: 8, right: 12 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="active_users"
                name="Người dùng tích cực"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 2, stroke: "#ffffff" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="new_users"
                name="Người dùng mới"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#10b981", strokeWidth: 2, stroke: "#ffffff" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-6 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Người dùng mới
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
          Người dùng tích cực
        </span>
      </div>
    </div>
  );
}
