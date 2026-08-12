"use client";

import React, { useEffect, useState } from "react";
import { recommendationService } from "@/services/recommendation.service";
import { ProductCard } from "@/components/shared/cards";
import { Product } from "@/types/models";
import { ChevronRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { normalizeProduct } from "@/services/product-api";

interface Props {
  productSlug: string;
  shopSlug: string;
}

export function ShopSimilarProducts({ productSlug, shopSlug }: Props) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -scrollContainerRef.current.clientWidth, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: scrollContainerRef.current.clientWidth, behavior: "smooth" });
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchSimilar = async () => {
      try {
        setLoading(true);
        const res = await recommendationService.getShopSimilarProducts(productSlug, 12, 1);
        if (isMounted && res.items) {
          setProducts(res.items);
          setTotal(res.total);
        }
      } catch (error) {
        console.error("Failed to load shop similar products", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSimilar();
    return () => { isMounted = false; };
  }, [productSlug]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-5">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 uppercase tracking-wide">
          Các sản phẩm khác của shop
        </h2>
        <Link
          href={`/shops/${shopSlug}/similar-products/${productSlug}`}
          className="group flex items-center text-sm font-semibold text-rose-600 hover:text-rose-700"
        >
          Xem tất cả
          <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      
      <div className="relative group">
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 xl:gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {products.map((pRaw: any) => {
            const { product, variants, shop } = normalizeProduct(pRaw);
            return (
              <div key={product.id} className="w-[calc((100%-12px)/2)] sm:w-[calc((100%-24px)/3)] md:w-[calc((100%-36px)/4)] lg:w-[calc((100%-48px)/5)] xl:w-[calc((100%-80px)/6)] shrink-0 snap-start">
                <ProductCard 
                  product={product} 
                  variants={variants}
                  categories={store.state.categories}
                  shop={shop || store.state.shops.find(s => s.id === product.sellerId)}
                  hideShop={true}
                  hideAddToCart={true}
                  compactStats={true}
                  onAdd={async (variantId) => {
                    const result = await store.addToCart(variantId, 1);
                    showToast(result.message, result.ok ? "success" : "danger");
                  }}
                />
              </div>
            );
          })}
        </div>
        {products.length > 2 && (
          <>
            <button 
              onClick={scrollLeft} 
              className="absolute left-[-16px] top-1/3 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 z-10 hidden group-hover:flex"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button 
              onClick={scrollRight} 
              className="absolute right-[-16px] top-1/3 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 z-10 hidden group-hover:flex"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}
