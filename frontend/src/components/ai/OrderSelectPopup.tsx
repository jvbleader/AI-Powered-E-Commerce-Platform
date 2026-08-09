import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Package } from 'lucide-react';
import { apiFetch } from '@/services/api';

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
};

export function OrderSelectPopup({ shopId, isOpen, onClose, onSelect }: OrderSelectPopupProps) {
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
        // Since the backend /orders endpoint currently returns all orders for the user and doesn't take shop_id query param,
        // we'll fetch all and filter them locally.
        const res = await apiFetch<any>(`/orders`);
        const allOrders = res.items || (Array.isArray(res) ? res : []);
        // Assuming order has seller.id or shop_id, if not we just show all
        const filtered = allOrders
          .filter((o: any) => o.seller?.id === shopId || !o.seller)
          .map((o: any) => ({ ...o, id: o.order_code || o.id || "" }));
        setOrders(filtered);
        // We've already called setOrders(filtered) above.
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
      'PROCESSING': 'Đang xử lý',
      'SHIPPING': 'Đang giao',
      'DELIVERED': 'Đã giao',
      'CANCELLED': 'Đã hủy',
      'RETURNED': 'Trả hàng',
    };
    return statusMap[status] || status;
  };

  return (
    <div ref={popupRef} className="absolute bottom-[72px] left-4 w-[320px] h-[380px] z-[60] bg-white flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="flex items-center justify-between p-3 border-b border-line">
        <h3 className="font-heading font-medium text-slate-900">Chọn đơn hàng</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-3 border-b border-line relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Tìm theo mã đơn hàng..." 
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-line rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
              return (
                <div key={order.id} className="flex gap-3 p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-colors group">
                  <img src={order.items?.[0]?.thumbnail_url || order.items?.[0]?.product_image_snapshot || '/placeholder.png'} alt="Order" className="w-16 h-16 object-cover rounded border border-line" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">Đơn hàng #{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm text-emerald-600 font-medium mt-1">{order.total_amount?.toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div className="flex items-center">
                    <button 
                      onClick={() => {
                        onSelect({ ...order, id: order.order_code || order.id });
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-white border border-emerald-500 text-emerald-600 rounded-md text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-50"
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
