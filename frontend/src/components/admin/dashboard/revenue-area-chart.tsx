"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AdminRevenueSeriesPoint } from "@/services/admin-api";
import { formatVnd } from "@/lib/helpers";

interface RevenueAreaChartProps {
  data: AdminRevenueSeriesPoint[];
  loading?: boolean;
}

export function RevenueAreaChart({
  data,
  loading,
}: RevenueAreaChartProps) {
  const hasPreviousData = data.some((d) => Number(d.previous_revenue) > 0);

  const formatYAxis = (val: number) => {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return String(val);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const cur = payload.find((p: any) => p.dataKey === "current_revenue")?.value || 0;
      const prev = payload.find((p: any) => p.dataKey === "previous_revenue")?.value || 0;
      const point = payload[0]?.payload;

      return (
        <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-sm">
          <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1.5 mb-2">
            Thời gian: {point?.full_date || label}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4 text-emerald-700 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {hasPreviousData ? "Kỳ hiện tại:" : "Doanh thu:"}
              </span>
              <span className="font-bold">{formatVnd(cur)}</span>
            </div>
            {hasPreviousData && (
              <div className="flex items-center justify-between gap-4 text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  Kỳ trước:
                </span>
                <span>{formatVnd(prev)}</span>
              </div>
            )}
            {point?.current_orders !== undefined && (
              <div className="mt-1 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                Đơn hàng: <strong>{point.current_orders}</strong> đơn
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">Doanh thu</h3>
        <p className="text-xs text-slate-600">
          Biểu đồ theo dõi xu hướng doanh thu theo kỳ
        </p>
      </div>

      <div className="h-[280px] w-full">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-slate-50" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 24, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="currentRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                {hasPreviousData && (
                  <linearGradient id="prevRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
                  </linearGradient>
                )}
              </defs>
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
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip content={<CustomTooltip />} />
              {hasPreviousData && (
                <Area
                  type="monotone"
                  dataKey="previous_revenue"
                  name="Kỳ trước"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="url(#prevRevGrad)"
                />
              )}
              <Area
                type="monotone"
                dataKey="current_revenue"
                name={hasPreviousData ? "Kỳ hiện tại" : "Doanh thu"}
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#currentRevGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-6 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          {hasPreviousData ? "Kỳ hiện tại" : "Doanh thu"}
        </span>
        {hasPreviousData && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            Kỳ trước
          </span>
        )}
      </div>
    </div>
  );
}
