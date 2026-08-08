import React, { useEffect, useState } from 'react';
import { fetchProductByPublicId } from '@/services/product-api';
import { apiFetch } from '@/services/api';

export function ReplyPreviewContent({ 
  type, 
  id, 
  fallback 
}: { 
  type?: string | null; 
  id?: string | null; 
  fallback?: string | null;
}) {
  const [text, setText] = useState(fallback || '[Đính kèm]');

  useEffect(() => {
    if (type === 'PRODUCT' && id && id !== 'undefined') {
      fetchProductByPublicId(id).then(res => {
        if (res.ok && res.product) {
          setText(`[Sản phẩm] ${res.product.name}`);
        }
      }).catch(() => {
        // Ignore error
      });
    } else if (type === 'ORDER' && id && id !== 'undefined') {
      apiFetch<any>(`/orders/${id}`)
        .then(res => {
          if (res) {
            const code = (res.order_code || id).slice(0, 8).toUpperCase();
            setText(`[Đơn hàng] #${code}`);
          }
        })
        .catch(() => {
          // Ignore error
        });
    } else if (type === 'IMAGE') {
      setText('[Hình ảnh]');
    } else if (type === 'VIDEO') {
      setText('[Video]');
    } else {
      setText(fallback || '[Đính kèm]');
    }
  }, [type, id, fallback]);

  return <>{text}</>;
}
