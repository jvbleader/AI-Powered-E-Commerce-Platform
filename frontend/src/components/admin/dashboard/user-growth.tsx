"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminUserGrowthPoint } from "@/services/admin-api";

type GrowthGranularity = "weekly" | "monthly";

interface GrowthTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: AdminUserGrowthPoint }>;
}

function GrowthTooltip({ active, payload }: GrowthTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-panel border border-line bg-white px-3 py-2 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {formatBucketLabel(point.date)}
      </p>
      <p className="mt-1 text-sm font-bold text-primary">
        +{point.count.toLocaleString("vi-VN")} người dùng mới
      </p>
    </div>
  );
}

function formatBucketLabel(dateStr: string): string {
  // weekly: ISO Monday date "YYYY-MM-DD" | monthly: "YYYY-MM"
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [, m, d] = dateStr.split("-");
    return `${d}/${m}`;
  }
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split("-");
    return `${m}/${y.slice(2)}`;
  }
  return dateStr;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null || !Number.isFinite(pct)) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
        —
      </span>
    );
  }

  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
        0%
      </span>
    );
  }

  const isUp = rounded > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
        isUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
      )}
    >
      {isUp ? "▲" : "▼"} {Math.abs(rounded)}%
    </span>
  );
}

export function UserGrowth({ totalUsers, weekly, monthly }: { totalUsers: number; weekly: AdminUserGrowthPoint[]; monthly: AdminUserGrowthPoint[] }) {
  const [granularity, setGranularity] = useState<GrowthGranularity>("weekly");

  const data = granularity === "weekly" ? weekly : monthly;

  /** Kỳ hiện tại vs kỳ liền trước (2 phần tử cuối cùng của chuỗi). */
  const deltaPct = useMemo(() => {
    if (!data || data.length < 2) return null;
    const current = data[data.length - 1]?.count ?? 0;
    const previous = data[data.length - 2]?.count ?? 0;
    if (previous <= 0) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  }, [data]);

  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="space-y-3 rounded-panel border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <UserPlus className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Người dùng mới</h3>
            <p className="mt-0.5 text-xs text-muted">
              Tổng toàn sàn:{" "}
              <strong className="font-semibold text-ink">{totalUsers.toLocaleString("vi-VN")}</strong>
              <span className="mx-1.5">·</span>
              Kỳ này:{" "}
              <strong className="font-semibold text-ink">
                {(data[data.length - 1]?.count ?? 0).toLocaleString("vi-VN")}
              </strong>{" "}
              <DeltaBadge pct={deltaPct} />
            </p>
          </div>
        </div>

        <div
          className="flex items-center self-start rounded-lg border border-line bg-slate-100 p-0.5 sm:self-auto"
          role="group"
          aria-label="Khoảng thời gian tăng trưởng"
        >
          {(
            [
              { key: "weekly" as const, label: "12 tuần" },
              { key: "monthly" as const, label: "12 tháng" }
            ]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setGranularity(opt.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                granularity === opt.key ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[200px] w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
            Chưa có người dùng nào đăng ký trong khoảng thời gian này
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8E3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: "#E2E8E3" }}
                tick={{ fontSize: 11, fill: "#5E6A63" }}
                interval="preserveStartEnd"
                minTickGap={20}
                tickFormatter={formatBucketLabel}
              />
              <YAxis
                width={36}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#5E6A63" }}
                allowDecimals={false}
              />
              <Tooltip content={<GrowthTooltip />} cursor={{ fill: "rgba(11,107,78,0.06)" }} />
              <Bar dataKey="count" fill="#0B6B4E" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="border-t border-line pt-2 text-[11px] text-muted">
        {granularity === "weekly"
          ? "Số tài khoản đăng ký theo tuần ISO (thứ Hai → Chủ nhật)"
          : "Số tài khoản đăng ký theo tháng"}
      </p>
    </div>
  );
}
