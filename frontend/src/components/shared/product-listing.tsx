"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { ProductCard } from "@/components/shared/cards";
import { fetchPublicProducts } from "@/services/product-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { Product, ProductVariant, Shop } from "@/types/models";
import { getCategoryNames } from "@/lib/helpers";

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
  const [hasMore, setHasMore] = useState(false);

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
        size: 20,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        seller_id: sellerId || undefined,
        min_rating: rating ? Number(rating) : undefined
      });
      if (isMounted) {
        if (res.ok && res.products) {
          setProducts(prev => page === 1 ? res.products! : [...prev, ...res.products!]);
          setVariants(prev => page === 1 ? res.variants! : [...prev, ...res.variants!]);
          setShops(prev => {
            const newShops = res.shops!.filter(s => !prev.some(ps => ps.id === s.id));
            return [...prev, ...newShops];
          });
          setHasMore(res.products.length === 20);
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
  }, [keyword, sort, categorySlug, page, sellerId, rating, minPrice, maxPrice]);

  useEffect(() => {
    setPage(1);
  }, [keyword, sort, categorySlug, sellerId, rating, minPrice, maxPrice]);

  const filterPanel = (
    <div className="grid gap-3">
      <Field label="Từ khóa">
        <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tên sản phẩm, shop, danh mục" />
      </Field>
      <Field label="Khoảng giá">
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Từ" />
          <Input type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Đến" />
        </div>
      </Field>
      <Field label="Seller">
        <Select value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
          <option value="">Tất cả shop</option>
          {store.state.shops.filter((shop) => shop.status === "APPROVED").map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.shopName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Rating tối thiểu">
        <Select value={rating} onChange={(event) => setRating(event.target.value)}>
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
        }}
      >
        Reset filter
      </Button>
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <Section
        title={title}
        action={
          <div className="flex gap-2">
            <IconButton aria-label="Mở filter" className="lg:hidden" onClick={() => setFiltersOpen((value) => !value)}>
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </IconButton>
            <Select value={sort} onChange={(event) => setSort(event.target.value as any)} className="w-44">
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
            {loading && page === 1 ? (
              <div className="py-12 text-center text-muted">Đang tải sản phẩm...</div>
            ) : products.length > 0 ? (
              <>
                <p className="mb-3 text-sm text-muted">Hiển thị {products.length} sản phẩm</p>
                <ProductGrid products={products} variants={variants} shops={shops} />
                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={loading}>
                      {loading ? "Đang tải..." : "Tải thêm"}
                    </Button>
                  </div>
                )}
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
