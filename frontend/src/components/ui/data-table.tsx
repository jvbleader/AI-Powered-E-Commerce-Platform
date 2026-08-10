"use client";

import type { ReactNode } from "react";
import { EmptyState } from "./feedback";
import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  rows,
  empty,
  getRowKey,
  aligns
}: {
  columns: (string | ReactNode)[];
  rows: ReactNode[][];
  empty?: ReactNode;
  getRowKey?: (row: ReactNode[], index: number) => string;
  aligns?: ("left" | "center" | "right")[];
}) {
  if (!rows.length) {
    return <>{empty ?? <EmptyState title="Chưa có dữ liệu" description="Không tìm thấy bản ghi phù hợp." />}</>;
  }
  return (
    <div className="flex-1 overflow-auto rounded-panel border border-line bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>
            {columns.map((column, index) => {
              const align = aligns?.[index] || "left";
              return (
                <th key={index} className={cn("whitespace-nowrap px-3 py-4 font-bold bg-slate-50", align === "center" && "text-center", align === "right" && "text-right")}>
                  {column}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey ? getRowKey(row, rowIndex) : rowIndex} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => {
                const align = aligns?.[cellIndex] || "left";
                return (
                  <td key={cellIndex} className={cn("px-3 py-3 align-middle text-ink", align === "center" && "text-center", align === "right" && "text-right")}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
