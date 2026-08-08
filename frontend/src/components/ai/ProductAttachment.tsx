import React, { useEffect, useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { fetchProductByPublicId } from '@/services/product-api';
import { Product } from '@/types/models';
import { useRouter } from 'next/navigation';

export function ProductAttachment({ 
  publicId,
  onClickProduct
}: { 
  publicId: string,
  isSeller?: boolean,
  onClickProduct?: (product: Product) => void
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [shopSlug, setShopSlug] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!publicId || publicId === "undefined" || publicId === "null") {
       setLoading(false);
       setProduct(null);
       return;
    }
    
    let cancelled = false;
    setLoading(true);

    fetchProductByPublicId(publicId).then(res => {
      if (cancelled) return;
      if (res.ok && res.product) {
        setProduct(res.product);
        setShopSlug(res.shop?.shopSlug ?? null);
        if (res.variants && res.variants.length > 0) {
          const variant = res.variants[0];
          setPrice(variant.salePrice || variant.price);
          if (variant.salePrice && variant.salePrice < variant.price) {
            setOriginalPrice(variant.price);
          }
        }
      } else {
        setProduct(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [publicId]);

  const handleClick = () => {
    if (!product) return;
    if (onClickProduct) {
      onClickProduct(product);
    } else if (shopSlug && product.slug) {
      router.push(`/shops/${shopSlug}/products/${product.slug}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-2 mb-2 border border-slate-100 shadow-sm flex items-center justify-center gap-2 w-[300px] min-h-[60px]">
        <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-sm flex items-center gap-2 w-[300px]">
        <div className="w-12 h-12 bg-slate-100 flex-shrink-0 rounded flex items-center justify-center">
          <Package className="w-6 h-6 text-slate-400" />
        </div>
        <div className="text-slate-800 text-xs">
          <p className="font-bold line-clamp-2">Sản phẩm không tồn tại hoặc đã bị xóa</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-lg border border-slate-200 shadow-sm w-[300px] cursor-pointer hover:bg-slate-50 transition-colors overflow-hidden"
      onClick={handleClick}
    >
      <div className="bg-orange-100 border-b border-orange-200 px-2.5 py-1.5 text-orange-700 text-[11px] font-medium uppercase tracking-wider flex items-center gap-1">
        <Package className="w-3 h-3 shrink-0" />
        <span>Sản phẩm</span>
      </div>
      <div className="p-2 flex gap-2">
        <img src={product.thumbnailUrl} alt={product.name} className="w-14 h-14 object-cover rounded bg-slate-100 flex-shrink-0 border border-slate-200" />
        <div className="text-slate-800 flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <p className="text-[13px] font-medium line-clamp-2 leading-tight">{product.name}</p>
          {price !== null && (
            <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-emerald-600 font-bold text-[13px]">{price.toLocaleString('vi-VN')}đ</span>
              {originalPrice && (
                <span className="text-slate-400 text-[11px] line-through">{originalPrice.toLocaleString('vi-VN')}đ</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
