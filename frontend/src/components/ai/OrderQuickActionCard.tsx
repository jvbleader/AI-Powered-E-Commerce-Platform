"use client";

import React, { memo } from "react";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  Clock,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Truck,
} from "lucide-react";
import { AIOrderContext } from "@/services/aiChatService";
import { formatVnd, formatDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";

export interface OrderQuickActionCardProps {
  order: AIOrderContext;
  className?: string;
}

const RETURN_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  REQUESTED: {
    label: "Chờ Shop duyệt trả hàng",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    icon: <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
  },
  SELLER_APPROVED: {
    label: "Shop đồng ý - Đang trả hàng",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    icon: <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />,
  },
  RETURNING: {
    label: "Đang vận chuyển trả hàng",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    icon: <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />,
  },
  COMPLETED: {
    label: "Đã hoàn tất trả hàng & hoàn tiền",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
    icon: <RotateCcw className="w-3.5 h-3.5 text-purple-600 shrink-0" />,
  },
  SELLER_REJECTED: {
    label: "Shop từ chối yêu cầu đổi trả",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
  },
  DISPUTED: {
    label: "Đang khiếu nại lên Sàn Shepoo",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
  },
  SUPPORT_APPROVED: {
    label: "Sàn chấp thuận hoàn tiền",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
  },
  SUPPORT_REJECTED: {
    label: "Sàn bác bỏ khiếu nại",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
  },
};

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  DELIVERED: {
    label: "Đã giao hàng",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />,
  },
  COMPLETED: {
    label: "Hoàn thành",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />,
  },
  SHIPPING: {
    label: "Đang giao hàng",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3 h-3 text-amber-600 shrink-0" />,
  },
  SHIPPED: {
    label: "Đang vận chuyển",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3 h-3 text-amber-600 shrink-0" />,
  },
  READY_TO_SHIP: {
    label: "Chờ lấy hàng",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3 h-3 text-amber-600 shrink-0" />,
  },
  PROCESSING: {
    label: "Đang xử lý",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3 h-3 text-amber-600 shrink-0" />,
  },
  PLACED: {
    label: "Đã đặt hàng",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Clock className="w-3 h-3 text-blue-600 shrink-0" />,
  },
  PENDING: {
    label: "Chờ xử lý",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3 h-3 text-amber-600 shrink-0" />,
  },
  CANCELLED: {
    label: "Đã hủy",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    icon: <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />,
  },
  RETURNED: {
    label: "Đã trả hàng / hoàn tiền",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
    icon: <RotateCcw className="w-3 h-3 text-purple-600 shrink-0" />,
  },
  DELIVERY_FAILED: {
    label: "Giao thất bại",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    icon: <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />,
  },
};

function OrderQuickActionCardInner({
  order,
  className,
}: OrderQuickActionCardProps) {
  if (!order || !order.order_code) return null;

  const normalizedStatus = (order.status || "").toUpperCase();
  const statusConfig = ORDER_STATUS_CONFIG[normalizedStatus] || {
    label: order.status || "Chưa rõ",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
    icon: <Package className="w-3 h-3 text-slate-500 shrink-0" />,
  };

  const isDelivered = normalizedStatus === "DELIVERED" || normalizedStatus === "COMPLETED";
  const orderTargetUrl = `/account/orders/${encodeURIComponent(order.order_code)}`;

  const items = order.items || [];
  const displayItems = items.slice(0, 3);
  const remainingCount = items.length - displayItems.length;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-sm space-y-3 max-w-full text-slate-800 transition-all hover:border-slate-300",
        className
      )}
    >
      {/* Header: Order code and Status Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Package className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="font-bold text-sm text-slate-900 tracking-tight truncate">
            #{order.order_code}
          </span>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0",
            statusConfig.badgeClass
          )}
        >
          {statusConfig.icon}
          <span>{statusConfig.label}</span>
        </span>
      </div>

      {/* Return / Refund Status or Eligibility Badge */}
      {order.has_return_request || order.return_status ? (
        (() => {
          const retConfig =
            RETURN_STATUS_CONFIG[order.return_status || "REQUESTED"] || {
              label: "Đang xử lý yêu cầu đổi trả",
              badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
              icon: <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
            };
          return (
            <div
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border text-xs font-medium",
                retConfig.badgeClass
              )}
            >
              {retConfig.icon}
              <span>
                {retConfig.label}
                {order.return_code ? ` (${order.return_code})` : ""}
              </span>
            </div>
          );
        })()
      ) : order.is_returnable ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Đủ điều kiện đổi trả
            {order.days_since_delivery !== null &&
            order.days_since_delivery !== undefined
              ? ` (Đã giao ${order.days_since_delivery} ngày trước)`
              : ""}
          </span>
        </div>
      ) : isDelivered ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Hết hạn đổi trả miễn phí
            {order.days_since_delivery !== null &&
            order.days_since_delivery !== undefined &&
            order.days_since_delivery > 7
              ? ` (Đã giao ${order.days_since_delivery} ngày > 7 ngày)`
              : " (> 7 ngày)"}
          </span>
        </div>
      ) : null}

      {/* Items Preview */}
      {displayItems.length > 0 ? (
        <div className="space-y-1.5 text-xs">
          {displayItems.map((item, idx) => {
            const name = item.product_name || item.item_name || "Sản phẩm";
            const variant = item.variant_name;
            const price = item.unit_price;

            return (
              <div
                key={item.item_id || idx}
                className="flex items-center justify-between gap-2 text-slate-700 bg-slate-50/70 p-1.5 rounded-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 truncate">{name}</p>
                  {variant && (
                    <p className="text-[11px] text-slate-500 truncate">{variant}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-medium text-slate-700">
                    x{item.quantity || 1}
                  </span>
                  {price !== undefined && price !== null && (
                    <span className="text-[11px] text-slate-500 ml-1.5">
                      ({formatVnd(price)})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {remainingCount > 0 && (
            <p className="text-[11px] text-slate-500 italic text-center">
              + {remainingCount} sản phẩm khác trong đơn
            </p>
          )}
        </div>
      ) : order.items_summary ? (
        <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-md">
          {order.items_summary}
        </p>
      ) : null}

      {/* Total & Timestamps */}
      <div className="flex items-center justify-between text-xs pt-1">
        <div className="text-slate-500">
          {order.created_at && (
            <span>Ngày đặt: {formatDate(order.created_at)}</span>
          )}
        </div>
        {order.total_amount !== undefined && order.total_amount !== null && (
          <div className="text-right">
            <span className="text-slate-500 text-[11px]">Tổng: </span>
            <span className="font-bold text-sm text-emerald-700">
              {formatVnd(order.total_amount)}
            </span>
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <Link
          href={orderTargetUrl}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
        >
          <span>Xem đơn hàng</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </Link>

        {order.has_return_request || order.return_status ? (
          <Link
            href={orderTargetUrl}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span>Tiến độ đổi trả</span>
          </Link>
        ) : order.is_returnable ? (
          <Link
            href={orderTargetUrl}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Yêu cầu đổi trả</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export const OrderQuickActionCard = memo(OrderQuickActionCardInner);
