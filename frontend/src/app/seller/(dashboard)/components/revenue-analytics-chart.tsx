"use client";

import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { BarChart3, Calendar, SlidersHorizontal } from "lucide-react";
import { formatVnd, formatVndCompact, parseApiDateTime } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import type { Order } from "@/types/models";

export interface RevenueAnalyticsChartProps {
  orders: Order[];
}

export type PeriodOption = "today" | "7_days" | "30_days" | "12_months" | "all" | "custom";

interface DataPoint {
  dateKey: string;
  displayDate: string;
  completedRevenue: number; // Tiền hàng từ đơn hoàn tất (COMPLETED)
  grossSales: number;       // Tổng tiền hàng bán ra (hợp lệ, chưa bị hủy/hoàn)
  ordersCount: number;      // Số đơn phát sinh
}

export function RevenueAnalyticsChart({ orders }: RevenueAnalyticsChartProps) {
  const [period, setPeriod] = useState<PeriodOption>("7_days");

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const { chartData, totalCompletedRevenue, totalGrossSales, totalPeriodOrders } = useMemo(() => {
    const now = new Date();
    const points: DataPoint[] = [];

    // Helper: is completed order (tiền hàng thực nhận)
    const isCompleted = (order: Order) => order.orderStatus === "COMPLETED";

    // Helper: is valid sales (tổng tiền hàng bán ra, loại trừ đơn hủy/hoàn)
    const isGrossSale = (order: Order) =>
      order.orderStatus !== "CANCELLED" &&
      order.orderStatus !== "RETURNED" &&
      order.orderStatus !== "DELIVERY_FAILED";

    if (period === "today") {
      const hourBuckets = [
        { hour: 0, label: "00:00" },
        { hour: 4, label: "04:00" },
        { hour: 8, label: "08:00" },
        { hour: 12, label: "12:00" },
        { hour: 16, label: "16:00" },
        { hour: 20, label: "20:00" },
        { hour: 23, label: "23:59" }
      ];

      const bucketMap = hourBuckets.map((b) => ({
        ...b,
        completedRevenue: 0,
        grossSales: 0,
        ordersCount: 0
      }));

      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 86400000;

      let sumCompleted = 0;
      let sumGross = 0;
      let sumOrders = 0;

      for (const order of orders) {
        const orderDate = parseApiDateTime(order.createdAt);
        if (!orderDate) continue;
        const time = orderDate.getTime();
        if (time >= startOfToday && time < endOfToday) {
          sumOrders += 1;
          const subtotal = order.subtotalAmount ?? 0;
          const completedAmount = isCompleted(order) ? subtotal : 0;
          const grossAmount = isGrossSale(order) ? subtotal : 0;

          sumCompleted += completedAmount;
          sumGross += grossAmount;

          const h = orderDate.getHours();
          let matchedBucket = bucketMap[0];
          for (let i = 0; i < bucketMap.length; i++) {
            if (h >= bucketMap[i].hour) {
              matchedBucket = bucketMap[i];
            }
          }
          matchedBucket.ordersCount += 1;
          matchedBucket.completedRevenue += completedAmount;
          matchedBucket.grossSales += grossAmount;
        }
      }

      bucketMap.forEach((b) => {
        points.push({
          dateKey: `today-${b.label}`,
          displayDate: b.label,
          completedRevenue: b.completedRevenue,
          grossSales: b.grossSales,
          ordersCount: b.ordersCount
        });
      });

      return {
        chartData: points,
        totalCompletedRevenue: sumCompleted,
        totalGrossSales: sumGross,
        totalPeriodOrders: sumOrders
      };
    }

    if (period === "7_days" || period === "30_days") {
      const numDays = period === "7_days" ? 7 : 30;
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayMap = new Map<string, { completedRevenue: number; grossSales: number; ordersCount: number; displayDate: string }>();

      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - i);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const displayDate = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        dayMap.set(dateKey, { completedRevenue: 0, grossSales: 0, ordersCount: 0, displayDate });
      }

      for (const order of orders) {
        const orderDate = parseApiDateTime(order.createdAt);
        if (!orderDate) continue;
        const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;
        const entry = dayMap.get(dateKey);
        if (entry) {
          entry.ordersCount += 1;
          const subtotal = order.subtotalAmount ?? 0;
          if (isCompleted(order)) {
            entry.completedRevenue += subtotal;
          }
          if (isGrossSale(order)) {
            entry.grossSales += subtotal;
          }
        }
      }

      let sumCompleted = 0;
      let sumGross = 0;
      let sumOrders = 0;

      dayMap.forEach((val, key) => {
        points.push({
          dateKey: key,
          displayDate: val.displayDate,
          completedRevenue: val.completedRevenue,
          grossSales: val.grossSales,
          ordersCount: val.ordersCount
        });
        sumCompleted += val.completedRevenue;
        sumGross += val.grossSales;
        sumOrders += val.ordersCount;
      });

      return {
        chartData: points,
        totalCompletedRevenue: sumCompleted,
        totalGrossSales: sumGross,
        totalPeriodOrders: sumOrders
      };
    }

    if (period === "12_months") {
      const monthMap = new Map<string, { completedRevenue: number; grossSales: number; ordersCount: number; displayDate: string }>();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const displayDate = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
        monthMap.set(key, { completedRevenue: 0, grossSales: 0, ordersCount: 0, displayDate });
      }

      for (const order of orders) {
        const orderDate = parseApiDateTime(order.createdAt);
        if (!orderDate) continue;
        const key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
        const entry = monthMap.get(key);
        if (entry) {
          entry.ordersCount += 1;
          const subtotal = order.subtotalAmount ?? 0;
          if (isCompleted(order)) {
            entry.completedRevenue += subtotal;
          }
          if (isGrossSale(order)) {
            entry.grossSales += subtotal;
          }
        }
      }

      let sumCompleted = 0;
      let sumGross = 0;
      let sumOrders = 0;

      monthMap.forEach((val, key) => {
        points.push({
          dateKey: key,
          displayDate: val.displayDate,
          completedRevenue: val.completedRevenue,
          grossSales: val.grossSales,
          ordersCount: val.ordersCount
        });
        sumCompleted += val.completedRevenue;
        sumGross += val.grossSales;
        sumOrders += val.ordersCount;
      });

      return {
        chartData: points,
        totalCompletedRevenue: sumCompleted,
        totalGrossSales: sumGross,
        totalPeriodOrders: sumOrders
      };
    }

    if (period === "all") {
      let earliestDate = now;
      for (const order of orders) {
        const d = parseApiDateTime(order.createdAt);
        if (d && d.getTime() < earliestDate.getTime()) {
          earliestDate = d;
        }
      }

      const startYear = earliestDate.getFullYear();
      const startMonth = earliestDate.getMonth();
      const endYear = now.getFullYear();
      const endMonth = now.getMonth();

      const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
      const monthMap = new Map<string, { completedRevenue: number; grossSales: number; ordersCount: number; displayDate: string }>();

      for (let i = 0; i < totalMonths; i++) {
        const d = new Date(startYear, startMonth + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const displayDate = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
        monthMap.set(key, { completedRevenue: 0, grossSales: 0, ordersCount: 0, displayDate });
      }

      for (const order of orders) {
        const orderDate = parseApiDateTime(order.createdAt);
        if (!orderDate) continue;
        const key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
        const entry = monthMap.get(key);
        if (entry) {
          entry.ordersCount += 1;
          const subtotal = order.subtotalAmount ?? 0;
          if (isCompleted(order)) {
            entry.completedRevenue += subtotal;
          }
          if (isGrossSale(order)) {
            entry.grossSales += subtotal;
          }
        }
      }

      let sumCompleted = 0;
      let sumGross = 0;
      let sumOrders = 0;

      monthMap.forEach((val, key) => {
        points.push({
          dateKey: key,
          displayDate: val.displayDate,
          completedRevenue: val.completedRevenue,
          grossSales: val.grossSales,
          ordersCount: val.ordersCount
        });
        sumCompleted += val.completedRevenue;
        sumGross += val.grossSales;
        sumOrders += val.ordersCount;
      });

      return {
        chartData: points,
        totalCompletedRevenue: sumCompleted,
        totalGrossSales: sumGross,
        totalPeriodOrders: sumOrders
      };
    }

    if (period === "custom") {
      const start = customStartDate ? new Date(customStartDate) : new Date(now.getTime() - 14 * 86400000);
      const end = customEndDate ? new Date(customEndDate) : now;

      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      const diffDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
      const dayMap = new Map<string, { completedRevenue: number; grossSales: number; ordersCount: number; displayDate: string }>();

      for (let i = 0; i < diffDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const displayDate = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        dayMap.set(dateKey, { completedRevenue: 0, grossSales: 0, ordersCount: 0, displayDate });
      }

      for (const order of orders) {
        const orderDate = parseApiDateTime(order.createdAt);
        if (!orderDate) continue;
        const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;
        const entry = dayMap.get(dateKey);
        if (entry) {
          entry.ordersCount += 1;
          const subtotal = order.subtotalAmount ?? 0;
          if (isCompleted(order)) {
            entry.completedRevenue += subtotal;
          }
          if (isGrossSale(order)) {
            entry.grossSales += subtotal;
          }
        }
      }

      let sumCompleted = 0;
      let sumGross = 0;
      let sumOrders = 0;

      dayMap.forEach((val, key) => {
        points.push({
          dateKey: key,
          displayDate: val.displayDate,
          completedRevenue: val.completedRevenue,
          grossSales: val.grossSales,
          ordersCount: val.ordersCount
        });
        sumCompleted += val.completedRevenue;
        sumGross += val.grossSales;
        sumOrders += val.ordersCount;
      });

      return {
        chartData: points,
        totalCompletedRevenue: sumCompleted,
        totalGrossSales: sumGross,
        totalPeriodOrders: sumOrders
      };
    }

    return {
      chartData: [],
      totalCompletedRevenue: 0,
      totalGrossSales: 0,
      totalPeriodOrders: 0
    };
  }, [orders, period, customStartDate, customEndDate]);

  const periodOptions: { id: PeriodOption; label: string }[] = [
    { id: "today", label: "Hôm nay" },
    { id: "7_days", label: "7 ngày" },
    { id: "30_days", label: "30 ngày" },
    { id: "12_months", label: "12 tháng" },
    { id: "all", label: "Tất cả" },
    { id: "custom", label: "Tùy chọn" }
  ];

  return (
    <div className="rounded-panel border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-line">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-ink">Hiệu suất Doanh thu & Tiền hàng</h3>
            <p className="text-xs text-muted">Phân tích tiền hàng thực nhận & tổng tiền hàng bán ra</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-lg border border-line bg-slate-50 p-0.5 text-xs font-semibold">
            {periodOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors",
                  period === opt.id
                    ? "bg-white text-emerald-700 shadow-xs font-bold"
                    : "text-muted hover:text-ink"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {period === "custom" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs border border-line">
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted" />
            Chọn khoảng thời gian:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-muted">Từ:</label>
            <input
              type="date"
              value={customStartDate}
              max={customEndDate || todayStr}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="rounded-md border border-line bg-white px-2.5 py-1 text-xs text-ink outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-muted">Đến:</label>
            <input
              type="date"
              value={customEndDate}
              min={customStartDate}
              max={todayStr}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="rounded-md border border-line bg-white px-2.5 py-1 text-xs text-ink outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Metric summary banner */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 pb-4">
        <div className="rounded-lg bg-emerald-50/70 border border-emerald-100 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800">Doanh thu hoàn tất</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-black text-emerald-700">
            {formatVnd(totalCompletedRevenue)}
          </p>
          <span className="text-[10px] text-emerald-600">Đơn hàng hoàn thành thành công</span>
        </div>

        <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-800">Tổng tiền hàng bán ra</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <p className="mt-1 text-base sm:text-lg font-black text-blue-700">
            {formatVnd(totalGrossSales)}
          </p>
          <span className="text-[10px] text-blue-600">Tổng tiền hàng phát sinh (chưa hủy/hoàn)</span>
        </div>

        <div className="rounded-lg bg-slate-50 border border-line p-3">
          <span className="text-[11px] font-medium text-muted">Tổng số đơn phát sinh</span>
          <p className="mt-1 text-base sm:text-lg font-black text-ink">
            {totalPeriodOrders}
          </p>
          <span className="text-[10px] text-muted">Tất cả đơn hàng phát sinh trong kỳ</span>
        </div>
      </div>

      <div className="mt-2 h-[270px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="displayDate"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatVndCompact(v)}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as DataPoint;
                  return (
                    <div className="rounded-lg border border-line bg-white p-3 shadow-lg text-xs min-w-[200px]">
                      <p className="font-bold text-ink mb-1.5 flex items-center gap-1 border-b border-line pb-1">
                        <Calendar className="h-3.5 w-3.5 text-muted" />
                        Thời gian: {data.displayDate}
                      </p>
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1 text-blue-700 font-medium">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            Tiền hàng bán ra:
                          </span>
                          <strong className="text-blue-700">{formatVnd(data.grossSales)}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Doanh thu hoàn tất:
                          </span>
                          <strong className="text-emerald-700">{formatVnd(data.completedRevenue)}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 text-slate-600">
                          <span>Số đơn phát sinh:</span>
                          <strong>{data.ordersCount}</strong>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={30}
              formatter={(value) => (
                <span className="text-[11px] font-semibold text-slate-700 mr-2">
                  {value === "grossSales" ? "Tổng tiền hàng bán ra" : "Doanh thu hoàn tất"}
                </span>
              )}
            />
            <Area
              type="monotone"
              dataKey="grossSales"
              name="grossSales"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#grossGradient)"
            />
            <Area
              type="monotone"
              dataKey="completedRevenue"
              name="completedRevenue"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#completedGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
