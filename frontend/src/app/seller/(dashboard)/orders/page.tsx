"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/containers";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { StatusBadge } from "@/components/ui/badge";
import {
  canSellerCancel,
  canSellerConfirm,
  canSellerShip,
  canSellerDeliver,
  canSellerApproveReturn,
  canSellerRejectReturn,
  canSellerConfirmReturn,
  formatVnd,
  formatDate,
  orderStatusLabel,
  paymentStatusLabel,
  returnStatusLabel,
} from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { Order, OrderStatus } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";
import { 
  Check, 
  X, 
  Truck, 
  Loader2, 
  Printer, 
  PackageCheck, 
  RotateCcw, 
  Copy, 
  AlertCircle, 
  Headset, 
  CheckCircle2, 
  ExternalLink 
} from "lucide-react";

export default function SellerOrdersPage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;
  
  // Filters
  const [orderStatusFilter, setOrderStatusFilter] = useState(() => typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('seller_orders_orderStatus') || "" : "");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(() => typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('seller_orders_paymentStatus') || "" : "");
  const [noteFilter, setNoteFilter] = useState(() => typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('seller_orders_note') || "all" : "all");
  const [productFilters, setProductFilters] = useState<string[]>(() => {
    if (typeof sessionStorage !== 'undefined') {
      try {
        return JSON.parse(sessionStorage.getItem('seller_orders_productFilters') || "[]");
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [shippingProviderFilter, setShippingProviderFilter] = useState(() => typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('seller_orders_shippingProvider') || "" : "");

  // Selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Return Request & Action States
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, "success");
  };

  const handleApproveReturn = async (orderId: string, orderCode: string) => {
    const res = await store.approveSellerReturn(orderId);
    if (res.ok) {
      showToast(`Đã đồng ý nhận lại hàng cho đơn #${orderCode}. ĐVVC sàn sẽ tới thu gom.`, "success");
    } else {
      showToast(res.message || "Lỗi khi đồng ý trả hàng.", "danger");
    }
  };

  const handleConfirmReceivedReturn = async (orderId: string, orderCode: string) => {
    const res = await store.confirmReceivedReturn(orderId);
    if (res.ok) {
      showToast(`Đã xác nhận nhận lại hàng hoàn cho đơn #${orderCode}. Tiền đã hoàn về ví khách.`, "success");
    } else {
      showToast(res.message || "Lỗi khi xác nhận nhận hàng hoàn.", "danger");
    }
  };

  const handleOpenRejectModal = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    setRejectingOrder(order);
    setRejectReason("");
  };

  const handleSubmitReject = async () => {
    if (!rejectingOrder) return;
    if (!rejectReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối hoàn hàng.", "danger");
      return;
    }
    setIsRejecting(true);
    const res = await store.rejectSellerReturn(rejectingOrder.id, rejectReason.trim());
    setIsRejecting(false);
    if (res.ok) {
      showToast(`Đã từ chối yêu cầu trả hàng cho đơn #${rejectingOrder.orderCode}.`, "success");
      setRejectingOrder(null);
      setRejectReason("");
    } else {
      showToast(res.message || "Lỗi khi từ chối trả hàng.", "danger");
    }
  };

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('seller_orders_orderStatus', orderStatusFilter);
      sessionStorage.setItem('seller_orders_paymentStatus', paymentStatusFilter);
      sessionStorage.setItem('seller_orders_note', noteFilter);
      sessionStorage.setItem('seller_orders_productFilters', JSON.stringify(productFilters));
      sessionStorage.setItem('seller_orders_shippingProvider', shippingProviderFilter);
    }
  }, [orderStatusFilter, paymentStatusFilter, noteFilter, productFilters, shippingProviderFilter]);

  const toggleExpand = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    setExpandedIds(next);
  };

  useEffect(() => {
    if (shop) {
      const apiStatus = (orderStatusFilter.startsWith("RETURN_") ? "" : orderStatusFilter) as OrderStatus | "";
      store.fetchSellerOrders(apiStatus);
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

  const allShopOrders = store.state.orders.filter((order) => order.sellerId === shop.id);

  const statusCounts = {
    ALL: allShopOrders.length,
    PLACED: allShopOrders.filter(o => o.orderStatus === "PLACED").length,
    READY_TO_SHIP: allShopOrders.filter(o => o.orderStatus === "READY_TO_SHIP").length,
    SHIPPING: allShopOrders.filter(o => o.orderStatus === "SHIPPING").length,
    DELIVERED: allShopOrders.filter(o => o.orderStatus === "DELIVERED").length,
    COMPLETED: allShopOrders.filter(o => o.orderStatus === "COMPLETED").length,
    RETURN_REQUESTED: allShopOrders.filter(o => o.returnRequest?.returnStatus === "REQUESTED").length,
    RETURN_RETURNING: allShopOrders.filter(o => o.returnRequest?.returnStatus === "SELLER_APPROVED" || o.returnRequest?.returnStatus === "RETURNING").length,
    RETURNED: allShopOrders.filter(o => o.orderStatus === "RETURNED").length,
    CANCELLED: allShopOrders.filter(o => o.orderStatus === "CANCELLED").length,
  };

  const paymentCounts = {
    ALL: allShopOrders.length,
    PENDING: allShopOrders.filter(o => o.paymentStatus === "PENDING").length,
    PAID: allShopOrders.filter(o => o.paymentStatus === "PAID").length,
    REFUNDED: allShopOrders.filter(o => o.paymentStatus === "REFUNDED").length,
    FAILED: allShopOrders.filter(o => o.paymentStatus === "FAILED").length,
    CANCELLED: allShopOrders.filter(o => o.paymentStatus === "CANCELLED").length,
  };

  const orders = allShopOrders.filter((order) => {
    if (orderStatusFilter === "RETURN_REQUESTED") {
      if (order.returnRequest?.returnStatus !== "REQUESTED") return false;
    } else if (orderStatusFilter === "RETURN_RETURNING") {
      if (!(order.returnRequest?.returnStatus === "SELLER_APPROVED" || order.returnRequest?.returnStatus === "RETURNING")) return false;
    } else if (orderStatusFilter) {
      if (order.orderStatus !== orderStatusFilter) return false;
    }

    if (paymentStatusFilter && order.paymentStatus !== paymentStatusFilter) return false;
    if (noteFilter === "yes" && !order.customerNote) return false;
    if (noteFilter === "no" && order.customerNote) return false;
    if (shippingProviderFilter && order.shipment?.shippingProviderName !== shippingProviderFilter) return false;
    if (productFilters.length > 0) {
      const match = order.items?.some(item => item.productId && productFilters.includes(item.productId));
      if (!match) return false;
    }
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
    if (selectedOrderIds.size === 0) {
      showToast("Bạn chưa chọn đơn hàng nào để thực hiện thao tác.", "danger");
      return;
    }

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



  const availableProducts = Array.from(new Map(
    store.state.orders
      .filter(o => o.sellerId === shop?.id)
      .flatMap(o => o.items || [])
      .filter(item => item.productId && item.productNameSnapshot)
      .map(item => [item.productId!, item.productNameSnapshot!])
  )).map(([value, label]) => ({ value, label }));

  const availableShippingProviders = Array.from(new Set(
    store.state.orders
      .filter(o => o.sellerId === shop?.id && o.shipment?.shippingProviderName)
      .map(o => o.shipment!.shippingProviderName)
  ));

  // Restore scroll position after orders render
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined' && scrollRef.current && orders.length > 0) {
      const savedScroll = sessionStorage.getItem('seller_orders_scroll');
      if (savedScroll) {
        scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      }
    }
  }, [orders.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('seller_orders_scroll', e.currentTarget.scrollTop.toString());
    }
  };

  return (
    <Section
      title="Đơn hàng shop"
      className="space-y-4 pb-0"
    >
      <div className="flex flex-col gap-3">
        {/* Filters Summary (Single row) */}
        <div className="flex flex-nowrap items-center gap-2.5 bg-white p-3 rounded-panel border border-line shadow-sm overflow-x-auto scrollbar-none">
          <div className="text-sm font-bold text-slate-800 whitespace-nowrap shrink-0">Bộ lọc:</div>
          <Select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)} className="w-52 sm:w-56 shrink-0 text-xs sm:text-sm h-9 font-medium">
            <option value="">Trạng thái: Tất cả ({statusCounts.ALL})</option>
            <option value="PLACED">Chờ xác nhận ({statusCounts.PLACED})</option>
            <option value="READY_TO_SHIP">Chờ lấy hàng ({statusCounts.READY_TO_SHIP})</option>
            <option value="SHIPPING">Đang giao ({statusCounts.SHIPPING})</option>
            <option value="DELIVERED">Đã giao hàng ({statusCounts.DELIVERED})</option>
            <option value="COMPLETED">Hoàn thành ({statusCounts.COMPLETED})</option>
            <option value="RETURN_REQUESTED">Yêu cầu hoàn tiền ({statusCounts.RETURN_REQUESTED})</option>
            <option value="RETURN_RETURNING">Chờ nhận hàng hoàn ({statusCounts.RETURN_RETURNING})</option>
            <option value="RETURNED">Đã trả hàng/hoàn tiền ({statusCounts.RETURNED})</option>
            <option value="CANCELLED">Đã hủy ({statusCounts.CANCELLED})</option>
          </Select>
          <Select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="w-40 sm:w-44 shrink-0 text-xs sm:text-sm h-9 font-medium">
            <option value="">Thanh toán: Tất cả ({paymentCounts.ALL})</option>
            {Object.entries(paymentStatusLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {label} ({paymentCounts[key as keyof typeof paymentCounts] ?? 0})
              </option>
            ))}
          </Select>
          <Select value={noteFilter} onChange={(e) => setNoteFilter(e.target.value)} className="w-32 sm:w-36 shrink-0 text-xs sm:text-sm h-9">
            <option value="all">Ghi chú: Tất cả</option>
            <option value="yes">Có ghi chú</option>
            <option value="no">Không có ghi chú</option>
          </Select>
          <Select value={shippingProviderFilter} onChange={(e) => setShippingProviderFilter(e.target.value)} className="w-36 sm:w-40 shrink-0 text-xs sm:text-sm h-9">
            <option value="">Đơn vị VC: Tất cả</option>
            {availableShippingProviders.map(provider => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </Select>
          <div className="w-40 sm:w-48 shrink-0">
            <MultiSelect 
              options={availableProducts}
              value={productFilters}
              onChange={setProductFilters}
              placeholder="Sản phẩm: Tất cả"
              popupClassName="right-0 w-[150%] min-w-[320px] max-w-[90vw]"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-panel border border-line">
            Không có đơn hàng nào
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 px-3 py-3 bg-slate-50 border border-line rounded-lg">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                  checked={orders.length > 0 && selectedOrderIds.size === orders.length}
                  onChange={toggleAll}
                  title="Chọn tất cả"
                />
                <span className="text-sm font-semibold text-slate-700">
                  Chọn tất cả ({selectedOrderIds.size > 0 ? `${selectedOrderIds.size}/${orders.length}` : orders.length})
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  disabled={isProcessingBulk} 
                  onClick={() => processBulkAction(store.confirmSellerOrder, canSellerConfirm, "xác nhận")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs flex items-center gap-1.5 px-3"
                >
                  {isProcessingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Xác nhận
                </Button>
                <Button 
                  variant="danger"
                  disabled={isProcessingBulk} 
                  onClick={() => processBulkAction(store.cancelSellerOrder, canSellerCancel, "từ chối")}
                  className="h-8 text-xs flex items-center gap-1.5 px-3"
                >
                  {isProcessingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  Từ chối
                </Button>
                <Button 
                  variant="secondary"
                  disabled={isProcessingBulk} 
                  onClick={() => processBulkAction(store.shippingSellerOrder, canSellerShip, "giao hàng")}
                  className="h-8 text-xs flex items-center gap-1.5 px-3"
                >
                  {isProcessingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                  Giao hàng
                </Button>
                <Button 
                  className="bg-emerald-700 hover:bg-emerald-800 text-white h-8 text-xs flex items-center gap-1.5 px-3"
                  disabled={isProcessingBulk} 
                  onClick={() => processBulkAction(store.markOrderDelivered, canSellerDeliver, "đánh dấu đã giao")}
                >
                  {isProcessingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : <PackageCheck className="h-3 w-3" />}
                  Đã giao hàng
                </Button>
                <div className="w-px h-5 bg-line mx-1 hidden sm:block"></div>
                <Button 
                  variant="secondary"
                  disabled={isProcessingBulk} 
                  onClick={() => processBulkAction(store.incrementPrintCount, (o) => o.orderStatus === "SHIPPING" && (o.printCount || 0) < 2, "in đơn")}
                  className="h-8 text-xs flex items-center gap-1.5 px-3"
                >
                  <Printer className="h-3 w-3" />
                  In đơn
                </Button>
              </div>
            </div>
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
            >
              {orders.map((order) => {
                const firstItem = order.items?.[0];
                const hasMore = (order.items?.length || 0) > 1;
                const isSelected = selectedOrderIds.has(order.id);
                const isExpanded = expandedIds.has(order.id);

                return (
                  <div 
                    key={order.id} 
                    className={cn(
                      "bg-white rounded-xl border p-4 transition-colors cursor-pointer block",
                      isSelected ? "border-emerald-500 shadow-sm bg-emerald-50/10" : "border-line hover:border-slate-300"
                    )}
                    onClick={() => toggleSelection(order.id)}
                  >
                    <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-4 border-b border-line pb-3 mb-3">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelection(order.id);
                          }}
                        />
                        <div>
                          <div className="text-sm font-bold text-ink">
                            Mã đơn: <a className="text-primary hover:underline ml-1" href={`/seller/orders/${order.orderCode}`} onClick={e => e.stopPropagation()}>#{order.orderCode}</a>
                          </div>
                          <div className="text-xs text-muted mt-1 flex flex-wrap gap-3">
                            <span>🕒 {formatDate(order.createdAt)}</span>
                            {order.shipment?.shippingProviderName && (
                              <span>🚚 {order.shipment.shippingProviderName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {order.orderStatus === "SHIPPING" && (
                          <div className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full border border-slate-200 flex items-center" title="Số lần in phiếu giao còn lại">
                            <Printer className="w-3 h-3 mr-1" />
                            Còn {Math.max(0, 2 - (order.printCount || 0))} lượt in
                          </div>
                        )}
                        <StatusBadge status={order.orderStatus} label={order.sellerConfirmed && order.orderStatus === "PLACED" ? "Đã xác nhận (chờ TT)" : orderStatusLabel[order.orderStatus]} />
                        <StatusBadge status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />
                      </div>
                    </div>

                    {firstItem && (
                      <div className="flex items-start gap-4">
                        <img src={firstItem.productImageSnapshot || "/images/placeholder.webp"} alt={firstItem.productNameSnapshot} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-line" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-ink line-clamp-2 text-sm">{firstItem.productNameSnapshot}</h4>
                          <p className="text-xs text-muted mt-1">{firstItem.variantNameSnapshot}</p>
                          <div className="text-xs font-medium mt-1">x{firstItem.quantity}</div>
                          {hasMore && !isExpanded && (
                            <button onClick={(e) => toggleExpand(order.id, e)} className="text-xs text-emerald-600 font-medium hover:underline mt-2 text-left">
                              + Xem thêm {order.items.length - 1} sản phẩm khác
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col items-end whitespace-nowrap pl-2">
                          <span className="text-xs text-slate-500 mb-1">Tổng đơn</span>
                          <span className="font-bold text-ink text-sm sm:text-base">
                            {formatVnd(order.totalAmount)}
                          </span>
                        </div>
                      </div>
                    )}

                    {hasMore && isExpanded && (
                      <div className="space-y-4 border-t border-line/50 pt-4 mt-4" onClick={(e) => e.stopPropagation()}>
                        {order.items.slice(1).map((item, idx) => (
                          <div key={idx} className="flex items-start gap-4 ml-4 sm:ml-8">
                            <img src={item.productImageSnapshot || "/images/placeholder.webp"} alt={item.productNameSnapshot} className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg border border-line opacity-90" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-ink line-clamp-2 text-sm">{item.productNameSnapshot}</h4>
                              <p className="text-xs text-muted mt-0.5">{item.variantNameSnapshot}</p>
                              <div className="text-xs font-medium mt-0.5">x{item.quantity}</div>
                            </div>
                            <div className="flex flex-col items-end whitespace-nowrap pl-2">
                              {item.originalPriceSnapshot && item.originalPriceSnapshot > item.unitPrice && (
                                <span className="text-xs text-muted line-through mb-0.5">
                                  {formatVnd(item.originalPriceSnapshot)}
                                </span>
                              )}
                              <span className="font-semibold text-ink text-sm">
                                {formatVnd(item.unitPrice)}
                              </span>
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={(e) => toggleExpand(order.id, e)}
                          className="w-full text-center text-sm font-medium text-muted hover:text-primary transition-colors py-2"
                        >
                          Thu gọn
                        </button>
                      </div>
                    )}

                    {order.customerNote && (
                      <div className="mt-3 bg-amber-50/50 p-2 rounded-lg border border-amber-100 text-xs text-amber-800 line-clamp-2">
                        <span className="font-semibold mr-1">Ghi chú:</span>
                        {order.customerNote}
                      </div>
                    )}

                    {/* RETURN REQUEST SECTION */}
                    {order.returnRequest && (
                      <div 
                        className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-ink space-y-2.5 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 pb-2">
                          <div className="flex items-center gap-2">
                            <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
                            <span className="font-bold text-amber-950">Yêu cầu Trả hàng / Hoàn tiền</span>
                            <span className="font-mono text-[11px] text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200">
                              #{order.returnRequest.returnCode}
                            </span>
                          </div>
                          <StatusBadge
                            status={order.returnRequest.returnStatus}
                            label={returnStatusLabel[order.returnRequest.returnStatus] || order.returnRequest.returnStatus}
                          />
                        </div>

                        <div className="grid gap-1">
                          <div className="flex items-start gap-1">
                            <span className="font-semibold text-slate-700 shrink-0">Lý do:</span>
                            <span className="text-slate-900 font-medium">{order.returnRequest.reason}</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="font-semibold text-slate-700 shrink-0">Mô tả:</span>
                            <span className="text-slate-800">{order.returnRequest.description}</span>
                          </div>
                        </div>

                        {/* Evidence Images */}
                        {order.returnRequest.evidenceImages && order.returnRequest.evidenceImages.length > 0 && (
                          <div className="pt-1">
                            <span className="font-semibold text-slate-700 mb-1.5 block">Ảnh minh chứng từ người mua:</span>
                            <div className="flex flex-wrap gap-2">
                              {order.returnRequest.evidenceImages.map((img, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setPreviewImage(img)}
                                  className="group relative h-14 w-14 rounded-lg overflow-hidden border border-line hover:border-emerald-500 transition shadow-sm cursor-pointer"
                                >
                                  <img src={img} alt={`Minh chứng ${idx + 1}`} className="h-full w-full object-cover group-hover:scale-105 transition duration-200" />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                                    <ExternalLink className="h-3 w-3" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 1. REQUESTED */}
                        {order.returnRequest.returnStatus === "REQUESTED" && (
                          <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-amber-800 italic">Khách hàng đang yêu cầu trả hàng. Vui lòng phản hồi sớm.</span>
                            <div className="flex items-center gap-2">
                              <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-7 min-h-0 px-3 flex items-center gap-1 rounded-lg"
                                onClick={() => handleApproveReturn(order.id, order.orderCode)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Đồng ý nhận lại hàng
                              </Button>
                              <Button
                                variant="danger"
                                className="font-medium text-xs h-7 min-h-0 px-3 flex items-center gap-1 rounded-lg"
                                onClick={(e) => handleOpenRejectModal(order, e)}
                              >
                                <X className="h-3.5 w-3.5" />
                                Từ chối
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* 2. SELLER_APPROVED hoặc RETURNING */}
                        {(order.returnRequest.returnStatus === "SELLER_APPROVED" || order.returnRequest.returnStatus === "RETURNING") && (
                          <div className="pt-2 border-t border-emerald-200 bg-emerald-50/70 p-3 rounded-lg space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                                <Truck className="h-4 w-4 text-emerald-600" />
                                Vận đơn thu gom Sàn (Shopee Pick-up)
                              </div>
                              <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-7 min-h-0 px-3 flex items-center gap-1.5 rounded-lg shadow-sm"
                                onClick={() => handleConfirmReceivedReturn(order.id, order.orderCode)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Xác nhận đã nhận lại hàng hoàn
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-700 text-xs">
                              <div>
                                <span className="font-semibold">ĐVVC:</span> {order.returnRequest.returnShippingProvider || "Shopee Xpress Pick-up"}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold">Mã vận đơn:</span>
                                <span className="font-mono font-bold text-emerald-900">{order.returnRequest.returnTrackingCode || "RET-PENDING"}</span>
                                {order.returnRequest.returnTrackingCode && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(order.returnRequest!.returnTrackingCode!, "mã vận đơn hoàn")}
                                    className="p-0.5 text-slate-400 hover:text-emerald-700"
                                    title="Sao chép"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              {order.returnRequest.pickupAddress && (
                                <div className="sm:col-span-2">
                                  <span className="font-semibold">Địa chỉ lấy hàng:</span> {order.returnRequest.pickupAddress}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 3. SELLER_REJECTED */}
                        {order.returnRequest.returnStatus === "SELLER_REJECTED" && (
                          <div className="pt-2 border-t border-rose-200 bg-rose-50/70 p-2.5 rounded-lg text-rose-900 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-rose-800">
                              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                              Shop đã từ chối hoàn hàng
                            </div>
                            <div className="text-xs">
                              <span className="font-semibold">Lý do từ chối:</span> {order.returnRequest.sellerRejectReason || "Shop không đồng ý yêu cầu hoàn hàng."}
                            </div>
                          </div>
                        )}

                        {/* 4. DISPUTED */}
                        {order.returnRequest.returnStatus === "DISPUTED" && (
                          <div className="pt-2 border-t border-amber-300 bg-amber-100/70 p-2.5 rounded-lg text-amber-950 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900">
                              <Headset className="h-3.5 w-3.5 text-amber-700" />
                              Người mua đã khiếu nại lên Sàn. Đang chờ Supporter phân xử.
                            </div>
                            {order.returnRequest.disputeReason && (
                              <div className="text-xs">
                                <span className="font-semibold">Lý do khiếu nại của khách:</span> {order.returnRequest.disputeReason}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 5. SUPPORT_APPROVED / COMPLETED / orderStatus === "RETURNED" */}
                        {(order.returnRequest.returnStatus === "SUPPORT_APPROVED" || order.returnRequest.returnStatus === "COMPLETED" || order.orderStatus === "RETURNED") && (
                          <div className="pt-2 border-t border-emerald-200 bg-emerald-50/60 p-2.5 rounded-lg text-emerald-950 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Đã hoàn tất hoàn trả
                            </div>
                            <p className="text-xs text-emerald-900">
                              Đơn hàng đã được xử lý hoàn tiền ví cho người mua thành công.
                            </p>
                            {order.returnRequest.supporterNote && (
                              <div className="text-xs italic bg-white/70 p-1.5 rounded border border-emerald-200">
                                <strong>Ghi chú Supporter:</strong> {order.returnRequest.supporterNote}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 6. SUPPORT_REJECTED */}
                        {order.returnRequest.returnStatus === "SUPPORT_REJECTED" && (
                          <div className="pt-2 border-t border-slate-200 bg-slate-100 p-2.5 rounded-lg text-slate-800 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <AlertCircle className="h-3.5 w-3.5 text-slate-600" />
                              Sàn đã bác bỏ khiếu nại của khách
                            </div>
                            <p className="text-xs text-slate-600">Đơn hàng giữ nguyên trạng thái hoàn thành.</p>
                            {order.returnRequest.supporterNote && (
                              <div className="text-xs italic bg-white p-1.5 rounded border border-slate-200">
                                <strong>Ghi chú Supporter:</strong> {order.returnRequest.supporterNote}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* REJECT MODAL */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-line space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                <AlertCircle className="h-5 w-5" />
                Từ chối yêu cầu hoàn hàng
              </div>
              <button 
                type="button" 
                onClick={() => setRejectingOrder(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600 mb-2">
                Bạn đang từ chối yêu cầu trả hàng của đơn <strong>#{rejectingOrder.orderCode}</strong>. Người mua có thể khiếu nại lên Sàn nếu không đồng ý.
              </p>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Lý do từ chối <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do cụ thể (vd: Hàng hoá giao đúng mô tả, tem niêm phong đã bị xé rách...)"
                rows={3}
                className="w-full text-sm border border-line rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted font-medium w-full">Gợi ý nhanh:</span>
                {[
                  "Sản phẩm đúng mô tả và nguyên vẹn",
                  "Sản phẩm đã qua sử dụng / rách tem",
                  "Khách hàng không cung cấp video mở kiện hàng"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md border border-slate-200 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                variant="secondary"
                onClick={() => setRejectingOrder(null)}
                disabled={isRejecting}
                className="h-9 text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                onClick={handleSubmitReject}
                disabled={isRejecting || !rejectReason.trim()}
                className="h-9 text-xs flex items-center gap-1.5"
              >
                {isRejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW IMAGE MODAL */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2 bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full z-10 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={previewImage} alt="Ảnh minh chứng" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </Section>
  );
}
