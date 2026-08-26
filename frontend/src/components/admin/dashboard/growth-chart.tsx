"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatVnd, formatVndCompact } from "@/lib/helpers";
import { cn } from "@/lib/utils";

export type GrowthPreset = "7DAYS" | "30DAYS" | "12MONTHS";
export type GrowthMode = "revenue" | "orders";

export interface GrowthPoint {
  label: string;
  fullLabel?: string;
  revenue: number;
  orders: number;
}

type TooltipPayloadItem = { payload?: GrowthPoint };

interface TooltipRenderProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
}

function ChartTooltip({ active, payload, mode }: TooltipRenderProps & { mode: GrowthMode }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-panel border border-line bg-white px-3 py-2 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {point.fullLabel || point.label}
      </p>
      {mode === "revenue" ? (
        <>
          <p className="mt-1 text-sm font-bold text-primary">{formatVnd(point.revenue)}</p>
          <p className="text-[11px] text-muted">{point.orders} đơn hoàn tất</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm font-bold text-sky-600">{point.orders} đơn hàng</p>
          <p className="text-[11px] text-muted">Doanh thu: {formatVnd(point.revenue)}</p>
        </>
      )}
    </div>
  );
}

const PRESETS: Array<{ key: GrowthPreset; label: string }> = [
  { key: "7DAYS", label: "7 ngày" },
  { key: "30DAYS", label: "30 ngày" },
  { key: "12MONTHS", label: "12 tháng" }
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaPrefix
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
  ariaPrefix: string;
}) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-slate-100 p-0.5" role="group" aria-label={ariaPrefix}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
            value === opt.key ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function GrowthChart({
  data,
  mode,
  preset,
  onModeChange,
  onPresetChange,
  averageOrderValue = 0
}: {
  data: GrowthPoint[];
  mode: GrowthMode;
  preset: GrowthPreset;
  onModeChange: (mode: GrowthMode) => void;
  onPresetChange: (preset: GrowthPreset) => void;
  averageOrderValue?: number;
}) {
  const hasData = data.some((d) => d.revenue > 0 || d.orders > 0);
  const isMonthly = preset === "12MONTHS";

  const xTickFormatter = useMemo(
    () => (value: string) => value,
    []
  );

  const yTickFormatter = useMemo(
    () =>
      mode === "revenue"
        ? (value: number) => formatVndCompact(value)
        : (value: number) => String(Math.round(value)),
    [mode]
  );

  const tooltipContent = useMemo(
    () => (props: TooltipRenderProps) => (
      <ChartTooltip active={props.active} payload={props.payload} mode={mode} />
    ),
    [mode]
  );

  return (
    <div className="space-y-3 rounded-panel border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-bold text-ink">
            {mode === "revenue" ? "Doanh thu theo thời gian" : "Số đơn hàng theo thời gian"}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Đơn hoàn tất · AOV:{" "}
            <span className="font-semibold text-ink">{formatVnd(averageOrderValue)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            ariaPrefix="Chế độ biểu đồ"
            options={[
              { key: "revenue" as GrowthMode, label: "Doanh thu" },
              { key: "orders" as GrowthMode, label: "Số đơn" }
            ]}
            value={mode}
            onChange={onModeChange}
          />
          <Segmented ariaPrefix="Khoảng thời gian" options={PRESETS} value={preset} onChange={onPresetChange} />
        </div>
      </div>

      <div className="h-[280px] w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
            Chưa có dữ liệu trong khoảng thời gian này
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {mode === "revenue" ? (
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0B6B4E" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#0B6B4E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8E3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8E3" }}
                  tick={{ fontSize: 11, fill: "#5E6A63" }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tickFormatter={xTickFormatter}
                />
                <YAxis
                  width={56}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#5E6A63" }}
                  tickFormatter={yTickFormatter}
                  domain={[0, "auto"]}
                />
                <Tooltip content={tooltipContent} cursor={{ stroke: "#CBD5E1", strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0B6B4E"
                  strokeWidth={2}
                  fill="url(#adminRevenueGradient)"
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff", fill: "#0B6B4E" }}
                  isAnimationActive
                />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8E3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8E3" }}
                  tick={{ fontSize: 11, fill: "#5E6A63" }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tickFormatter={xTickFormatter}
                />
                <YAxis
                  width={40}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#5E6A63" }}
                  tickFormatter={yTickFormatter}
                  allowDecimals={false}
                  domain={[0, "auto"]}
                />
                <Tooltip content={tooltipContent} cursor={{ fill: "rgba(59,130,246,0.06)" }} />
                <Bar dataKey="orders" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line pt-2 text-[11px] text-muted">
        <span>{isMonthly ? "12 tháng gần nhất" : preset === "7DAYS" ? "7 ngày gần nhất" : "30 ngày gần nhất"}</span>
        <span>Nguồn: đơn hàng COMPLETED</span>
      </div>
    </div>
  );
}
