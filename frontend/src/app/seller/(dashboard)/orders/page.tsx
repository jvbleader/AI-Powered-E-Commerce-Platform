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
  formatVnd,
  formatDate,
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
    if (shippingProviderFilter && order.shipment?.shippingProviderName !== shippingProviderFilter) return false;
    if (productFilters.length > 0) {
      const match = order.items?.some(item => productFilters.includes(item.productId));
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
      showToast("Bạn chưa chọn đơn hàng nào để thực hiện thao tác.", "warning");
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
      .map(item => [item.productId, item.productNameSnapshot])
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
          <Select value={shippingProviderFilter} onChange={(e) => setShippingProviderFilter(e.target.value)} className="w-40 sm:w-48 text-sm h-9">
            <option value="">Đơn vị VC: Tất cả</option>
            {availableShippingProviders.map(provider => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </Select>
          <div className="w-40 sm:w-56">
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
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
