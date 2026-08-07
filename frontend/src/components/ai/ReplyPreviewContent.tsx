import React, { useEffect, useState } from 'react';
import { fetchProductDetail } from '@/services/product-api';

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
    if (type === 'PRODUCT' && id) {
      fetchProductDetail('shop', id).then(res => {
        if (res.ok && res.product) {
          setText(`[Sản phẩm] ${res.product.name}`);
        }
      }).catch(() => {
        // Ignore error
      });
    } else {
      setText(fallback || '[Đính kèm]');
    }
  }, [type, id, fallback]);

  return <>{text}</>;
}
