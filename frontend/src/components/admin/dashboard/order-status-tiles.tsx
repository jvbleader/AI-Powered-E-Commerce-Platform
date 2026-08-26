"use client";

import { cn } from "@/lib/utils";

export function OrderStatusTiles({
  completed = 0,
  shipping = 0,
  pendingProcessing = 0,
  cancelled = 0
}: {
  completed?: number;
  shipping?: number;
  pendingProcessing?: number;
  cancelled?: number;
}) {
  const tiles = [
    { label: "Hoàn tất", value: completed, valueClass: "text-emerald-600" },
    { label: "Đang giao", value: shipping, valueClass: "text-sky-600" },
    { label: "Chờ xử lý", value: pendingProcessing, valueClass: "text-amber-600" },
    { label: "Đã hủy", value: cancelled, valueClass: "text-rose-600" }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-lg border border-line/60 bg-slate-50 px-2 py-2.5 text-center"
        >
          <span className="block text-[11px] font-medium text-muted">{tile.label}</span>
          <strong className={cn("text-sm", tile.valueClass)}>{tile.value.toLocaleString("vi-VN")}</strong>
        </div>
      ))}
    </div>
  );
}
