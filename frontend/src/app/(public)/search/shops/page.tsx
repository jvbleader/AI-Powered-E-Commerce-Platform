"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Store, Star, Package } from "lucide-react";

import { fetchShopSearch, type ShopSearchItem } from "@/services/search-api";

function ShopSearchContent() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const [items, setItems] = useState<ShopSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedQuery, setFetchedQuery] = useState<string | null>(null);

  const isLoading = query ? (loading || query !== fetchedQuery) : false;

  useEffect(() => {
    if (!query) {
      setItems([]);
      setTotal(0);
      setFetchedQuery("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchShopSearch({ q: query, page: 1, size: 20 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items || []);
        setTotal(res.total || 0);
        setFetchedQuery(query);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Không tải được danh sách shop. Vui lòng thử lại.");
        setItems([]);
        setTotal(0);
        setFetchedQuery(query);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">
        Tìm Shop{query ? <> &quot;{query}&quot;</> : null}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {isLoading ? "Đang tìm..." : `${total} shop phù hợp`}
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!isLoading && !error && query && items.length === 0 && (
        <div className="mt-16 text-center text-slate-500">
          <Store className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm">Không tìm thấy shop nào cho &quot;{query}&quot;</p>
          <Link href={`/search?q=${encodeURIComponent(query)}`} className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Tìm sản phẩm thay thế
          </Link>
        </div>
      )}

      <div className={`mt-6 space-y-3 ${isLoading ? "opacity-50 pointer-events-none transition-opacity" : ""}`}>
        {items.map((shop) => (
          <Link
            key={shop.public_id}
            href={`/shops/${shop.shop_slug}`}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
              {shop.shop_logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.shop_logo_url} alt={shop.shop_name} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-slate-900">{shop.shop_name}</div>
              {shop.shop_description ? (
                <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{shop.shop_description}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  {Number(shop.average_rating || 0).toFixed(1)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {shop.product_count} sản phẩm
                </span>
                <span>{shop.total_sold} đã bán</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ShopSearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Đang tải...</div>}>
      <ShopSearchContent />
    </Suspense>
  );
}
