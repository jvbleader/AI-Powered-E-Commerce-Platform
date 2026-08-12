"use client";

import React, { useEffect, useState } from "react";
import { recommendationService } from "@/services/recommendation.service";
import { ProductCard } from "@/components/shared/cards";
import { Product } from "@/types/models";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { normalizeProduct } from "@/services/product-api";
import Link from "next/link";

interface Props {
  productSlug: string;
}

export function SemanticSimilarProducts({ productSlug }: Props) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchSimilar = async () => {
      try {
        setLoading(true);
        const res = await recommendationService.getSimilarProducts(productSlug, 48, 1);
        if (isMounted && res.items) {
          setProducts(res.items);
          setTotal(res.total || 0);
        }
      } catch (error) {
        console.error("Failed to load semantic similar products", error);
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
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 uppercase tracking-wide">
          Có thể bạn cũng thích
        </h2>
      </div>
      
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
        {products.map((pRaw: any) => {
          const { product, variants, shop } = normalizeProduct(pRaw);
          return (
            <ProductCard 
              key={product.id} 
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
          );
        })}
      </div>

      <div className="flex justify-center pt-4 border-t border-slate-100">
        <Link
          href={`/similar-products/${productSlug}`}
          className="px-6 py-2.5 rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          Xem thêm
        </Link>
      </div>
    </div>
  );
}
