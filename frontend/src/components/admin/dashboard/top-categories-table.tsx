"use client";

import React from "react";
import { AdminTopCategory } from "@/services/admin-api";
import { formatVnd } from "@/lib/helpers";

interface TopCategoriesTableProps {
  categories: AdminTopCategory[];
  loading?: boolean;
}

export function TopCategoriesTable({
  categories,
  loading,
}: TopCategoriesTableProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">
          Top danh mục theo doanh thu
        </h3>
        <p className="text-xs text-slate-600">Các ngành hàng có doanh số lớn nhất</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-600 font-semibold">
              <th className="pb-2.5 w-8">#</th>
              <th className="pb-2.5">Danh mục</th>
              <th className="pb-2.5 text-right">Doanh thu</th>
              <th className="pb-2.5 text-right w-16">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-2.5">
                    <div className="h-4 w-4 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5">
                    <div className="h-4 w-28 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="h-4 w-20 rounded bg-slate-100 ml-auto" />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="h-4 w-10 rounded bg-slate-100 ml-auto" />
                  </td>
                </tr>
              ))
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                  Chưa có phát sinh doanh thu theo danh mục
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 font-bold text-slate-600">
                    {cat.rank}
                  </td>
                  <td className="py-2.5 font-medium text-slate-900 truncate max-w-[140px]">
                    {cat.name}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-800">
                    {formatVnd(cat.revenue)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-emerald-600">
                    {cat.percentage}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
