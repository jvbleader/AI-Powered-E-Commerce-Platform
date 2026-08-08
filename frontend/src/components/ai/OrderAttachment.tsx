import React, { useEffect, useState } from 'react';
import { Loader2, FileText, Package, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

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
            status: res.order_status || res.status,
            items: (res.items || []).map((item: any) => ({
              productName: item.product_name_snapshot || item.product_name || 'Sản phẩm',
              quantity: item.quantity,
              price: item.unit_price ?? item.price,
              thumbnailUrl: item.product_image_snapshot || item.thumbnail_url || '',
            }))
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId, isSeller]);

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

  const handleClick = () => {
    if (!order) return;
    const path = isSeller
      ? `/seller/orders/${order.orderCode}`
      : `/account/orders/${order.orderCode}`;
    router.push(path);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-2 mb-2 border border-slate-100 shadow-sm flex items-center justify-center gap-2 max-w-[300px] w-full min-h-[60px]">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-sm flex items-center gap-2 max-w-[300px]">
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
  const extraItems = order.items.slice(1);
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className="bg-white rounded-lg border border-slate-200 shadow-sm w-[300px] cursor-pointer hover:bg-slate-50 transition-colors overflow-hidden"
      onClick={handleClick}
    >
      <div className="bg-blue-50 border-b border-blue-100 px-2.5 py-1.5 text-blue-600 text-[11px] font-medium uppercase tracking-wider flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
           <FileText className="w-3 h-3 shrink-0" />
           <span className="whitespace-nowrap truncate">Đơn hàng #{order.orderCode?.slice(0, 8).toUpperCase()}</span>
        </div>
        <span className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded text-blue-700 shrink-0">{getStatusText(order.status)}</span>
      </div>
      <div className="p-2 flex gap-2">
        {firstItem && (
          <div className="relative shrink-0">
            {firstItem.thumbnailUrl ? (
              <img
                src={firstItem.thumbnailUrl}
                alt={firstItem.productName}
                className="w-14 h-14 object-cover rounded bg-slate-100 border border-slate-200"
              />
            ) : (
              <div className="w-14 h-14 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
            )}
            {extraItems.length > 0 && (
              <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                +{extraItems.length}
              </span>
            )}
          </div>
        )}
        <div className="text-slate-800 flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <p className="text-[13px] font-medium line-clamp-2 leading-tight">
             {firstItem ? firstItem.productName : 'Không có sản phẩm'}
          </p>
          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-slate-500 text-[11px]">Tổng:</span>
            <span className="text-emerald-600 font-bold text-[13px]">{Number(order.totalAmount).toLocaleString('vi-VN')}đ</span>
          </div>
        </div>
      </div>
      {extraItems.length > 0 && (
        <div className="px-2 pb-2">
          <div className="flex items-center gap-2 rounded-md bg-blue-50/80 border border-blue-100 px-2 py-1.5">
            <div className="flex -space-x-1.5 shrink-0">
              {extraItems.slice(0, 3).map((item, idx) => (
                item.thumbnailUrl ? (
                  <img
                    key={idx}
                    src={item.thumbnailUrl}
                    alt={item.productName}
                    className="w-6 h-6 rounded-full object-cover border-2 border-white bg-slate-100"
                  />
                ) : (
                  <div key={idx} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                    <Package className="w-3 h-3 text-slate-400" />
                  </div>
                )
              ))}
            </div>
            <div className="flex items-center gap-1 min-w-0 text-[11px] text-blue-700">
              <Layers className="w-3 h-3 shrink-0" />
              <span className="truncate">
                Gồm {order.items.length} loại · {totalQuantity} sản phẩm
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
