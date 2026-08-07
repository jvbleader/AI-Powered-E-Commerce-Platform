import React, { useEffect, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { apiFetch } from '@/services/api';

type OrderDetail = {
  orderCode: string;
  totalAmount: number;
  status: string;
  items: {
    productName: string;
    quantity: number;
    price: number;
    thumbnailUrl: string;
  }[];
};

export function OrderAttachment({ orderId, isSeller }: { orderId: string, isSeller?: boolean }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    const endpoint = isSeller ? `/seller/orders/${orderId}` : `/orders/${orderId}`;
    apiFetch<any>(endpoint)
      .then(res => {
        if (res) {
          setOrder({
            orderCode: res.order_code || res.id,
            totalAmount: res.total_amount,
            status: res.status,
            items: (res.items || []).map((item: any) => ({
              productName: item.product_name,
              quantity: item.quantity,
              price: item.price,
              thumbnailUrl: item.thumbnail_url || '/placeholder.png'
            }))
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

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

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-2 mb-2 border border-slate-100 shadow-sm flex items-center justify-center gap-2 max-w-[240px] w-full min-h-[60px]">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-sm flex items-center gap-2 max-w-[240px]">
        <div className="w-12 h-12 bg-slate-100 flex-shrink-0 rounded flex items-center justify-center">
          <FileText className="w-6 h-6 text-slate-400" />
        </div>
        <div className="text-slate-800 text-xs">
          <p className="font-bold line-clamp-2">Đơn hàng không tồn tại hoặc không có quyền truy cập</p>
        </div>
      </div>
    );
  }

  const firstItem = order.items?.[0];

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm max-w-[240px] overflow-hidden">
      <div className="bg-blue-50 border-b border-blue-100 px-2 py-1.5 text-blue-600 text-[11px] font-medium uppercase tracking-wider flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
           <FileText className="w-3 h-3" />
           <span>Đơn hàng #{order.orderCode?.slice(0, 8).toUpperCase()}</span>
        </div>
        <span className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded text-blue-700">{getStatusText(order.status)}</span>
      </div>
      <div className="p-2 flex gap-2">
        {firstItem && (
          <img src={firstItem.thumbnailUrl} alt={firstItem.productName} className="w-14 h-14 object-cover rounded bg-slate-100 flex-shrink-0 border border-slate-200" />
        )}
        <div className="text-slate-800 flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <p className="text-[13px] font-medium line-clamp-2 leading-tight">
             {firstItem ? `${firstItem.productName} ${order.items.length > 1 ? `(và ${order.items.length - 1} sp khác)` : ''}` : 'Không có sản phẩm'}
          </p>
          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-slate-500 text-[11px]">Tổng:</span>
            <span className="text-emerald-600 font-bold text-[13px]">{order.totalAmount?.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
