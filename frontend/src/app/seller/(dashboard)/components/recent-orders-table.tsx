"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatVnd, orderStatusLabel } from "@/lib/helpers";
import type { Order } from "@/types/models";

export interface RecentOrdersTableProps {
  orders: Order[];
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  const router = useRouter();

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="rounded-panel border border-line bg-white p-5 shadow-soft">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-ink">Đơn hàng mới nhất</h3>
          </div>
          <Link
            href="/seller/orders"
            className="flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Xem tất cả đơn
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-ink">Chưa có đơn hàng nào</p>
            <p className="mt-1 text-xs text-muted max-w-[240px]">
              Khi có khách hàng đặt mua, các đơn hàng mới nhất sẽ hiển thị ngay tại đây.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted font-semibold">
                  <th className="py-3 px-2">Mã đơn</th>
                  <th className="py-3 px-2">Khách hàng</th>
                  <th className="py-3 px-2">Tổng tiền</th>
                  <th className="py-3 px-2">Trạng thái</th>
                  <th className="py-3 px-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentOrders.map((order) => {
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-2 font-medium">
                        <Link
                          href={`/seller/orders/${order.orderCode}`}
                          className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline block"
                        >
                          #{order.orderCode}
                        </Link>
                        <span className="text-[11px] text-muted block mt-0.5">
                          {formatDate(order.createdAt)}
                        </span>
                      </td>

                      <td className="py-3 px-2">
                        <p className="font-semibold text-ink truncate max-w-[140px]">
                          {order.shipment?.receiverName && order.shipment.receiverName !== "-"
                            ? order.shipment.receiverName
                            : "Khách hàng"}
                        </p>
                        <p className="text-[11px] text-muted truncate max-w-[140px]">
                          {order.shipment?.receiverPhone && order.shipment.receiverPhone !== "-"
                            ? order.shipment.receiverPhone
                            : ""}
                        </p>
                      </td>

                      <td className="py-3 px-2 font-bold text-ink whitespace-nowrap">
                        {formatVnd(order.totalAmount)}
                      </td>

                      <td className="py-3 px-2 whitespace-nowrap">
                        <StatusBadge
                          status={order.orderStatus}
                          label={orderStatusLabel[order.orderStatus] || order.orderStatus}
                        />
                      </td>

                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <Button
                          variant="secondary"
                          className="h-7 min-h-0 px-2 py-1 text-xs"
                          onClick={() => router.push(`/seller/orders/${order.orderCode}`)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Xem
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

