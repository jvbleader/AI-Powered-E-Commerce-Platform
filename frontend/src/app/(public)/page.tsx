"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Award,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Flame,
  Gift,
  Globe,
  Layers,
  Package,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  TrendingUp
} from "lucide-react";
import { hotKeywords } from "@/store/initial-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { CyberProductGridSkeleton, HeroSpotlightSkeleton, ShopCardSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingStars } from "@/components/shared/cards";
import { fetchTodaySuggestions, fetchFeaturedShops } from "@/services/product-api";
import { getSearchHistory } from "@/lib/search-history";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { BRAND_NAME } from "@/lib/constants";
import type { Product, ProductVariant, Shop } from "@/types/models";

const heroSlides = [
  {
    id: "ai-marketplace",
    badge: "Shepoo Cyber Marketplace 2.0",
    badgeBg: "border-emerald-300 bg-emerald-100/90 text-emerald-950 shadow-sm shadow-emerald-500/10",
    dotBg: "bg-emerald-500",
    pingBg: "bg-emerald-400",
    badgeIcon: Sparkles,
    badgeIconClass: "text-emerald-700 animate-spin-slow",
    containerBg: "bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-slate-50/90 border-emerald-400/40",
    ambientGlow1: "bg-emerald-400/20",
    ambientGlow2: "bg-teal-400/20",
    conicGradient: "from-emerald-500 via-teal-400 to-cyan-500",
    title: (
      <>
        Sàn Mua Sắm AI <br />
        <span className="text-gradient-neon">Thế Hệ Mới</span>
      </>
    ),
    description: "Trải nghiệm giao dịch thông minh với trợ lý AI, bảo mật tuyệt đối, giao hàng siêu tốc và gian hàng chính hãng verified.",
    ctaPrimary: "Khám phá toàn sàn",
    ctaPrimaryLink: "/products",
    ctaSecondary: "Mở gian hàng ngay",
    ctaSecondaryLink: "/seller/register",
    widgetTitle: "Shepoo AI Bot Online",
    widgetBadge: "Phản hồi < 0.2s",
    widgetBadgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    widgetDesc: "Đã phân tích 1,420 đánh giá & gợi ý 3 deal tốt nhất cho bạn!",
    subWidgetIconText: "⚡ 12.4k đơn hàng AI chốt tự động thành công",
    subWidgetMetric: "99.8% Phản Hồi Tốt",
    subWidgetMetricBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    progressGradient: "from-emerald-500 to-teal-500",
    subWidgetProgress: 99
  },
  {
    id: "super-sale",
    badge: "Super Flash Deals Giờ Vàng",
    badgeBg: "border-orange-300 bg-orange-100/90 text-orange-950 shadow-sm shadow-orange-500/10",
    dotBg: "bg-orange-500",
    pingBg: "bg-orange-400",
    badgeIcon: Flame,
    badgeIconClass: "text-orange-600 animate-bounce-subtle",
    containerBg: "bg-gradient-to-br from-orange-50/90 via-amber-50/40 to-rose-50/30 border-orange-400/40",
    ambientGlow1: "bg-orange-400/20",
    ambientGlow2: "bg-rose-400/20",
    conicGradient: "from-orange-500 via-amber-400 to-rose-500",
    title: (
      <>
        Đại Tiệc Săn Sale <br />
        <span className="text-gradient-amber">Giảm Đến 70%</span>
      </>
    ),
    description: "Hàng ngàn mã giảm giá 500k toàn sàn, săn xu thưởng gấp đôi và Miễn phí vận chuyển 0Đ toàn quốc!",
    ctaPrimary: "Săn Deal Hot",
    ctaPrimaryLink: "/products?sort=discount",
    ctaSecondary: "Nhận Voucher 500K",
    ctaSecondaryLink: "/cart",
    widgetTitle: "Flash Sale Đang Diễn Ra",
    widgetBadge: "Chỉ còn 12 suất",
    widgetBadgeBg: "bg-orange-50 text-orange-800 border-orange-200",
    widgetDesc: "Tai nghe Cyber X-Pro giảm 50% chỉ còn 499.000₫",
    subWidgetIconText: "🔥 85% kho hàng Flash Sale đã được săn!",
    subWidgetMetric: "Sắp Cháy Hàng ⚡",
    subWidgetMetricBg: "bg-orange-50 text-orange-800 border-orange-200",
    progressGradient: "from-orange-500 via-rose-500 to-red-500",
    subWidgetProgress: 85
  },
  {
    id: "shepoo-mall",
    badge: "Shepoo Mall Verified",
    badgeBg: "border-indigo-300 bg-indigo-100/90 text-indigo-950 shadow-sm shadow-indigo-500/10",
    dotBg: "bg-indigo-500",
    pingBg: "bg-indigo-400",
    badgeIcon: ShieldCheck,
    badgeIconClass: "text-indigo-700 animate-pulse",
    containerBg: "bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-slate-50/90 border-indigo-400/40",
    ambientGlow1: "bg-indigo-400/20",
    ambientGlow2: "bg-purple-400/20",
    conicGradient: "from-indigo-500 via-purple-400 to-pink-500",
    title: (
      <>
        Gian Hàng 100% <br />
        <span className="text-gradient-cyber">Chính Hãng 24/7</span>
      </>
    ),
    description: "Cam kết 100% hàng thật chính hãng từ các thương hiệu hàng đầu. Hoàn tiền 200% nếu phát hiện hàng giả.",
    ctaPrimary: "Ghé Shepoo Mall",
    ctaPrimaryLink: "/shops",
    ctaSecondary: "Đăng Ký Thương Hiệu",
    ctaSecondaryLink: "/seller/register",
    widgetTitle: "Cam Kết Shepoo Mall",
    widgetBadge: "100% Verified",
    widgetBadgeBg: "bg-indigo-50 text-indigo-800 border-indigo-200",
    widgetDesc: "Đổi trả miễn phí 30 ngày & Bảo hành tận nhà 12 tháng",
    subWidgetIconText: "🛡️ Cam kết hoàn tiền 200% nếu phát hiện hàng giả",
    subWidgetMetric: "Bảo Vệ 100%",
    subWidgetMetricBg: "bg-indigo-50 text-indigo-800 border-indigo-200",
    progressGradient: "from-indigo-500 to-purple-500",
    subWidgetProgress: 100
  }
];

