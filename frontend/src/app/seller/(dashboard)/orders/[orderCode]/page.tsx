"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, User, CreditCard, Receipt, Printer, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import {
  canSellerCancel,
  canSellerConfirm,
  canSellerShip,
  formatDate,
  formatVnd,
  orderStatusLabel,
  paymentStatusLabel,
  orderPaymentMethodLabel
} from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerOrderDetailPage() {
  const params = useParams();
  const orderCode = params.orderCode as string;
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;

  const order = store.state.orders.find(
    (item) => item.id === orderCode || item.orderCode === orderCode
  );

  useEffect(() => {
    if (!order && orderCode) {
      store.fetchSellerOrderDetail(orderCode);
    }
  }, [order, orderCode, store.fetchSellerOrderDetail]);

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi xem chi tiết đơn hàng." />;
  }

  if (!shop || !order) {
    return (
      <div className="flex justify-center p-8">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>
    );
  }

  const findPaymentForOrder = (orderCode: string) =>
    store.state.payments.find((payment) => payment.orderCodes.includes(orderCode));

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, "success");
  };

  const payment = findPaymentForOrder(order.orderCode);
  const paymentTime = payment?.paidAt
    ? formatDate(payment.paidAt)
    : payment?.createdAt
    ? formatDate(payment.createdAt)
    : order.paymentStatus === "PAID"
    ? formatDate(order.createdAt)
    : null;

  return (
    <Section title={null} className="pt-2">
      <div className="mb-4">
        <button
          onClick={() => {
            // Using window.location.href or router.push triggers nav. 
            // We use history.back() if possible, else push
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/seller/orders";
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 transition bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
          Quay lại danh sách đơn hàng
        </button>
      </div>

      <div className="space-y-4">
        {/* HEADER: ID & ACTIONS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-panel border border-line shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">#{order.orderCode}</h2>
              <button
                type="button"
                onClick={() => handleCopy(order.orderCode, "mã đơn hàng")}
                className="p-1 text-slate-400 hover:text-emerald-700 transition"
                title="Sao chép mã đơn"
              >
                <Copy className="h-4 w-4" />
              </button>
              <StatusBadge status={order.orderStatus} label={order.sellerConfirmed && order.orderStatus === "PLACED" ? "Đã xác nhận (chờ TT)" : orderStatusLabel[order.orderStatus]} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ngày đặt: <span className="font-semibold text-slate-700">{formatDate(order.createdAt)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canSellerConfirm(order) && (
              <Button onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>
                Xác nhận đơn
              </Button>
            )}
            {canSellerShip(order) && (
              <Button variant="secondary" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) { showToast("Đã chuyển shipping.", "success"); window.open(`/seller/print-orders?ids=${order.id}`, '_blank'); } else { showToast(res.message || "Lỗi chuyển shipping", "danger"); } })}>
                Chuyển giao hàng
              </Button>
            )}
            {canSellerCancel(order) && (
              <Button variant="danger" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })}>
                Từ chối đơn
              </Button>
            )}
            {order.orderStatus === "SHIPPING" && (
              <Button 
                variant="secondary" 
                disabled={(order.printCount || 0) >= 2} 
                title={(order.printCount || 0) >= 2 ? "Đã hết lượt in lại" : ""}
                onClick={() => store.incrementPrintCount(order.id).then((res) => { if (res.ok) { window.open(`/seller/print-orders?ids=${order.id}`, '_blank'); } else { showToast(res.message || "Lỗi in lại", "danger"); } })}
              >
                <Printer className="h-4 w-4 mr-1" />
                In lại ({Math.max(0, 2 - (order.printCount || 0))})
              </Button>
            )}
          </div>
        </div>

        {/* 3-COLUMN KPI INFO GRID */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Customer */}
          <Panel className="p-4 flex flex-col gap-2 bg-white h-full">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-1">
              <User className="h-4 w-4 text-emerald-600" />
              Khách hàng & Giao hàng
            </div>
            <div className="text-sm">
              <span className="font-semibold text-slate-900">{order.shipment.receiverName}</span>
              <span className="text-slate-500 ml-2">{order.shipment.receiverPhone}</span>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed mt-1">
              {order.shipment.detailAddress}, {order.shipment.ward}, {order.shipment.district}, {order.shipment.province}
            </div>
            {order.shipment?.shippingProviderName && (
              <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 bg-slate-50 p-1.5 rounded border border-line">
                <Truck className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700">ĐVVC:</span> {order.shipment.shippingProviderName}
              </div>
            )}
            {order.customerNote && (
              <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded max-h-20 overflow-y-auto">
                <span className="font-semibold">Ghi chú:</span> {order.customerNote}
              </div>
            )}
          </Panel>

          {/* Payment & Status */}
          <Panel className="p-4 flex flex-col gap-2 bg-white h-full">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-1">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Thanh toán & Trạng thái
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-y-2 text-xs items-center">
              <span className="text-slate-500">Thanh toán</span>
              <div><StatusBadge status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} /></div>
              
              <span className="text-slate-500">Phương thức</span>
              <span className="font-semibold text-slate-800">{orderPaymentMethodLabel(order, payment)}</span>
              
              {paymentTime && (
                <>
                  <span className="text-slate-500">Thời gian TT</span>
                  <span className="font-semibold text-slate-800">{paymentTime}</span>
                </>
              )}
            </div>
          </Panel>

          {/* Financials */}
          <Panel className="p-4 flex flex-col gap-2 bg-white h-full">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-1">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Tài chính
            </div>
            <div className="grid gap-1.5 text-sm mt-1">
              <div className="flex justify-between text-slate-600">
                <span>Tổng tiền hàng</span>
                <span>{formatVnd(order.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Phí vận chuyển</span>
                <span>{formatVnd(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-2 mt-1">
                <span>Tổng cộng</span>
                <span className="text-emerald-700">{formatVnd(order.totalAmount)}</span>
              </div>
            </div>
          </Panel>
        </div>

        {/* ORDER ITEMS TABLE */}
        <Panel className="p-0 overflow-hidden bg-white">
          <div className="overflow-x-auto overflow-y-auto max-h-80">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-line sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600">Sản phẩm</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">SKU</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Đơn giá</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-center">SL</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <img src={item.productImageSnapshot} alt={item.productNameSnapshot} className="h-10 w-10 rounded border border-line object-cover shrink-0" />
                        <div>
                          <p className="font-bold text-slate-900 line-clamp-1" title={item.productNameSnapshot}>{item.productNameSnapshot}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.variantNameSnapshot}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {item.skuSnapshot || "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                      {formatVnd(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-800">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatVnd(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
