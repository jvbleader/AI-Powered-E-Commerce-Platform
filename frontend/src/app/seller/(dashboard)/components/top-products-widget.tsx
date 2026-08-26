"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, TrendingUp, ChevronRight, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product, ProductVariant } from "@/types/models";
import { formatVnd, getProductPriceRange } from "@/lib/helpers";

export interface TopProductsWidgetProps {
  products: Product[];
  variants?: ProductVariant[];
}

export function TopProductsWidget({ products, variants = [] }: TopProductsWidgetProps) {
  const router = useRouter();

  const topProducts = [...products]
    .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, 5);

  return (
    <div className="rounded-panel border border-line bg-white p-5 shadow-soft">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-ink">Sản phẩm bán chạy</h3>
          </div>
          <Link
            href="/seller/products"
            className="flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Xem tất cả
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {topProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <Package className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-ink">Chưa có sản phẩm nào</p>
            <p className="mt-1 text-xs text-muted max-w-[200px]">
              Hãy đăng sản phẩm đầu tiên để bắt đầu bán hàng.
            </p>
            <Button
              className="mt-4 text-xs h-8"
              onClick={() => router.push("/seller/products/new")}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Đăng sản phẩm
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-line mt-1">
            {topProducts.map((product, idx) => {
              const productVariants = variants.filter((v) => v.productId === product.id);
              const totalStock = productVariants.reduce(
                (sum, v) => sum + (v.inventory?.quantity ?? 0),
                0
              );
              const priceRange = getProductPriceRange(product, variants);

              return (
                <div key={product.id} className="flex items-center gap-3 py-3 hover:bg-slate-50/50 rounded-lg px-1 transition-colors">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                    {idx + 1}
                  </span>

                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-slate-50">
                    {product.thumbnailUrl ? (
                      <img
                        src={product.thumbnailUrl}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                          if (e.currentTarget.parentElement) {
                            const fallback = document.createElement("div");
                            fallback.className = "flex h-full w-full items-center justify-center text-slate-300";
                            fallback.innerHTML = `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
                            e.currentTarget.parentElement.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink hover:text-emerald-700 transition-colors">
                      <Link href={`/seller/products`}>{product.name}</Link>
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                      <span>Đã bán: <strong className="text-slate-800 font-semibold">{product.soldCount ?? 0}</strong></span>
                      {productVariants.length > 0 && totalStock <= 5 && (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600">
                          <AlertCircle className="h-3 w-3" />
                          Còn {totalStock}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-coral">
                      {priceRange.min > 0
                        ? priceRange.min === priceRange.max
                          ? formatVnd(priceRange.min)
                          : `${formatVnd(priceRange.min)}`
                        : "Liên hệ"}
                    </p>
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
