"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, ExternalLink, Loader2 } from "lucide-react";
import { AIProductItem } from "@/services/aiChatService";
import { formatVnd } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export function ProductCardInChat({ product }: { product: AIProductItem }) {
  const store = useMarketplaceStore();
  const { showToast, addToCart } = store;
  const [adding, setAdding] = useState(false);

  const shopSlug = product.shop_slug || "shop";
  const productHref = product.slug
    ? `/shops/${shopSlug}/products/${product.slug}`
    : `/search?q=${encodeURIComponent(product.name)}`;

  const targetVariantId = product.primary_variant_id || String(product.id);
  const isOutOfStock = product.stock <= 0;

  const handleAddToCart = async () => {
    if (isOutOfStock || adding) return;
    setAdding(true);
    try {
      const res = await addToCart(targetVariantId, 1);
      showToast(res.message, res.ok ? "success" : "danger");
    } catch (e: any) {
      showToast(e.message || "Lỗi khi thêm giỏ hàng", "danger");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="w-[220px] shrink-0 overflow-hidden rounded-2xl border border-emerald-100/80 bg-white shadow-xs hover:shadow-md transition-all duration-200 hover:border-emerald-300">
      <div className="relative aspect-square w-full bg-slate-50 overflow-hidden">
        <img
          src={product.thumbnail_url || "/images/placeholder.png"}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80";
          }}
        />
        <div className="absolute top-2 left-2 z-10">
          {isOutOfStock ? (
            <span className="rounded-full bg-rose-500/90 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs shadow-xs">
              Hết hàng
            </span>
          ) : (
            <span className="rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs shadow-xs">
              Còn {product.stock}
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-1.5">
        <h4 className="line-clamp-2 text-xs font-bold text-slate-800 leading-snug min-h-[32px]">
          {product.name}
        </h4>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold text-emerald-600">
            {formatVnd(product.sale_price ?? product.price)}
          </span>
          {product.sale_price && (
            <span className="text-[11px] text-slate-400 line-through">
              {formatVnd(product.price)}
            </span>
          )}
        </div>

        <div className="pt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100">
          <Link
            href={productHref}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
          >
            <span>Chi tiết</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || adding}
            className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-1.5 text-[11px] font-bold text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all shadow-xs"
          >
            {adding ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-3 w-3" />
                <span>+Giỏ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
