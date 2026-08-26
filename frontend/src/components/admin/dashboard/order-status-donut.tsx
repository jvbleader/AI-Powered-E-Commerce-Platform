"use client";

import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AdminOrderStatusDonutItem } from "@/services/admin-api";

interface OrderStatusDonutProps {
  data: AdminOrderStatusDonutItem[];
  totalOrders: number;
  loading?: boolean;
}

export function OrderStatusDonut({
  data,
  totalOrders,
  loading,
}: OrderStatusDonutProps) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: AdminOrderStatusDonutItem = payload[0].payload;
      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-2 text-xs shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
          <div className="text-slate-600 mt-1">
            <strong>{item.count.toLocaleString("vi-VN")}</strong> đơn ({item.percentage}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-slate-900">Đơn hàng theo trạng thái</h3>
        <p className="text-xs text-slate-600">Tỷ trọng các trạng thái xử lý đơn</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center my-auto">
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
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center z-0 px-1">
                <span className="text-base font-extrabold text-slate-900 leading-tight">
                  {totalOrders.toLocaleString("vi-VN")}
                </span>
                <span className="text-[9px] font-medium text-slate-500 mt-0.5">Tổng đơn</span>
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
                    data={data}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={64}
                    paddingAngle={3}
                    isAnimationActive={true}
                    animationDuration={500}
                    animationEasing="ease-out"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        <div className="sm:col-span-7 space-y-1 text-xs">
          {data.map((item) => (
            <div key={item.status} className="flex items-center justify-between gap-1.5 py-0.5 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] font-medium text-slate-700 whitespace-nowrap">{item.label}</span>
              </div>
              <div className="text-right shrink-0 whitespace-nowrap">
                <span className="text-[11px] font-bold text-slate-900">
                  {item.count.toLocaleString("vi-VN")}
                </span>{" "}
                <span className="text-[10px] font-medium text-slate-500">
                  ({item.percentage}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
