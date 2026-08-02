"use client";

import type { ReactNode } from "react";
import { EmptyState } from "./feedback";

export function DataTable({
  columns,
  rows,
  empty,
  getRowKey
}: {
  columns: (string | ReactNode)[];
  rows: ReactNode[][];
  empty?: ReactNode;
  getRowKey?: (row: ReactNode[], index: number) => string;
}) {
  if (!rows.length) {
    return <>{empty ?? <EmptyState title="Chưa có dữ liệu" description="Không tìm thấy bản ghi phù hợp." />}</>;
  }
  return (
    <div className="flex-1 overflow-auto rounded-panel border border-line bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>
            {columns.map((column, index) => (
              <th key={index} className="whitespace-nowrap px-3 py-4 font-bold bg-slate-50">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey ? getRowKey(row, rowIndex) : rowIndex} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 align-middle text-ink truncate max-w-[200px]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
