"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SlidersHorizontal } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { ProductCard } from "@/components/shared/cards";
import { fetchPublicProducts } from "@/services/product-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { Product, ProductVariant, Shop } from "@/types/models";

export default function ProductListing({
  title,
  categorySlug,
  shopSlug,
  initialKeyword = ""
}: {
  title: string;
  categorySlug?: string;
  shopSlug?: string;
  initialKeyword?: string;
}) {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [keyword, setKeyword] = useState(initialKeyword);
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc" | "best_selling" | "high_rating">("newest");
  const [sellerId, setSellerId] = useState("");
  const [rating, setRating] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const listingTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKeyword(initialKeyword);
  }, [initialKeyword]);

  useEffect(() => {
    let isMounted = true;
    const loadProducts = async () => {
      setLoading(true);
      const res = await fetchPublicProducts({
        keyword: keyword || undefined,
        category: categorySlug || undefined,
        sort_by: sort,
        page,
        size: pageSize,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        seller_id: sellerId || undefined,
        shop_slug: shopSlug || undefined,
        min_rating: rating ? Number(rating) : undefined
      });
      if (isMounted) {
        if (res.ok && res.products) {
          setProducts(res.products);
          setVariants(res.variants || []);
          setShops(res.shops || []);
          setTotal(res.total || 0);
        } else {
          setProducts([]);
          setVariants([]);
          setShops([]);
          setTotal(0);
        }
        setLoading(false);
      }
    };
    
    const timer = setTimeout(() => {
      loadProducts();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [keyword, sort, categorySlug, shopSlug, page, pageSize, sellerId, rating, minPrice, maxPrice]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      listingTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getPageNumbers = (current: number, totalCount: number) => {
    if (totalCount <= 7) {
      return Array.from({ length: totalCount }, (_, i) => i + 1);
    }
    if (current <= 3) {
      return [1, 2, 3, 4, "...", totalCount];
    }
    if (current >= totalCount - 2) {
      return [1, "...", totalCount - 3, totalCount - 2, totalCount - 1, totalCount];
    }
    return [1, "...", current - 1, current, current + 1, "...", totalCount];
  };

  const filterPanel = (
    <div className="grid gap-3">
      <Field label="Từ khóa">
        <Input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="Tên sản phẩm, shop, danh mục" />
      </Field>
      <Field label="Khoảng giá">
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPage(1); }} placeholder="Từ" />
          <Input type="number" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPage(1); }} placeholder="Đến" />
        </div>
      </Field>
      {!shopSlug && (
        <Field label="Seller">
          <Select value={sellerId} onChange={(event) => { setSellerId(event.target.value); setPage(1); }}>
            <option value="">Tất cả shop</option>
            {store.state.shops.filter((shop) => shop.status === "APPROVED").map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shopName}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Rating tối thiểu">
        <Select value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }}>
          <option value="">Tất cả</option>
          <option value="4">Từ 4 sao</option>
          <option value="4.5">Từ 4.5 sao</option>
        </Select>
      </Field>
      <Button
        variant="secondary"
        onClick={() => {
          setKeyword("");
          setSellerId("");
          setRating("");
          setMinPrice("");
          setMaxPrice("");
          setPage(1);
        }}
      >
        Reset filter
      </Button>
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-5" ref={listingTopRef}>
      <Section
        title={title}
        action={
          <div className="flex gap-2">
            <IconButton aria-label="Mở filter" className="lg:hidden" onClick={() => setFiltersOpen((value) => !value)}>
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </IconButton>
            <Select value={sort} onChange={(event) => { setSort(event.target.value as any); setPage(1); }} className="w-44">
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Giá tăng</option>
              <option value="price_desc">Giá giảm</option>
              <option value="best_selling">Bán chạy</option>
              <option value="high_rating">Rating cao</option>
            </Select>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <Panel>{filterPanel}</Panel>
          </aside>
          {filtersOpen ? <Panel className="lg:hidden">{filterPanel}</Panel> : null}
          <div>
            {loading ? (
              <div className="py-16 text-center text-slate-500 font-medium animate-pulse">
                Đang tải danh sách sản phẩm...
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Hiển thị <span className="font-semibold text-slate-900">{Math.min((page - 1) * pageSize + 1, total)}</span> - <span className="font-semibold text-slate-900">{Math.min(page * pageSize, total)}</span> trong số <span className="font-semibold text-slate-900">{total}</span> sản phẩm
                  </p>
                  {totalPages > 1 && (
                    <span className="text-xs text-slate-500 font-medium">
                      Trang {page} / {totalPages}
                    </span>
                  )}
                </div>

                <ProductGrid products={products} variants={variants} shops={shops} />

                {/* Pagination Controls */}
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200/80 pt-6">
                  <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
                    Trang <span className="font-bold text-slate-900">{page}</span> / <span className="font-bold text-slate-900">{totalPages}</span> ({total} sản phẩm)
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePageChange(1)}
                      disabled={page === 1 || loading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                      title="Trang đầu"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1 || loading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                      title="Trang trước"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {getPageNumbers(page, totalPages).map((p, idx) => {
                      if (p === "...") {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-400 select-none font-bold">
                            ...
                          </span>
                        );
                      }
                      const isCurrent = p === page;
                      return (
                        <button
                          key={`page-${p}`}
                          type="button"
                          onClick={() => handlePageChange(p as number)}
                          disabled={loading}
                          className={`h-8 min-w-[32px] px-2.5 rounded-lg text-xs font-bold transition-all ${
                            isCurrent
                              ? "border border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                              : "border border-slate-200 bg-white text-slate-700 shadow-2xs hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalPages || loading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                      title="Trang sau"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={page === totalPages || loading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                      title="Trang cuối"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-center sm:justify-end gap-2 text-xs text-slate-500 font-medium">
                    <span>Số sản phẩm:</span>
                    <Select
                      value={pageSize.toString()}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-8 text-xs py-0 w-24 border-slate-200"
                    >
                      <option value="12">12 / trang</option>
                      <option value="20">20 / trang</option>
                      <option value="36">36 / trang</option>
                      <option value="48">48 / trang</option>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="Không có kết quả" description="Hãy đổi từ khóa hoặc reset bộ lọc để xem thêm sản phẩm." />
            )}
          </div>
        </div>
      </Section>
    </main>
  );
}

function ProductGrid({ products, variants, shops }: { products: Product[]; variants: ProductVariant[]; shops: Shop[] }) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          variants={variants}
          shop={shops.find(s => s.id === product.sellerId)}
          categories={store.state.categories}
          onAdd={async (variantId) => {
            const result = await store.addToCart(variantId, 1);
            showToast(result.message, result.ok ? "success" : "danger");
          }}
        />
      ))}
    </div>
  );
}
