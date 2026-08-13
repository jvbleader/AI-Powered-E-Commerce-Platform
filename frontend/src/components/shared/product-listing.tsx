"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { Section } from "@/components/ui/containers";
import { ProductCard } from "@/components/shared/cards";
import { ProductGridSkeleton } from "@/components/shared/skeletons";
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

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(initialKeyword);
  const [sort, setSort] = useState<"relevance" | "newest" | "price_asc" | "price_desc" | "best_selling" | "high_rating">(
    (searchParams.get("sort") as any) || "relevance"
  );
  const [sellerId, setSellerId] = useState<string[]>(searchParams.get("seller_id") ? searchParams.get("seller_id")!.split(",") : []);
  const [rating, setRating] = useState(searchParams.get("rating") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("min_price") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max_price") || "");
  const [location, setLocation] = useState<string[]>(searchParams.get("location") ? searchParams.get("location")!.split(",") : []);
  const [localCategorySlug, setLocalCategorySlug] = useState<string[]>(
    searchParams.get("category") ? searchParams.get("category")!.split(",") : (categorySlug ? [categorySlug] : [])
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [aggregations, setAggregations] = useState<any>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(30);
  const [total, setTotal] = useState(0);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (sort !== "relevance") params.set("sort", sort); else params.delete("sort");
    if (sellerId.length > 0) params.set("seller_id", sellerId.join(",")); else params.delete("seller_id");
    if (rating) params.set("rating", rating); else params.delete("rating");
    if (minPrice) params.set("min_price", minPrice); else params.delete("min_price");
    if (maxPrice) params.set("max_price", maxPrice); else params.delete("max_price");
    if (location.length > 0) params.set("location", location.join(",")); else params.delete("location");
    
    if (localCategorySlug.length > 0) {
      if (localCategorySlug.length === 1 && localCategorySlug[0] === categorySlug) {
        params.delete("category");
      } else {
        params.set("category", localCategorySlug.join(","));
      }
    } else {
      params.delete("category");
    }

    if (page > 1) params.set("page", page.toString()); else params.delete("page");

    const queryStr = params.toString();
    const newUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
    
    if (newUrl !== `${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`) {
      router.replace(newUrl, { scroll: false });
    }
  }, [sort, sellerId, rating, minPrice, maxPrice, location, localCategorySlug, page, pathname, router, searchParams, categorySlug]);

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
        category: localCategorySlug.length > 0 ? localCategorySlug.join(",") : undefined,
        sort_by: sort,
        page,
        size: pageSize,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        seller_id: sellerId.length > 0 ? sellerId.join(",") : undefined,
        shop_slug: shopSlug || undefined,
        min_rating: rating ? Number(rating) : undefined,
        location: location.length > 0 ? location.join(",") : undefined
      });
      if (isMounted) {
        if (res.ok && res.products) {
          setProducts(res.products);
          setVariants(res.variants || []);
          setShops(res.shops || []);
          setTotal(res.total || 0);
          setAggregations(res.aggregations || null);
        } else {
          setProducts([]);
          setVariants([]);
          setShops([]);
          setTotal(0);
          setAggregations(null);
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
  }, [keyword, sort, localCategorySlug, shopSlug, page, pageSize, sellerId, rating, minPrice, maxPrice, location]);

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

  const VIETNAM_PROVINCES = [
    "Hà Nội", "Hải Phòng", "Huế", "Đà Nẵng", "Cần Thơ", "Hồ Chí Minh",
    "Lai Châu", "Điện Biên", "Sơn La", "Lạng Sơn", "Cao Bằng", "Tuyên Quang",
    "Lào Cai", "Thái Nguyên", "Phú Thọ", "Bắc Ninh", "Hưng Yên", "Ninh Bình",
    "Quảng Ninh", "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Trị", "Quảng Ngãi",
    "Gia Lai", "Khánh Hòa", "Lâm Đồng", "Đắk Lắk", "Đồng Nai", "Tây Ninh",
    "Vĩnh Long", "Đồng Tháp", "Cà Mau", "An Giang"
  ];

  const locationOptions: Option[] = VIETNAM_PROVINCES.map(p => ({ label: p, value: p }));

  let categoryOptions: Option[] = [];
  if (aggregations?.categories?.buckets) {
    categoryOptions = aggregations.categories.buckets
      .map((b: any) => {
        const cat = store.state.categories.find(c => c.slug === b.key);
        return { label: cat ? cat.name : b.key, value: b.key, count: b.doc_count };
      });
  } else {
    categoryOptions = store.state.categories.map(c => ({ label: c.name, value: c.slug }));
  }

  let shopOptions: Option[] = [];
  if (aggregations?.shops?.buckets) {
    shopOptions = aggregations.shops.buckets
      .map((b: any) => {
        // Note: shop.id in frontend is the shop_slug for public views
        const shop = store.state.shops.find(s => s.id === b.key) || shops.find(s => s.id === b.key);
        return { label: shop ? shop.shopName : b.key, value: b.key, count: b.doc_count };
      });
  } else {
    shopOptions = store.state.shops.filter(s => s.status === "APPROVED").map(s => ({ label: s.shopName, value: s.id }));
  }

  const filterPanel = (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="w-40">
        <MultiSelect 
          options={locationOptions} 
          value={location} 
          onChange={(val) => { setLocation(val); setPage(1); }} 
          placeholder="Khu vực" 
        />
      </div>
      
      <div className="w-48">
        <MultiSelect 
          options={categoryOptions} 
          value={localCategorySlug} 
          onChange={(val) => { setLocalCategorySlug(val); setPage(1); }} 
          placeholder="Danh mục" 
        />
      </div>

      <div className="w-56">
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPage(1); }} placeholder="Giá từ" className="h-9" />
          <Input type="number" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPage(1); }} placeholder="Đến" className="h-9" />
        </div>
      </div>
      
      {!shopSlug && (
        <div className="w-48">
          <MultiSelect 
            options={shopOptions} 
            value={sellerId} 
            onChange={(val) => { setSellerId(val); setPage(1); }} 
            placeholder="Shop" 
          />
        </div>
      )}

      <div className="w-40">
        <Select value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }} className="h-9">
          <option value="">Đánh giá</option>
          <option value="1">Từ 1 sao</option>
          <option value="2">Từ 2 sao</option>
          <option value="3">Từ 3 sao</option>
          <option value="4">Từ 4 sao</option>
          <option value="4.5">Từ 4.5 sao</option>
        </Select>
      </div>
      
      <Button
        variant="secondary"
        className="h-9"
        onClick={() => {
          setSellerId([]);
          setRating("");
          setMinPrice("");
          setMaxPrice("");
          setLocation([]);
          setLocalCategorySlug(categorySlug ? [categorySlug] : []);
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
            <Select value={sort} onChange={(event) => { setSort(event.target.value as any); setPage(1); }} className="w-44">
              <option value="relevance">Liên quan</option>
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Giá tăng</option>
              <option value="price_desc">Giá giảm</option>
              <option value="best_selling">Bán chạy</option>
              <option value="high_rating">Rating cao</option>
            </Select>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {filterPanel}
          <div>
            {loading ? (
              <ProductGridSkeleton count={pageSize} />
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
                      <option value="30">30 / trang</option>
                      <option value="60">60 / trang</option>
                      <option value="120">120 / trang</option>
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
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
