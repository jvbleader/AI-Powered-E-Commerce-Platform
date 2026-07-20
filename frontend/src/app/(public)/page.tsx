"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Award,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
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
  TrendingUp,
  Truck,
  Zap
} from "lucide-react";
import { hotKeywords } from "@/store/initial-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ProductGridSkeleton } from "@/components/ui/skeletons";
import { fetchRecommendedProducts, fetchPublicProducts } from "@/services/product-api";
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
  const { showToast } = store;

  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [newest, setNewest] = useState<Product[]>([]);
  const [localVariants, setLocalVariants] = useState<ProductVariant[]>([]);
  const [localShops, setLocalShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"recommended" | "newest">("recommended");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);

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
          setLocalVariants((prev) => {
            const combined = [...prev, ...(recommendRes.variants || [])];
            return Array.from(new Map(combined.map((v) => [v.id, v])).values());
          });
          setLocalShops((prev) => {
            const combined = [...prev, ...(recommendRes.shops || [])];
            return Array.from(new Map(combined.map((s) => [s.id, s])).values());
          });
        }
        if (newestRes.ok && newestRes.products) {
          setNewest(newestRes.products);
          setLocalVariants((prev) => {
            const combined = [...prev, ...(newestRes.variants || [])];
            return Array.from(new Map(combined.map((v) => [v.id, v])).values());
          });
          setLocalShops((prev) => {
            const combined = [...prev, ...(newestRes.shops || [])];
            return Array.from(new Map(combined.map((s) => [s.id, s])).values());
          });
        }
        setLoading(false);
      }
    };
    loadHomeData();
    return () => {
      isMounted = false;
    };
  }, []);

  const approvedShops = localShops.filter((shop) => shop.status === "APPROVED");
  const heroProduct = bestSellers[0];
  const heroShop = heroProduct ? localShops.find((shop) => shop.id === heroProduct.sellerId) : undefined;
  const heroVariant = heroProduct ? localVariants.find((v) => v.productId === heroProduct.id) : undefined;

  const handleAiSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiResponse(`Shepoo AI gợi ý: Dựa trên nhu cầu "${aiPrompt.trim()}", các sản phẩm bên dưới có đánh giá tốt nhất và ưu đãi giảm đến 30%!`);
  };

  return (
    <div className="min-h-screen space-y-8 bg-canvas text-slate-900 pb-20 pt-4 px-4 sm:px-6 lg:px-8">
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
                    <a
                      key={keyword}
                      href={`/search?q=${encodeURIComponent(keyword)}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 transition-all duration-200 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900 hover:scale-105 active:scale-95 shadow-2xs"
                    >
                      {keyword}
                    </a>
                  ))}
                </div>

                {/* Primary & Secondary CTA Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={() => router.push(activeSlide.ctaPrimaryLink)}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-600/40 active:scale-95"
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
                        ? "w-8 bg-emerald-600 shadow-xs shadow-emerald-600/50"
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
          <div className="bento-card relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 lg:col-span-4 border-amber-200 bg-white/90 hover-lift">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200/80 shadow-2xs">
                <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500 animate-bounce-subtle" />
                Siêu Phẩm Nổi Bật
              </span>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">Giảm 25%</span>
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

                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-heading text-2xl font-black text-emerald-700">
                      {heroVariant ? `${heroVariant.price.toLocaleString("vi-VN")} ₫` : "---"}
                    </p>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>4.9 (120+ bán)</span>
                    </div>
                  </div>
                </div>

                {/* Stock Scarcity Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Đã bán 85%</span>
                    <span className="text-amber-600 animate-pulse">Chỉ còn 3 sản phẩm!</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-amber-500 to-rose-500 animate-gradient-flow" />
                  </div>
                </div>

                <a
                  href={`/shops/${heroShop?.shopSlug || "shop"}/products/${heroProduct.slug}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 shadow-md"
                >
                  <span>Xem Chi Tiết</span>
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center text-xs text-slate-400">
                {loading ? "Đang nạp dữ liệu..." : "Chưa có sản phẩm"}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: FLASH DEALS TICKER & AI ASSISTANT BENTO */}
      <section className="mx-auto max-w-7xl animate-fade-in-up">
        <div className="grid gap-4 md:grid-cols-12">
          {/* BENTO BOX 3: FLASH DEALS COUNTDOWN TICKER (7 cols) */}
          <div className="bento-card bento-card-amber rounded-3xl p-6 md:col-span-7 flex flex-col justify-between border-amber-200 bg-white/90 hover-lift">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-600">
                <Zap className="h-5 w-5 fill-amber-500 text-amber-500 animate-bounce-subtle" />
                <span className="font-heading text-lg font-black uppercase text-slate-900 tracking-tight">Flash Deals Giờ Vàng</span>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold text-amber-700">
                <Clock className="h-4 w-4 text-amber-600 animate-spin-slow" />
                <span className="rounded-lg bg-amber-100 px-2 py-1 border border-amber-200 shadow-2xs">04</span> :
                <span className="rounded-lg bg-amber-100 px-2 py-1 border border-amber-200 shadow-2xs">28</span> :
                <span className="rounded-lg bg-amber-100 px-2 py-1 border border-amber-200 shadow-2xs animate-pulse">19</span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Săn mã giảm giá sốc đến 50% cùng ưu đãi Miễn phí vận chuyển toàn quốc cho mọi đơn hàng từ 199k!
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Bảo hành 100% chính hãng</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-600" />
                <span>Giao hàng thần tốc 2H</span>
              </div>
            </div>
          </div>

          {/* BENTO BOX 4: AI ASSISTANT SPOTLIGHT (5 cols) */}
          <div className="bento-card bento-card-violet rounded-3xl p-6 md:col-span-5 flex flex-col justify-between border-indigo-200 bg-white/90 hover-lift">
            <div>
              <div className="flex items-center gap-2 text-indigo-600">
                <Bot className="h-5 w-5 animate-pulse" />
                <span className="font-heading text-lg font-bold text-slate-900">Shepoo AI Assistant</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Nhập nhu cầu của bạn để AI gợi ý sản phẩm tối ưu nhất:</p>
            </div>

            <form onSubmit={handleAiSearch} className="mt-4 flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="VD: Tai nghe Bluetooth pin trâu..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all duration-200"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:bg-indigo-500 active:scale-95 shadow-md shadow-indigo-500/20"
              >
                Hỏi AI
              </button>
            </form>

            {aiResponse && (
              <div className="mt-3 animate-scale-in rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-medium text-indigo-900 shadow-2xs">
                {aiResponse}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3: BENTO CATEGORY MATRIX */}
      <section className="mx-auto max-w-7xl animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl font-extrabold text-slate-900 sm:text-2xl">Danh Mục Mua Sắm</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {store.state.categories.map((cat) => (
            <a
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="bento-card group hover-lift flex items-center gap-3 rounded-2xl p-4 transition-all duration-300 bg-white/90 border-slate-200/80"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white group-hover:rotate-6 transition-all duration-300">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-heading text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                  {cat.name}
                </h4>
                <p className="text-[11px] font-medium text-slate-400 group-hover:translate-x-1 transition-transform duration-200">Khám phá &rarr;</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* SECTION 4: CURATED BENTO PRODUCTS SHOWCASE */}
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Cyber Selection</span>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900">Sản Phẩm Tuyển Chọn</h2>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveTab("recommended")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "recommended" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🔥 Nổi Bật
            </button>
            <button
              onClick={() => setActiveTab("newest")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "newest" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ✨ Mới Nhất
            </button>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <ProductGridSkeleton count={4} />
          ) : (activeTab === "recommended" ? bestSellers : newest).length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(activeTab === "recommended" ? bestSellers : newest).map((product) => (
                <CyberProductCard
                  key={product.id}
                  product={product}
                  variant={localVariants.find((v) => v.productId === product.id)}
                  shop={localShops.find((s) => s.id === product.sellerId)}
                  onAddToCart={async (variantId) => {
                    const result = await store.addToCart(variantId, 1);
                    showToast(result.message, result.ok ? "success" : "danger");
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có sản phẩm phù hợp" />
          )}
        </div>
      </section>

      {/* SECTION 5: VERIFIED SHOPS MATRIX */}
      <section className="mx-auto max-w-7xl">
        <h2 className="mb-4 font-heading text-xl font-extrabold text-slate-900 sm:text-2xl">Gian Hàng Đối Tác Verified</h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {approvedShops.slice(0, 6).map((shop) => (
            <div key={shop.id} className="bento-card rounded-2xl p-5 flex items-center justify-between bg-white/90 border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-heading font-extrabold text-lg">
                  {shop.shopName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-heading font-bold text-slate-900">{shop.shopName}</h4>
                  <p className="text-xs text-slate-500">{shop.description || "Gian hàng uy tín trên Shepoo"}</p>
                </div>
              </div>

              <a
                href={`/shops/${shop.shopSlug}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
              >
                Ghé Shop
              </a>
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
  shop,
  onAddToCart
}: {
  product: Product;
  variant?: ProductVariant;
  shop?: Shop;
  onAddToCart: (variantId: string) => void;
}) {
  return (
    <div className="bento-card group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 transition-all hover:-translate-y-1 hover:border-slate-300">
      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50">
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute left-2 top-2">
            <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shadow-sm">
              Verified
            </span>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-400">{shop?.shopName || "Shepoo Store"}</p>
          <h4 className="line-clamp-1 font-heading text-sm font-bold text-slate-900 group-hover:text-emerald-700">
            {product.name}
          </h4>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-400">Giá bán</p>
          <p className="font-heading text-base font-extrabold text-emerald-700">
            {variant ? `${variant.price.toLocaleString("vi-VN")} ₫` : "---"}
          </p>
        </div>

        <button
          onClick={() => variant && onAddToCart(variant.id)}
          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
        >
          + Thêm
        </button>
      </div>
    </div>
  );
}



