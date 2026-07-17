"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Sparkles, Truck, WalletCards } from "lucide-react";
import { hotKeywords } from "@/store/initial-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { ProductCard, ShopCard } from "@/components/shared/cards";
import { ProductGridSkeleton } from "@/components/ui/skeletons";
import { fetchRecommendedProducts, fetchPublicProducts } from "@/services/product-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { BRAND_NAME, NAV_LINK_CLASS } from "@/lib/constants";
import type { Product, ProductVariant, Shop } from "@/types/models";



export default function HomePageComponent() {
  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;

  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [newest, setNewest] = useState<Product[]>([]);
  const [localVariants, setLocalVariants] = useState<ProductVariant[]>([]);
  const [localShops, setLocalShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadHomeData = async () => {
      setLoading(true);
      const [recommendRes, newestRes] = await Promise.all([
        fetchRecommendedProducts(8),
        fetchPublicProducts({ sort_by: "newest", size: 8 })
      ]);
      if (isMounted) {
        if (recommendRes.ok && recommendRes.products) {
          setBestSellers(recommendRes.products);
          setLocalVariants(prev => {
            const combined = [...prev, ...recommendRes.variants!];
            return Array.from(new Map(combined.map(v => [v.id, v])).values());
          });
          setLocalShops(prev => {
            const combined = [...prev, ...recommendRes.shops!];
            return Array.from(new Map(combined.map(s => [s.id, s])).values());
          });
        }
        if (newestRes.ok && newestRes.products) {
          setNewest(newestRes.products);
          setLocalVariants(prev => {
            const combined = [...prev, ...newestRes.variants!];
            return Array.from(new Map(combined.map(v => [v.id, v])).values());
          });
          setLocalShops(prev => {
            const combined = [...prev, ...newestRes.shops!];
            return Array.from(new Map(combined.map(s => [s.id, s])).values());
          });
        }
        setLoading(false);
      }
    };
    loadHomeData();
    return () => { isMounted = false; };
  }, []);

  const approvedShops = localShops.filter((shop) => shop.status === "APPROVED");
  const heroProduct = bestSellers[0];
  const heroShop = heroProduct ? localShops.find((shop) => shop.id === heroProduct.sellerId) : undefined;

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="overflow-hidden rounded-panel border border-line bg-white">
          <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
            <div className="p-5 sm:p-7">
              <StatusBadge status="APPROVED" label="Shepoo Marketplace" />
              <h1 className="mt-4 text-3xl font-black tracking-normal text-ink sm:text-5xl">{BRAND_NAME}</h1>
              <div className="mt-5 flex flex-wrap gap-2">
                {hotKeywords.map((keyword) => (
                  <a
                    key={keyword}
                    href={`/search?q=${encodeURIComponent(keyword)}`}
                    className="rounded-panel border border-line bg-canvas px-3 py-1.5 text-sm font-semibold text-muted hover:border-primary/40 hover:text-primary"
                  >
                    {keyword}
                  </a>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => router.push("/products")}>Mua ngay</Button>
                <Button variant="secondary" onClick={() => router.push(store.getCurrentUser() ? "/seller/register" : "/login")}>
                  Đăng ký trở thành người bán
                </Button>
              </div>
            </div>
            {heroProduct ? (
              <a href={`/shops/${heroShop?.shopSlug}/products/${heroProduct.slug}`} className="relative min-h-72 bg-canvas">
                <img src={heroProduct.thumbnailUrl} alt={heroProduct.name} className="h-full w-full object-cover" />
                <div className="absolute inset-x-4 bottom-4 rounded-panel border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
                  <p className="inline-flex rounded-[6px] bg-amber/20 px-2 py-1 text-xs font-bold uppercase text-primary">Đang bán chạy</p>
                  <h2 className="mt-1 text-lg font-black text-ink">{heroProduct.name}</h2>
                  <p className="text-sm text-muted">{heroShop?.shopName}</p>
                </div>
              </a>
            ) : (
              <div className="relative min-h-72 bg-canvas flex items-center justify-center">
                {loading ? <p className="text-muted text-sm font-semibold">Đang tải...</p> : null}
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-4">
          <Panel>
            <div className="flex items-center gap-3">
              <WalletCards className="h-9 w-9 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm text-muted">Thanh toán</p>
                <p className="font-bold">Chuyển khoản, MoMo, thẻ tín dụng</p>
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center gap-3">
              <Truck className="h-9 w-9 text-coral" aria-hidden="true" />
              <div>
                <p className="text-sm text-muted">Giao hàng</p>
                <p className="font-bold">Theo dõi trạng thái đơn hàng</p>
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center gap-3">
              <Bot className="h-9 w-9 text-sky" aria-hidden="true" />
              <div>
                <p className="text-sm text-muted">Hỗ trợ</p>
                <p className="font-bold">Chat với Shepoo khi cần hỗ trợ</p>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <Section title="Danh mục">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {store.state.categories.map((category) => (
            <a key={category.id} href={`/categories/${category.slug}`} className="rounded-panel border border-line bg-white p-4 font-bold hover:border-primary/40 hover:text-primary">
              {category.name}
            </a>
          ))}
        </div>
      </Section>

      <Section title="Sản phẩm gợi ý" action={<a className={NAV_LINK_CLASS} href="/products">Xem tất cả</a>}>
        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : bestSellers.length > 0 ? (
          <ProductGrid products={bestSellers} variants={localVariants} shops={localShops} />
        ) : (
          <EmptyState title="Không có sản phẩm" />
        )}
      </Section>

      <Section title="Sản phẩm mới">
        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : newest.length > 0 ? (
          <ProductGrid products={newest} variants={localVariants} shops={localShops} />
        ) : (
          <EmptyState title="Không có sản phẩm" />
        )}
      </Section>

      <Section title="Shop nổi bật">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {approvedShops.slice(0, 6).map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
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
