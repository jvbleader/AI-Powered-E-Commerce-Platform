"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { recommendationService } from "@/services/recommendation.service";
import { ProductCard } from "@/components/shared/cards";
import { Product } from "@/types/models";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import NotFoundPage from "@/components/shared/not-found-page";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { normalizeProduct } from "@/services/product-api";

export default function ShopSimilarProductsPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const params = useParams();
  const router = useRouter();
  
  const shopSlug = typeof params?.shopSlug === "string" ? params.shopSlug : "";
  const productSlug = typeof params?.productSlug === "string" ? params.productSlug : "";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 24;

  useEffect(() => {
    let isMounted = true;
    const fetchSimilar = async () => {
      try {
        setLoading(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const res = await recommendationService.getShopSimilarProducts(productSlug, limit, page);
        if (isMounted) {
          setProducts(res.items || []);
          setTotal(res.total || 0);
        }
      } catch (error) {
        console.error("Failed to load shop similar products", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSimilar();
    return () => { isMounted = false; };
  }, [productSlug, page]);

  if (!shopSlug || !productSlug) return <NotFoundPage />;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("ellipsis");
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <main className="mx-auto max-w-[1252px] px-4 sm:px-6 lg:px-8 py-6 space-y-6 bg-canvas min-h-screen">
      {/* HEADER */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Các sản phẩm khác của shop
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Hiển thị {products.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, total)} trên tổng số {total} sản phẩm
          </p>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-4">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-3xl bg-slate-50">
          <h3 className="text-lg font-bold text-slate-700">Không có sản phẩm nào</h3>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-4">
            {products.map((pRaw: any) => {
              const { product, variants, shop } = normalizeProduct(pRaw);
              return (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  variants={variants}
                  categories={store.state.categories}
                  shop={shop || store.state.shops.find(s => s.id === product.sellerId)}
                  onAdd={async (variantId) => {
                    const result = await store.addToCart(variantId, 1);
                    showToast(result.message, result.ok ? "success" : "danger");
                  }}
                />
              );
            })}
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center pt-8">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Trước
                </button>
                <div className="hidden sm:flex items-center gap-1">
                  {getPageNumbers().map((p, idx) =>
                    p === "ellipsis" ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-sm text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p as number)}
                        className={cn(
                          "h-10 w-10 rounded-xl text-sm font-black transition-colors",
                          page === p
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                            : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                        )}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>
                <span className="sm:hidden text-sm font-bold text-slate-600 px-3">
                  {page}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
