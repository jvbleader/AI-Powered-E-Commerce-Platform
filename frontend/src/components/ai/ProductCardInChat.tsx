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
  const targetIdentifier = product.slug || (product.id ? String(product.id) : "");
  const productHref = targetIdentifier
    ? `/shops/${shopSlug}/products/${targetIdentifier}`
    : `/search?q=${encodeURIComponent(product.name)}`;

  const targetVariantId = product.primary_variant_id || String(product.id);
  const stockNum =
    typeof product.stock === "number" && !Number.isNaN(product.stock)
      ? product.stock
      : null;
  const isOutOfStock = stockNum !== null && stockNum <= 0;

  const priceNum =
    typeof product.price === "number" && !Number.isNaN(product.price)
      ? product.price
      : null;
  const salePriceNum =
    typeof product.sale_price === "number" && !Number.isNaN(product.sale_price)
      ? product.sale_price
      : null;
  const displayPrice = salePriceNum ?? priceNum;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
    <div className="group relative w-[150px] shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md flex flex-col">
      {/* Top section: Square Thumbnail image */}
      <Link href={productHref} className="block relative aspect-square w-full shrink-0 bg-slate-50 overflow-hidden">
        <img
          src={product.thumbnail_url || "/images/placeholder.png"}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80";
          }}
        />
        <div className="absolute top-1.5 left-1.5 z-10">
          {isOutOfStock ? (
            <span className="rounded-md bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
              Hết hàng
            </span>
          ) : stockNum !== null ? (
            <span className="rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
              Còn {stockNum}
            </span>
          ) : (
            <span className="rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
              Sẵn hàng
            </span>
          )}
        </div>
      </Link>

      {/* Bottom section: Content & Actions */}
      <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-between">
        <div>
          <Link
            href={productHref}
            className="text-[11px] font-semibold text-slate-800 leading-snug hover:text-emerald-600 transition-colors block h-[30px] overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={product.name}
          >
            {product.name}
          </Link>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xs font-bold text-emerald-600">
              {displayPrice !== null ? formatVnd(displayPrice) : "Liên hệ"}
            </span>
            {salePriceNum !== null && priceNum !== null && priceNum > salePriceNum && (
              <span className="text-[10px] text-slate-400 line-through">
                {formatVnd(priceNum)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="pt-1.5 grid grid-cols-2 gap-1 border-t border-slate-100">
          <Link
            href={productHref}
            className="h-6 flex items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
          >
            <span>Xem</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || adding}
            className="h-6 flex items-center justify-center gap-0.5 rounded-lg bg-emerald-600 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
            title="Thêm vào giỏ"
          >
            {adding ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-2.5 w-2.5" />
                <span>+Giỏ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

