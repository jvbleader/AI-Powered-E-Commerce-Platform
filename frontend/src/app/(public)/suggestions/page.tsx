"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchTodaySuggestions } from "@/services/product-api";
import { getSearchHistory } from "@/lib/search-history";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { CyberProductGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/feedback";
import { RatingStars } from "@/components/shared/cards";
import type { Product, ProductVariant, Shop } from "@/types/models";

function SuggestionsContent() {
  const store = useMarketplaceStore();
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const size = 48;

  const [products, setProducts] = useState<Product[]>([]);
  const [localVariants, setLocalVariants] = useState<ProductVariant[]>([]);
  const [localShops, setLocalShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      const keywords = getSearchHistory();
      const res = await fetchTodaySuggestions(keywords, page, size);
      
      if (isMounted) {
        if (res.ok && res.products) {
          setProducts(res.products);
          setTotal(res.total || 0);
          setLocalVariants(res.variants || []);
          setLocalShops(res.shops || []);
        }
        setLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [page]);

  const activeProducts = products.filter(p => {
    const isHidden = store.state.hiddenProductIds.includes(p.id) || store.state.hiddenProductIds.includes(p.slug);
    const globalP = store.state.products.find(sp => sp.id === p.id);
    return !isHidden && (globalP ? globalP.status !== "HIDDEN" : p.status !== "HIDDEN");
  });

  return (
    <div className="min-h-screen space-y-8 bg-canvas text-slate-900 pb-20 pt-8 px-4 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-slate-900">Gợi Ý Hôm Nay</h1>
            <p className="text-sm text-slate-500 mt-1">Sản phẩm dành riêng cho bạn dựa trên xu hướng và sở thích</p>
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <CyberProductGridSkeleton count={48} />
          ) : activeProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {activeProducts.map((product) => (
                  <CyberProductCard
                    key={product.id}
                    product={product}
                    variant={localVariants.find((v) => v.productId === product.id)}
                    shop={localShops.find((s) => s.id === product.sellerId)}
                  />
                ))}
              </div>
              
              {total > size && (
                <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/suggestions?page=${Math.max(1, page - 1)}`}
                      className={`h-10 px-4 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors ${page === 1 ? "opacity-40 pointer-events-none" : ""}`}
                    >
                      Trước
                    </Link>
                    <span className="text-sm font-bold text-slate-600 px-3">
                      Trang {page} / {Math.ceil(total / size)}
                    </span>
                    <Link
                      href={`/suggestions?page=${page + 1}`}
                      className={`h-10 px-4 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors ${page >= Math.ceil(total / size) ? "opacity-40 pointer-events-none" : ""}`}
                    >
                      Sau
                    </Link>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState title="Chưa có sản phẩm phù hợp" />
          )}
        </div>
      </section>
    </div>
  );
}

export default function SuggestionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8"><CyberProductGridSkeleton count={48} /></div>}>
      <SuggestionsContent />
    </Suspense>
  );
}

function CyberProductCard({
  product,
  variant,
  shop
}: {
  product: Product;
  variant?: ProductVariant;
  shop?: Shop;
}) {
  return (
    <Link href={`/shops/${shop?.shopSlug || "shop"}/products/${product.slug}`} className="bento-card group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 transition-all hover:-translate-y-1 hover:border-slate-300">
      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50">
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-400">{shop?.shopName || "Shepoo Store"}</p>
          <h4 className="line-clamp-1 font-heading text-sm font-bold text-slate-900 group-hover:text-emerald-700">
            {product.name}
          </h4>
          <div className="mt-1.5 flex items-center justify-between gap-1">
            <RatingStars rating={product.averageRating} count={product.reviewCount} />
            <span className="text-[11px] font-semibold text-slate-600">Đã bán <span className="text-emerald-600 font-bold">{product.soldCount.toLocaleString("vi-VN")}</span></span>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[10px] text-slate-400">Giá bán</p>
        <p className="font-heading text-base font-extrabold text-emerald-700">
          {variant ? `${variant.price.toLocaleString("vi-VN")} ₫` : "---"}
        </p>
      </div>
    </Link>
  );
}
