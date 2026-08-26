"use client";

import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AdminPlatformFinanceOverview } from "@/services/admin-api";
import { formatVnd } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface PaymentDonutProps {
  overview?: AdminPlatformFinanceOverview | null;
  loading?: boolean;
}

export function PaymentDonut({
  overview,
  loading,
}: PaymentDonutProps) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const totalInflow = overview?.total_cash_inflow || overview?.total_held_liquidity || 0;
  const fullTotalFormatted = formatVnd(totalInflow);
  const rawItems = overview?.chart_items || [];

  const chartSlices = rawItems.map((item) => ({
    key: item.key,
    label: item.label,
    value: typeof item.amount === "number" ? item.amount : parseFloat(String(item.amount || 0)),
    percentage: item.percentage,
    color: item.color,
  }));

  const activeSlices = chartSlices.filter((s) => s.value > 0);
  const pieData = activeSlices.length > 0
    ? activeSlices
    : [{ key: "none", label: "Chưa có dòng tiền", value: 1, percentage: 100, color: "#e2e8f0" }];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      if (item.key === "none") return null;
      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-2.5 text-xs shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
          <div className="mt-1 font-bold text-slate-900">
            {formatVnd(item.value)}
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            Chiếm {item.percentage}% tổng dòng tiền
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-slate-900">Dòng tiền giao dịch</h3>
        <p className="text-xs text-slate-600">Phân bổ các nguồn tiền đã xử lý trong kỳ</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center my-auto">
        {/* Donut Chart */}
        <div
          className="relative h-[160px] sm:col-span-5 flex items-center justify-center shrink-0"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left + 10, y: e.clientY - rect.top - 20 });
          }}
          onMouseLeave={() => setMousePos(null)}
        >
          {loading ? (
            <div className="h-30 w-30 animate-pulse rounded-full bg-slate-100" />
          ) : (
            <>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center z-0 px-0.5">
                <span
                  className={cn(
                    "font-black text-slate-900 leading-none tracking-tight whitespace-nowrap text-center",
                    fullTotalFormatted.length > 15
                      ? "text-[8px]"
                      : fullTotalFormatted.length > 12
                      ? "text-[9px]"
                      : "text-[10.5px]"
                  )}
                  title={`Tổng dòng tiền: ${fullTotalFormatted}`}
                >
                  {fullTotalFormatted}
                </span>
                <span className="text-[8.5px] font-medium text-slate-500 mt-1">
                  Tổng dòng tiền
                </span>
              </div>
              <ResponsiveContainer width="100%" height="100%" className="z-10 relative">
                <PieChart>
                  <Tooltip
                    content={<CustomTooltip />}
                    position={mousePos ? { x: mousePos.x, y: mousePos.y } : undefined}
                    allowEscapeViewBox={{ x: true, y: true }}
                    isAnimationActive={false}
                    wrapperStyle={{
                      zIndex: 100,
                      pointerEvents: "none",
                    }}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={64}
                    paddingAngle={activeSlices.length > 1 ? 3 : 0}
                    isAnimationActive={true}
                    animationDuration={500}
                    animationEasing="ease-out"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* 4 Financial Cash Inflow Streams - Chỉ hiện % */}
        <div className="sm:col-span-7 space-y-1.5 text-xs">
          {chartSlices.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-1.5 py-1 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] font-medium text-slate-700 whitespace-nowrap">
                  {item.label}
                </span>
              </div>
              <div className="text-right shrink-0 whitespace-nowrap">
                <span className="text-[11px] font-bold text-slate-900">
                  {item.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
