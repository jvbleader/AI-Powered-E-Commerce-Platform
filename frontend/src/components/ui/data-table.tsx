"use client";

import type { ReactNode } from "react";
import { EmptyState } from "./feedback";

export function DataTable({
  columns,
  rows,
  empty,
  getRowKey
}: {
  columns: string[];
  rows: ReactNode[][];
  empty?: ReactNode;
  getRowKey?: (row: ReactNode[], index: number) => string;
}) {
  if (!rows.length) {
    return <>{empty ?? <EmptyState title="Chưa có dữ liệu" description="Không tìm thấy bản ghi phù hợp." />}</>;
  }
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-canvas text-xs uppercase text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap border-b border-line px-3 py-3 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey ? getRowKey(row, rowIndex) : rowIndex} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="whitespace-nowrap px-3 py-3 align-middle text-ink">
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
