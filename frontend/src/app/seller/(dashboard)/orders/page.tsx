"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
  canSellerCancel,
  canSellerConfirm,
  canSellerShip,
  formatVnd,
  orderStatusLabel,
  paymentStatusLabel,
} from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { Order, OrderStatus } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";
import { Check, X, Truck, Loader2, Printer } from "lucide-react";

export default function SellerOrdersPage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;
  
  // Filters
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [noteFilter, setNoteFilter] = useState("all");

  // Selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  useEffect(() => {
    if (shop) {
      store.fetchSellerOrders(orderStatusFilter as OrderStatus | "");
    }
  }, [shop, orderStatusFilter, store.fetchSellerOrders]);

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi xem đơn hàng." />;
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm font-semibold text-muted">Đang tải thông tin shop...</p>
      </main>
    );
  }

  const orders = store.state.orders.filter((order) => {
    if (order.sellerId !== shop.id) return false;
    if (orderStatusFilter && order.orderStatus !== orderStatusFilter) return false;
    if (paymentStatusFilter && order.paymentStatus !== paymentStatusFilter) return false;
    if (noteFilter === "yes" && !order.customerNote) return false;
    if (noteFilter === "no" && order.customerNote) return false;
    return true;
  });

  const toggleSelection = (orderId: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    setSelectedOrderIds(next);
  };

  const toggleAll = () => {
    if (selectedOrderIds.size === orders.length && orders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map(o => o.id)));
    }
  };

  const processBulkAction = async (
    actionFn: (id: string) => Promise<{ok: boolean, message: string}>, 
    checkFn: (order: Order) => boolean,
    actionName: string
  ) => {
    if (selectedOrderIds.size === 0) return;

    for (const id of Array.from(selectedOrderIds)) {
      const order = orders.find(o => o.id === id);
      if (order && !checkFn(order)) {
        showToast(`Đơn hàng #${order.orderCode} không cho phép thao tác ${actionName}. Đã huỷ toàn bộ yêu cầu.`, "danger");
        return;
      }
    }

    setIsProcessingBulk(true);
    let successCount = 0;
    const successfulIds: string[] = [];
    
    for (const id of Array.from(selectedOrderIds)) {
      const res = await actionFn(id);
      if (res.ok) {
        successCount++;
        successfulIds.push(id);
      }
    }
    
    setIsProcessingBulk(false);
    showToast(`Đã ${actionName} ${successCount}/${selectedOrderIds.size} đơn hàng.`, successCount > 0 ? "success" : "danger");

    if ((actionName === "giao hàng" || actionName === "in đơn") && successCount > 0) {
      window.open(`/seller/print-orders?ids=${successfulIds.join(',')}`, '_blank');
    }

    setSelectedOrderIds(new Set()); // clear selection
  };

  const renderOrderAction = (order: Order) => {
    const showConfirm = canSellerConfirm(order);
    const showShip = canSellerShip(order);
    const showCancel = canSellerCancel(order);
    const showReprint = order.orderStatus === "SHIPPING";
    const canReprint = (order.printCount || 0) < 2;

    if (!showConfirm && !showShip && !showCancel && !showReprint) return <span className="text-muted text-xs">Không có hành động</span>;

    return (
      <div className="flex flex-nowrap items-center gap-2">
        {showConfirm ? <Button onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })} className="h-8 px-3 text-xs">Xác nhận</Button> : null}
        {showShip ? <Button variant="secondary" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) { showToast("Đã chuyển shipping.", "success"); window.open(`/seller/print-orders?ids=${order.id}`, '_blank'); } else { showToast(res.message || "Lỗi chuyển shipping", "danger"); } })} className="h-8 px-3 text-xs">Giao hàng</Button> : null}
        {showCancel ? <Button variant="danger" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })} className="h-8 px-3 text-xs">Từ chối</Button> : null}
        {showReprint ? <Button variant="secondary" disabled={!canReprint} onClick={() => store.incrementPrintCount(order.id).then((res) => { if (res.ok) { window.open(`/seller/print-orders?ids=${order.id}`, '_blank'); } else { showToast(res.message || "Lỗi in lại", "danger"); } })} title={!canReprint ? "Đã hết lượt in lại" : ""} className="h-8 px-3 text-xs"><Printer className="h-3 w-3 mr-1" /> In lại ({Math.max(0, 2 - (order.printCount || 0))})</Button> : null}
      </div>
    );
  };

  return (
    <Section
      title="Đơn hàng shop"
      className="space-y-4 pb-0"
    >
      <div className="flex flex-col gap-4">
        {/* Active Filters Summary */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-panel border border-line shadow-sm">
          <div className="text-sm font-semibold text-slate-700 whitespace-nowrap">Bộ lọc:</div>
          <Select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)} className="w-40 sm:w-48 text-sm h-9">
            <option value="">Trạng thái đơn: Tất cả</option>
            {Object.entries(orderStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
          <Select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="w-40 sm:w-48 text-sm h-9">
            <option value="">Thanh toán: Tất cả</option>
            {Object.entries(paymentStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
          <Select value={noteFilter} onChange={(e) => setNoteFilter(e.target.value)} className="w-40 sm:w-40 text-sm h-9">
            <option value="all">Ghi chú: Tất cả</option>
            <option value="yes">Có ghi chú</option>
            <option value="no">Không có ghi chú</option>
          </Select>
        </div>

        {/* Bulk Actions Panel */}
        {selectedOrderIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-50 p-3 rounded-panel border border-emerald-200">
            <div className="text-sm font-semibold text-emerald-800">
              Đã chọn {selectedOrderIds.size} đơn hàng
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                disabled={isProcessingBulk} 
                onClick={() => processBulkAction(store.confirmSellerOrder, canSellerConfirm, "xác nhận")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm flex items-center gap-1.5"
              >
                {isProcessingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Xác nhận
              </Button>
              <Button 
                variant="secondary"
                disabled={isProcessingBulk} 
                onClick={() => processBulkAction(store.shippingSellerOrder, canSellerShip, "giao hàng")}
                className="h-9 text-sm flex items-center gap-1.5"
              >
                {isProcessingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Giao hàng
              </Button>
              <Button 
                variant="danger"
                disabled={isProcessingBulk} 
                onClick={() => processBulkAction(store.cancelSellerOrder, canSellerCancel, "từ chối")}
                className="h-9 text-sm flex items-center gap-1.5"
              >
                {isProcessingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Từ chối
              </Button>
              <div className="w-px h-6 bg-emerald-200 mx-1 hidden sm:block"></div>
              <Button 
                variant="secondary"
                disabled={isProcessingBulk} 
                onClick={() => processBulkAction(store.incrementPrintCount, (o) => o.orderStatus === "SHIPPING" && (o.printCount || 0) < 2, "in đơn")}
                className="h-9 text-sm flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                In đơn
              </Button>
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={[
          <input 
            key="selectAll" 
            type="checkbox" 
            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
            checked={orders.length > 0 && selectedOrderIds.size === orders.length}
            onChange={toggleAll}
            title="Chọn tất cả"
          />,
          "Mã đơn", "Shop", "Trạng thái", "Thanh toán", "Tổng", "Ghi chú", "Hành động"
        ]}
        rows={orders.map((order) => [
          <input 
            key={`select-${order.id}`}
            type="checkbox" 
            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
            checked={selectedOrderIds.has(order.id)}
            onChange={() => toggleSelection(order.id)}
          />,
          <a key="code" className="font-bold text-primary" href={`/seller/orders/${order.orderCode}`}>#{order.orderCode}</a>,
          store.state.shops.find((s) => s.id === order.sellerId)?.shopName ?? "-",
          <StatusBadge key="st" status={order.orderStatus} label={order.sellerConfirmed && order.orderStatus === "PLACED" ? "Đã xác nhận (chờ TT)" : orderStatusLabel[order.orderStatus]} />,
          <StatusBadge key="pay" status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />,
          <span key="total" className="font-semibold">{formatVnd(order.totalAmount)}</span>,
          <div key="note" className="max-w-[150px] truncate text-xs text-slate-500" title={order.customerNote || ""}>
            {order.customerNote ? "Có ghi chú" : "-"}
          </div>,
          renderOrderAction(order)
        ])}
      />
    </Section>
  );
}
