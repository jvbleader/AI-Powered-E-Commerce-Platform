"use client";

import React from "react";
import { Package } from "lucide-react";
import { AdminTopProductDetailed } from "@/services/admin-api";
import { formatVnd } from "@/lib/helpers";

interface TopProductsTableProps {
  products: AdminTopProductDetailed[];
  loading?: boolean;
}

export function TopProductsTable({ products, loading }: TopProductsTableProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">Sản phẩm bán chạy</h3>
        <p className="text-xs text-slate-600">Mặt hàng có lượt mua cao nhất</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-600 font-semibold">
              <th className="pb-2.5 w-8">#</th>
              <th className="pb-2.5">Sản phẩm</th>
              <th className="pb-2.5">Người bán</th>
              <th className="pb-2.5 text-center w-16">Đã bán</th>
              <th className="pb-2.5 text-right">Doanh thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-2.5">
                    <div className="h-4 w-4 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5">
                    <div className="h-4 w-32 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5">
                    <div className="h-4 w-20 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5 text-center">
                    <div className="h-4 w-8 rounded bg-slate-100 mx-auto" />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="h-4 w-20 rounded bg-slate-100 ml-auto" />
                  </td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                  Chưa có sản phẩm phát sinh lượt bán
                </td>
              </tr>
            ) : (
              products.map((prod) => (
                <tr
                  key={prod.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-2.5 font-bold text-slate-600">
                    {prod.rank}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="h-7 w-7 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 shrink-0">
                          <Package className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <span className="font-medium text-slate-900 truncate max-w-[140px]">
                        {prod.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-slate-600 truncate max-w-[100px]">
                    {prod.seller_name}
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">
                    {prod.sold_count.toLocaleString("vi-VN")}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-800">
                    {formatVnd(prod.revenue)}
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
