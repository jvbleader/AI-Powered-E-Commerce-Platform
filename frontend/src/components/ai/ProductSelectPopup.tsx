import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { apiFetch } from '@/services/api';

type Product = {
  public_id: string;
  slug: string;
  name: string;
  images: { image_url: string; is_thumbnail: boolean }[];
  variants: { price: number; sale_price: number | null }[];
};

type ProductSelectPopupProps = {
  shopId: number;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
};

export function ProductSelectPopup({ shopId, isOpen, onClose, onSelect }: ProductSelectPopupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('#product-popup-trigger')) return;
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
    const fetchProducts = async () => {
      try {
        const res = await apiFetch<any>(`/products?seller_id=${shopId}&keyword=${encodeURIComponent(searchTerm)}&size=10`);
        setProducts(res.items || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    const timeoutId = setTimeout(() => {
      fetchProducts();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [shopId, isOpen, searchTerm]);

  if (!isOpen) return null;

  return (
    <div ref={popupRef} className="absolute bottom-[72px] left-4 w-[320px] h-[380px] z-[60] bg-white flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="flex items-center justify-between p-3 border-b border-line">
        <h3 className="font-heading font-medium text-slate-900">Chọn sản phẩm</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-3 border-b border-line relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Tìm sản phẩm..." 
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
        ) : products.length === 0 ? (
          <div className="text-center text-slate-500 py-8 text-sm">Không tìm thấy sản phẩm nào</div>
        ) : (
          <div className="space-y-2">
            {products.map(product => {
              const primaryImage = product.images?.find(i => i.is_thumbnail)?.image_url || product.images?.[0]?.image_url || '/placeholder.png';
              const firstVariant = product.variants?.[0] || { price: 0, sale_price: null };
              const displayPrice = firstVariant.sale_price || firstVariant.price;
              
              return (
                <div key={product.public_id} className="flex gap-3 p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-colors group">
                  <img src={primaryImage} alt={product.name} className="w-16 h-16 object-cover rounded border border-line" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{product.name}</p>
                    <p className="text-sm text-emerald-600 font-medium mt-1">{displayPrice.toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div className="flex items-center">
                    <button 
                      onClick={() => {
                        onSelect(product);
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
