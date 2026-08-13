import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Package } from 'lucide-react';
import { apiFetch } from '@/services/api';
import { formatDate } from '@/lib/helpers';

type Order = {
  id: string;
  order_code?: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: {
    product_name: string;
    quantity: number;
    price: number;
    thumbnail_url?: string;
    product_image_snapshot?: string;
  }[];
};

type OrderSelectPopupProps = {
  shopId: number;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (order: Order) => void;
  mode?: 'CUSTOMER' | 'SELLER';
  customerId?: number;
};

export function OrderSelectPopup({ shopId, isOpen, onClose, onSelect, mode = 'CUSTOMER', customerId }: OrderSelectPopupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('#order-popup-trigger')) return;
      if (popupRef.current && !popupRef.current.contains(target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !shopId) return;
    setLoading(true);
    const fetchOrders = async () => {
      try {
        if (mode === 'SELLER') {
          const res = await apiFetch<any>(`/seller/orders?customer_id=${customerId}`);
          const allOrders = res.items || (Array.isArray(res) ? res : []);
          const mapped = allOrders.map((o: any) => ({ ...o, id: o.order_code || o.id || "" }));
          setOrders(mapped);
        } else {
          // Since the backend /orders endpoint currently returns all orders for the user and doesn't take shop_id query param,
          // we'll fetch all and filter them locally.
          const res = await apiFetch<any>(`/orders`);
          const allOrders = res.items || (Array.isArray(res) ? res : []);
          // Assuming order has seller.id or shop_id, if not we just show all
          const filtered = allOrders
            .filter((o: any) => o.seller?.id === shopId || !o.seller)
            .map((o: any) => ({ ...o, id: o.order_code || o.id || "" }));
          setOrders(filtered);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    const timeoutId = setTimeout(() => {
      fetchOrders();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [shopId, isOpen, searchTerm]);

  if (!isOpen) return null;

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'PENDING': 'Chờ xác nhận',
      'PLACED': 'Đã đặt hàng',
      'PROCESSING': 'Đang xử lý',
      'READY_TO_SHIP': 'Sẵn sàng giao',
      'SHIPPING': 'Đang giao',
      'DELIVERED': 'Đã giao',
      'COMPLETED': 'Hoàn thành',
      'DELIVERY_FAILED': 'Giao thất bại',
      'CANCELLED': 'Đã hủy',
      'RETURNED': 'Trả hàng',
    };
    return statusMap[status] || status;
  };

  return (
    <div ref={popupRef} className="absolute bottom-[72px] left-4 w-[360px] h-[340px] z-[60] bg-white flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="px-3 py-2 border-b border-line relative bg-slate-50">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Tìm theo mã đơn hàng..." 
          className="w-full pl-8 pr-3 py-1.5 bg-white border border-line rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center text-slate-500 py-8 text-sm">Không tìm thấy đơn hàng nào của shop này</div>
        ) : (
          <div className="space-y-2">
            {orders.map(order => {
              const orderDate = order.created_at ? formatDate(order.created_at) : '';
              const orderCode = order.order_code ? order.order_code.toUpperCase() : (order.id || "").slice(0, 8).toUpperCase();
              
              // Helper to get status color and icon
              const getStatusDisplay = (status: string) => {
                const isCompleted = status === 'COMPLETED' || status === 'DELIVERED';
                const isCancelled = status === 'CANCELLED' || status === 'RETURNED' || status === 'DELIVERY_FAILED';
                
                const labels: Record<string, string> = {
                  PLACED: 'Chờ xác nhận',
                  READY_TO_SHIP: 'Chờ lấy hàng',
                  SHIPPING: 'Đang giao',
                  COMPLETED: 'Hoàn thành',
                  DELIVERED: 'Đã giao',
                  CANCELLED: 'Đã hủy',
                  DELIVERY_FAILED: 'Giao thất bại',
                  RETURNED: 'Trả hàng'
                };
                
                return {
                  text: labels[status] || status,
                  colorClass: isCompleted ? "text-green-700 bg-green-100" : isCancelled ? "text-red-700 bg-red-100" : "text-orange-700 bg-orange-100",
                };
              };
              
              const statusDisplay = getStatusDisplay((order as any).order_status || order.status || '');
              const totalItems = order.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;

              return (
                <div key={order.id} className="flex flex-col p-3 hover:bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors group bg-white shadow-sm mb-3">
                  {/* Header: Order Code & Status */}
                  <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2 mb-2">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Package className="w-4 h-4" />
                      <span className="font-semibold text-sm">#{orderCode}</span>
                    </div>
                    <div className="flex items-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${statusDisplay.colorClass}`}>
                        {statusDisplay.text}
                      </span>
                    </div>
                  </div>

                  {/* Body: Product Items */}
                  <div className="flex flex-col gap-3">
                    {order.items?.map((item, idx) => {
                      const image = item.thumbnail_url || item.product_image_snapshot || '/placeholder.png';
                      // Try to use product_id for the product link if slug is missing
                      const productHref = (item as any).product_slug ? `/products/${(item as any).product_slug}` : `/products/${(item as any).product_id || ''}`;
                      const productName = (item as any).product_name_snapshot || item.product_name || '';
                      const variantName = (item as any).variant_name_snapshot || (item as any).variant_name || '';
                      const price = (item as any).unit_price || item.price || 0;
                      
                      return (
                        <div key={idx} className="flex gap-3">
                          <a href={productHref} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <img src={image} alt={productName} className="w-16 h-16 object-cover rounded border border-slate-100 bg-slate-50" />
                          </a>
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex justify-between items-start gap-2">
                              <a href={productHref} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-800 font-medium line-clamp-2 hover:text-emerald-600 transition-colors">
                                {productName}
                              </a>
                              <span className="text-sm font-medium whitespace-nowrap">{Number(price).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between items-center mt-auto">
                              <span className="text-xs text-slate-500 line-clamp-1 mr-2">{variantName}</span>
                              <span className="text-xs text-slate-500 whitespace-nowrap">x {item.quantity}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer: Total & Actions */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-sm text-slate-500">Tổng Cộng</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">{totalItems} sản phẩm | </span>
                      <span className="text-base font-bold text-red-500">{Number(order.total_amount || 0).toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons always visible */}
                  <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                    <a 
                      href={mode === 'SELLER' ? `/seller/orders/${orderCode}` : `/account/orders/${orderCode}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Chi Tiết
                    </a>
                    <button 
                      onClick={() => {
                        onSelect(order);
                        onClose();
                      }}
                      className="px-4 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      Gửi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
