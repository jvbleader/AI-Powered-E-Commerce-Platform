"use client";

import React from "react";
import { Star } from "lucide-react";
import { AdminTopSellerDetailed } from "@/services/admin-api";
import { formatVnd } from "@/lib/helpers";

interface TopSellersTableProps {
  sellers: AdminTopSellerDetailed[];
  loading?: boolean;
}

export function TopSellersTable({ sellers, loading }: TopSellersTableProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">
          Top người bán theo doanh thu
        </h3>
        <p className="text-xs text-slate-600">Các đối tác bán hàng xuất sắc nhất</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-600 font-semibold">
              <th className="pb-2.5 w-8">#</th>
              <th className="pb-2.5">Người bán</th>
              <th className="pb-2.5 text-right">Doanh thu</th>
              <th className="pb-2.5 text-center w-16">Đơn hàng</th>
              <th className="pb-2.5 text-right w-16">Đánh giá</th>
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
                    <div className="h-4 w-28 rounded bg-slate-100" />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="h-4 w-20 rounded bg-slate-100 ml-auto" />
                  </td>
                  <td className="py-2.5 text-center">
                    <div className="h-4 w-8 rounded bg-slate-100 mx-auto" />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="h-4 w-10 rounded bg-slate-100 ml-auto" />
                  </td>
                </tr>
              ))
            ) : sellers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                  Chưa có người bán phát sinh doanh thu
                </td>
              </tr>
            ) : (
              sellers.map((seller) => (
                <tr
                  key={seller.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-2.5 font-bold text-slate-600">
                    {seller.rank}
                  </td>
                  <td className="py-2.5 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {seller.logo_url ? (
                        <img
                          src={seller.logo_url}
                          alt={seller.name}
                          className="h-6 w-6 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                          {seller.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate max-w-[130px] font-medium text-slate-800">
                        {seller.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-800">
                    {formatVnd(seller.revenue)}
                  </td>
                  <td className="py-2.5 text-center text-slate-600">
                    {seller.products_count}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center gap-0.5 font-bold text-slate-800">
                      {seller.rating.toFixed(1)}
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </span>
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
