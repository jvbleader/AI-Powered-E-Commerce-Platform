"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AdminHourlyHeatmapCell } from "@/services/admin-api";
import { cn } from "@/lib/utils";

interface HourlyHeatmapProps {
  data: AdminHourlyHeatmapCell[];
  loading?: boolean;
}

export function HourlyHeatmap({ data, loading }: HourlyHeatmapProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<AdminHourlyHeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return "bg-emerald-50/50 border-emerald-100/40";
    if (intensity < 20) return "bg-emerald-100/70 border-emerald-200";
    if (intensity < 45) return "bg-emerald-200 border-emerald-300";
    if (intensity < 70) return "bg-emerald-400 border-emerald-500";
    if (intensity < 90) return "bg-emerald-500 border-emerald-600";
    return "bg-emerald-700 border-emerald-800";
  };

  const getLevelLabel = (intensity: number, count: number) => {
    if (count === 0) return "Chưa có truy cập";
    if (intensity >= 90) return "Khung giờ vàng (Cao điểm)";
    if (intensity >= 70) return "Truy cập rất cao";
    if (intensity >= 45) return "Truy cập cao";
    if (intensity >= 20) return "Truy cập trung bình";
    return "Truy cập thấp";
  };

  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const clampedX = tooltipPos
    ? Math.max(160, Math.min(tooltipPos.x, windowWidth - 160))
    : 0;

  return (
    <div className="relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Khung giờ hoạt động</h3>
          <p className="text-xs text-slate-600">
            Tần suất người dùng truy cập sàn theo từng khung giờ trong tuần (GMT+7)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[480px]">
          {/* Hour labels header */}
          <div className="flex items-center pl-8 mb-1.5 text-[10px] text-slate-600">
            {hours.map((h) => (
              <div
                key={h}
                className="flex-1 text-center font-medium"
                style={{ minWidth: "14px" }}
              >
                {h % 4 === 0 ? `${h}h` : ""}
              </div>
            ))}
          </div>

          {/* 7 Days Grid */}
          <div className="space-y-1">
            {dayLabels.map((dayLabel, dayIndex) => {
              const dayCells = data.filter((c) => c.day_of_week === dayIndex);
              return (
                <div key={dayLabel} className="flex items-center gap-1.5">
                  <span className="w-6 text-[10px] font-semibold text-slate-600 shrink-0">
                    {dayLabel}
                  </span>
                  <div className="flex flex-1 items-center gap-1">
                    {hours.map((hour) => {
                      const cell =
                        dayCells.find((c) => c.hour === hour) || {
                          day_of_week: dayIndex,
                          day_label: dayLabel,
                          hour,
                          intensity: 0,
                          count: 0,
                        };

                      return (
                        <div
                          key={hour}
                          onMouseEnter={(e) => {
                            const cellRect = e.currentTarget.getBoundingClientRect();
                            setTooltipPos({
                              x: cellRect.left + cellRect.width / 2,
                              y: cellRect.top,
                            });
                            setHoveredCell(cell);
                          }}
                          onMouseLeave={() => {
                            setHoveredCell(null);
                            setTooltipPos(null);
                          }}
                          className={cn(
                            "h-5 flex-1 rounded-[3px] border transition-all cursor-pointer hover:scale-115 hover:z-10 hover:shadow-xs",
                            getIntensityColor(cell.intensity)
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic floating tooltip portaled to document.body so it can float outside ANY container */}
      {mounted &&
        hoveredCell &&
        tooltipPos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[99999] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-2xl backdrop-blur-md transition-all duration-75"
            style={{
              left: `${clampedX}px`,
              top: `${tooltipPos.y - 8}px`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">
                Thứ {hoveredCell.day_label}, {hoveredCell.hour}:00
              </span>
              <span className="text-slate-500">•</span>
              <span className="font-bold text-emerald-400">
                {hoveredCell.count} lượt truy cập
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                {getLevelLabel(hoveredCell.intensity, hoveredCell.count)}
              </span>
            </div>
            {/* Small pointer arrow pointing down to cell */}
            <div
              className="absolute -bottom-1 h-2 w-2 rotate-45 border-r border-b border-slate-700 bg-slate-900"
              style={{
                left: `calc(50% + ${tooltipPos.x - clampedX}px - 4px)`,
              }}
            />
          </div>,
          document.body
        )}

      {/* Legend */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-600">
        <span>Ít truy cập</span>
        <div className="flex items-center gap-1">
          <span className="h-3 w-4 rounded-[2px] bg-emerald-50 border border-emerald-100" />
          <span className="h-3 w-4 rounded-[2px] bg-emerald-200" />
          <span className="h-3 w-4 rounded-[2px] bg-emerald-400" />
          <span className="h-3 w-4 rounded-[2px] bg-emerald-500" />
          <span className="h-3 w-4 rounded-[2px] bg-emerald-700" />
        </div>
        <span className="font-semibold text-emerald-800">Cao điểm nhất</span>
      </div>
    </div>
  );
}