export default function HomePageComponent() {
  const store = useMarketplaceStore();
  const router = useRouter();

  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(false);
  const [localVariants, setLocalVariants] = useState<ProductVariant[]>([]);
  const [localShops, setLocalShops] = useState<Shop[]>([]);
  const [featuredShops, setFeaturedShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const activeSlide = heroSlides[currentHeroSlide] || heroSlides[0];
  const BadgeIconComponent = activeSlide.badgeIcon;

  useEffect(() => {
    if (!store.ready) return;
    let isMounted = true;
    const loadHomeData = async () => {
      setLoading(true);
      const keywords = getSearchHistory();
      
      const [suggestionsRes, featuredRes] = await Promise.all([
        fetchTodaySuggestions(keywords, 1, 48),
        fetchFeaturedShops(10)
      ]);
      
      if (isMounted) {
        if (featuredRes.ok && featuredRes.shops) {
          setFeaturedShops(featuredRes.shops);
          // Also merge them into localShops so products can link to them if needed
          setLocalShops((prev) => {
            const shopMap = new Map();
            for (const s of [...prev, ...featuredRes.shops]) {
              const existing = shopMap.get(s.id);
              if (existing && !s.description && existing.description) {
                shopMap.set(s.id, { ...s, description: existing.description });
              } else {
                shopMap.set(s.id, s);
              }
            }
            return Array.from(shopMap.values());
          });
        }
        if (suggestionsRes.ok && suggestionsRes.products) {
          setSuggestions(suggestionsRes.products);
          setHasMoreSuggestions((suggestionsRes.total || 0) > 48 || suggestionsRes.products.length === 48);
          setLocalVariants((prev) => {
            const combined = [...prev, ...(suggestionsRes.variants || [])];
            return Array.from(new Map(combined.map((v) => [v.id, v])).values());
          });
          setLocalShops((prev) => {
            const combined = [...prev, ...(suggestionsRes.shops || [])];
            const shopMap = new Map();
            for (const s of combined) {
              const existing = shopMap.get(s.id);
              if (existing && !s.description && existing.description) {
                shopMap.set(s.id, { ...s, description: existing.description });
              } else {
                shopMap.set(s.id, s);
              }
            }
            return Array.from(shopMap.values());
          });
        }
        setLoading(false);
      }
    };
    loadHomeData();
    return () => {
      isMounted = false;
    };
  }, [store.ready]);

  const activeSuggestions = suggestions.filter(p => {
    const isHidden = store.state.hiddenProductIds.includes(p.id) || store.state.hiddenProductIds.includes(p.slug);
    const globalP = store.state.products.find(sp => sp.id === p.id);
    return !isHidden && (globalP ? globalP.status !== "HIDDEN" : p.status !== "HIDDEN");
  });

  const approvedShops = featuredShops.filter((shop) => shop.status === "APPROVED");
  const heroProduct = activeSuggestions[0];
  const heroShop = heroProduct ? localShops.find((shop) => shop.id === heroProduct.sellerId) : undefined;
  const heroVariant = heroProduct ? localVariants.find((v) => v.productId === heroProduct.id) : undefined;

  return (
    <div className="min-h-screen space-y-8 bg-canvas text-slate-900 pb-20 pt-8 px-4 sm:px-6 lg:px-8">
      {/* SECTION 1: BENTO GRID HERO & SPOTLIGHT */}
      <section className="mx-auto max-w-7xl animate-fade-in-up">
        <div className="grid gap-4 lg:grid-cols-12">
          {/* BENTO BOX 1: HERO MAIN INTERACTIVE CAROUSEL BANNER (Spans 8 cols) */}
          <div className={`bento-card group/hero relative overflow-hidden rounded-3xl p-6 sm:p-10 lg:col-span-8 flex flex-col justify-between transition-all duration-700 ${activeSlide.containerBg} shadow-2xl`}>
            {/* Expanded Slide-Matching Ambient Light Mesh */}
            <div className={`pointer-events-none absolute -right-10 -top-10 h-[480px] w-[480px] rounded-full blur-[100px] opacity-50 transition-all duration-700 ${activeSlide.ambientGlow1} animate-pulse-glow`} />
            <div className={`pointer-events-none absolute -left-10 -bottom-10 h-[480px] w-[480px] rounded-full blur-[100px] opacity-50 transition-all duration-700 ${activeSlide.ambientGlow2} animate-float-slow`} />

            {/* Ambient Animated Conic Light Ring */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20 blur-2xl overflow-hidden">
              <div className={`h-full w-full bg-gradient-to-tr ${activeSlide.conicGradient} animate-conic-spin transition-all duration-700`} />
            </div>

            <div className="relative z-10 grid gap-6 md:grid-cols-12 items-center">
              {/* Left Content Area (7 cols) */}
              <div className="md:col-span-7 space-y-6">
                <div className="flex items-center gap-2">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold shadow-xs transition-all duration-300 ${activeSlide.badgeBg}`}>
                    <BadgeIconComponent className={`h-4 w-4 ${activeSlide.badgeIconClass}`} />
                    <span className="font-extrabold">{activeSlide.badge}</span>
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${activeSlide.pingBg} opacity-75`} />
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${activeSlide.dotBg}`} />
                    </span>
                  </div>
                </div>

                {/* Animated Slide Title */}
                <div key={activeSlide.id} className="animate-scale-in">
                  <h1 className="font-heading text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
                    {activeSlide.title}
                  </h1>

                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    {activeSlide.description}
                  </p>
                </div>

                {/* Hot Keywords Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/80 bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 px-2.5 py-1 text-xs font-black text-white shadow-md shadow-red-500/20 animate-pulse">
                    <Flame className="h-3.5 w-3.5 fill-white text-white animate-bounce-subtle" />
                    HOT TRENDS:
                  </span>
                  {hotKeywords.slice(0, 4).map((keyword) => (
                    <Link
                      key={keyword}
                      href={`/search?q=${encodeURIComponent(keyword)}`}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/60 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm"
                    >
                      {keyword}
                    </Link>
                  ))}
                </div>

                {/* Primary & Secondary CTA Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={() => router.push(activeSlide.ctaPrimaryLink)}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:from-emerald-500 hover:to-teal-500 active:scale-95"
                  >
                    {activeSlide.ctaPrimary}
                    <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => router.push(activeSlide.ctaSecondaryLink)}
                    className="rounded-xl border border-slate-200 bg-white/90 px-5 py-3 text-sm font-bold text-slate-800 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-95 shadow-2xs"
                  >
                    {activeSlide.ctaSecondary}
                  </Button>
                </div>
              </div>

              {/* Right Interactive 3D Showcase (5 cols) */}
              <div className="relative md:col-span-5 flex flex-col items-center justify-center min-h-[240px]">
                {/* Floating Glass Card 1 */}
                <div className="animate-float-card-1 w-full rounded-2xl border border-white/80 bg-white/80 p-4 shadow-xl backdrop-blur-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Bot className="h-4 w-4 text-emerald-600 animate-pulse" />
                      {activeSlide.widgetTitle}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${activeSlide.widgetBadgeBg}`}>
                      {activeSlide.widgetBadge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                    {activeSlide.widgetDesc}
                  </p>
                </div>

                {/* Sub Floating Glass Badge 2 (ELEGANT Translucent Glass Floater) */}
                <div className="animate-float-card-2 -mt-3 w-[95%] rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 text-slate-800 shadow-xl backdrop-blur-xl space-y-2.5 transition-all duration-300 hover:border-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-500 animate-spin-slow shrink-0" />
                      <span>{activeSlide.subWidgetIconText}</span>
                    </p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${activeSlide.subWidgetMetricBg}`}>
                      {activeSlide.subWidgetMetric}
                    </span>
                  </div>

                  {/* Dynamic Scarcity Progress Bar */}
                  {activeSlide.subWidgetProgress && (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${activeSlide.progressGradient} transition-all duration-1000 ease-out`}
                          style={{ width: `${activeSlide.subWidgetProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Controls Bar (Slide Navigation & Progress Bar) */}
            <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/60 pt-4">
              <div className="flex items-center gap-2">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setCurrentHeroSlide(index)}
                    aria-label={`Chuyển đến slide ${index + 1}`}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      currentHeroSlide === index
                        ? "w-8 bg-emerald-600 shadow-xs"
                        : "w-2.5 bg-slate-300 hover:bg-slate-400"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>Trượt {currentHeroSlide + 1} / {heroSlides.length}</span>

                <button
                  onClick={() => setIsAutoPlaying((prev) => !prev)}
                  title={isAutoPlaying ? "Tạm dừng tự động trượt" : "Bật tự động trượt"}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  {isAutoPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>

                <button
                  onClick={() => setCurrentHeroSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-90"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => setCurrentHeroSlide((prev) => (prev + 1) % heroSlides.length)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-90"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* BENTO BOX 2: HERO SPOTLIGHT PRODUCT CARD (Spans 4 cols) */}
          <div className="bento-card relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 lg:col-span-4 border-rose-200/80 bg-white/90 hover-lift">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-700 border border-rose-200 shadow-2xs">
                <Flame className="h-3.5 w-3.5 fill-rose-500 text-rose-500 animate-bounce-subtle" />
                Siêu Phẩm Nổi Bật
              </span>
              {heroVariant?.salePrice && heroVariant.salePrice < heroVariant.price ? (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
                  Giảm {Math.round((1 - heroVariant.salePrice / heroVariant.price) * 100)}%
                </span>
              ) : loading ? (
                <Skeleton className="h-[22px] w-[60px] rounded-md bg-slate-200/60" />
              ) : null}
            </div>

            {heroProduct ? (
              <div className="my-4 space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 group">
                  <img
                    src={heroProduct.thumbnailUrl}
                    alt={heroProduct.name}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-110"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500">{heroShop?.shopName || "Verified Shop"}</p>
                  <h3 className="line-clamp-1 font-heading text-lg font-bold text-slate-900">{heroProduct.name}</h3>

                  <div className="mt-2 flex flex-col gap-1.5">
                    <p className="font-heading text-2xl font-black text-emerald-700">
                      {heroVariant ? `${(heroVariant.salePrice ?? heroVariant.price).toLocaleString("vi-VN")} ₫` : "---"}
                    </p>
                    <div className="flex items-center gap-3">
                      <RatingStars rating={heroProduct.averageRating} count={heroProduct.reviewCount} />
                      <span className="text-xs font-semibold text-slate-500">| {heroProduct.soldCount}+ đã bán</span>
                    </div>
                  </div>
                </div>


                <Link
                  href={`/shops/${heroShop?.shopSlug || "shop"}/products/${heroProduct.slug}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 shadow-md"
                >
                  <span>Xem Chi Tiết</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ) : loading ? (
              <HeroSpotlightSkeleton />
            ) : (
              <div className="flex aspect-square items-center justify-center text-xs text-slate-400">
                Chưa có sản phẩm
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 4: CURATED BENTO PRODUCTS SHOWCASE */}
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900">Gợi Ý Hôm Nay</h2>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <CyberProductGridSkeleton count={24} />
          ) : activeSuggestions.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {activeSuggestions.map((product) => (
                  <CyberProductCard
                    key={product.id}
                    product={product}
                    variant={localVariants.find((v) => v.productId === product.id)}
                    shop={localShops.find((s) => s.id === product.sellerId)}
                  />
                ))}
              </div>
              
              {hasMoreSuggestions && (
                <div className="mt-8 flex justify-center">
                  <Link href="/suggestions?page=2">
                    <Button variant="outline" className="px-8 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      Xem Thêm
                    </Button>
                  </Link>
                </div>
              )}
            </>
          ) : (
            <EmptyState title="Chưa có sản phẩm phù hợp" />
          )}
        </div>
      </section>

      {/* SECTION 5: VERIFIED SHOPS MATRIX */}
      <section className="mx-auto max-w-7xl">
        <h2 className="mb-4 font-heading text-xl font-extrabold text-slate-900 sm:text-2xl">Shop nổi bật</h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <ShopCardSkeleton key={`shop-skel-${i}`} />
            ))
          ) : approvedShops.slice(0, 6).map((shop) => (
            <div key={shop.id} className="bento-card rounded-2xl p-5 flex items-center justify-between gap-4 bg-white/90 border-slate-200/80">
              <div className="flex items-center gap-3 min-w-0">
                {shop.logoUrl ? (
                  <img src={shop.logoUrl} alt={shop.shopName} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl object-cover border border-emerald-200" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-heading font-extrabold text-lg">
                    {shop.shopName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-heading font-bold text-slate-900 truncate">{shop.shopName}</h4>
                </div>
              </div>

              <Link
                href={`/shops/${shop.shopSlug}`}
                className="shrink-0 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
              >
                Ghé Shop
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
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



