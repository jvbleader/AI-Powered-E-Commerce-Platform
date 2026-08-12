"use client";

import React, { useEffect, useRef, useState, Fragment } from "react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  ShieldCheck,
  PackageCheck,
  Star,
  Flag,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Check,
  Info,
  Tag,
  MessageSquare,
  X,
  Store,
  Plus,
  XCircle
} from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import {
  PriceDisplay,
  QuantityStepper,
  RatingStars
} from "@/components/shared/cards";
import {
  formatDate,
  getCategoryNames,
  productStatusLabel
} from "@/lib/helpers";
import {
  fetchProductDetail,
  fetchRelatedProducts,
  fetchPublicProducts,
  fetchPublicShop,
} from "@/services/product-api";
import { fetchProductReviewsApi, ProductReview } from "@/services/review-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import NotFoundPage from "@/components/shared/not-found-page";
import type { Product, ProductVariant, Shop } from "@/types/models";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopSimilarProducts } from "@/components/product/shop-similar-products";
import { SemanticSimilarProducts } from "@/components/product/semantic-similar-products";

const getJoinDuration = (approvedAt?: string) => {
  if (!approvedAt) return "Mới đây";
  const diffDays = (new Date().getTime() - new Date(approvedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 30) return "Mới đây";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng`;
  return `${Math.floor(diffDays / 365)} năm`;
};

export default function ProductDetailPage() {
  const params = useParams();
  console.log("[DEBUG ProductDetailPage] params:", params);
  const shopSlug = typeof params?.shopSlug === "string" ? params.shopSlug : "shop";
  const productSlug = typeof params?.productSlug === "string" ? params.productSlug : "";

  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedTierIndex, setSelectedTierIndex] = useState<number[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [showReport, setShowReport] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [shopStats, setShopStats] = useState({ products: 0, reviews: 0, totalSold: 0, approvedAt: "" });
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [shop, setShop] = useState<Shop | undefined>(undefined);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const activeShopSlug = shop?.shopSlug || store.state.activeShop?.shopSlug;
    if (activeShopSlug) {
      fetchPublicShop(activeShopSlug).then((res) => {
        if (res.ok && res.shop) {
          setShopStats({
            products: res.shop.productCount || 0,
            reviews: res.shop.reviewCount || 0,
            totalSold: res.shop.totalSold || 0,
            approvedAt: res.shop.approvedAt || ""
          });
        }
      });
    }
  }, [shop?.shopSlug, store.state.activeShop?.shopSlug]);

  useEffect(() => {
    let isMounted = true;
    const loadDetail = async () => {
      if (!shopSlug || !productSlug) return;
      setLoading(true);
      const res = await fetchProductDetail(shopSlug, productSlug);
      if (isMounted) {
        if (res.ok && res.product) {
          setProduct(res.product);
          
          let fetchedVariants = res.variants!;
          if (res.product.variantOptions && res.product.variantOptions.length > 0) {
            if (fetchedVariants.some(v => !v.tierIndex)) {
              const sizes = res.product.variantOptions.map(opt => opt.values.length);
              fetchedVariants = fetchedVariants.map((v, idx) => {
                if (v.tierIndex) return v;
                const inferredTierIndex = [];
                let currentIdx = idx;
                for (let i = sizes.length - 1; i >= 0; i--) {
                  inferredTierIndex.unshift(currentIdx % sizes[i]);
                  currentIdx = Math.floor(currentIdx / sizes[i]);
                }
                return { ...v, tierIndex: inferredTierIndex };
              });
            }
          }
          setProductVariants(fetchedVariants);
          
          setShop(res.shop);
          setSelectedVariantId(fetchedVariants[0]?.id ?? "");
          setSelectedTierIndex(fetchedVariants[0]?.tierIndex || (res.product.variantOptions ? new Array(res.product.variantOptions.length).fill(0) : []));
          setSelectedImage(res.product.thumbnailUrl);
          store.saveProduct(res.product, fetchedVariants);
          if (res.shop) store.saveShop(res.shop);
        }
        setLoading(false);
      }
    };
    loadDetail();
    return () => { isMounted = false; };
  }, [shopSlug, productSlug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-[1252px] px-4 sm:px-6 lg:px-8 py-6 space-y-6 bg-canvas min-h-screen">
        {/* BREADCRUMB */}
        <nav className="flex items-center gap-2 text-xs">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-4 w-40" />
        </nav>

        {/* MAIN HERO CARD */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm lg:grid lg:grid-cols-12 lg:gap-8">
          
          {/* LEFT GALLERY (Col 5) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
              <Skeleton className="h-full w-full rounded-none" />
            </div>
            
            {/* THUMBNAILS */}
            <div className="flex gap-2 overflow-hidden pb-1">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-slate-200">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-slate-200">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
            </div>

            {/* SHOP CARD STRIP */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>

          {/* RIGHT INFO (Col 7) */}
          <div className="lg:col-span-7 mt-6 lg:mt-0 flex flex-col justify-between space-y-5">
            <div>
              {/* TAGS */}
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>

              {/* TITLE */}
              <div className="mt-2.5 space-y-2.5">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-1/2" />
              </div>

              {/* STATS BAR */}
              <div className="mt-4 flex items-center gap-4 border-b border-slate-100 pb-4">
                <Skeleton className="h-4 w-24" />
                <span className="h-3 w-px bg-slate-200" />
                <Skeleton className="h-4 w-24" />
              </div>

              {/* PRICE CONTAINER */}
              <div className="mt-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 p-4">
                <div className="flex items-baseline gap-3">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="mt-2 h-3 w-48" />
              </div>

              {/* VARIANT SELECTOR */}
              <div className="mt-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="flex flex-col gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 w-3/4 sm:w-2/3 h-[38px]">
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 w-5/6 sm:w-3/4 h-[38px]">
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </div>

              {/* QUANTITY STEPPER */}
              <div className="mt-5 space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-[112px] rounded-xl" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <Skeleton className="h-12 flex-1 rounded-xl" />
                <Skeleton className="h-12 flex-1 rounded-xl" />
                <Skeleton className="h-12 w-full sm:w-[50px] rounded-xl" />
              </div>
              {/* SPECIFICATIONS GRID */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 space-y-1.5 h-[58px]">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 space-y-1.5 h-[58px]">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 space-y-1.5 h-[58px]">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 space-y-1.5 h-[58px]">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* DESCRIPTION PANEL */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
             <Skeleton className="h-5 w-5 rounded-full" />
             <Skeleton className="h-6 w-32" />
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>

        {/* REVIEWS PANEL */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
             <Skeleton className="h-5 w-5 rounded-full" />
             <Skeleton className="h-6 w-40" />
          </div>
          <div className="space-y-4 pt-2">
             <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1.5">
                         <Skeleton className="h-3 w-24" />
                         <Skeleton className="h-2 w-16" />
                      </div>
                   </div>
                   <Skeleton className="h-4 w-20" />
                </div>
                <div className="pl-12 space-y-2">
                   <Skeleton className="h-3 w-full" />
                   <Skeleton className="h-3 w-3/4" />
                </div>
             </div>
          </div>
        </div>
      </main>
    );
  }

  if (!product) return <NotFoundPage />;

  const activeShop: Shop = shop || {
    id: shopSlug || "shop",
    userId: "",
    shopName: "Cửa hàng",
    shopSlug: shopSlug || "shop",
    logoUrl: "",
    description: "",
    phone: "",
    email: "",
    pickupAddress: "",
    shippingProviders: [],
    status: "APPROVED",
    totalSold: 0,
    totalRevenue: 0
  };
  
  const selectedVariant = productVariants.find((variant) => variant.id === selectedVariantId);

  const totalStock = productVariants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0);
  const isSelectedVariantOutOfStock = !selectedVariant || (selectedVariant.inventory?.quantity ?? 0) <= 0 || selectedVariant.status === "OUT_OF_STOCK";
  const isProductOutOfStock = product.status === "OUT_OF_STOCK" || (productVariants.length > 0 && totalStock <= 0);

  const handleOptionClick = (optIdx: number, valIdx: number) => {
    const newTierIndex = [...selectedTierIndex];
    newTierIndex[optIdx] = valIdx;
    setSelectedTierIndex(newTierIndex);
    
    const matchedVariant = productVariants.find(v => 
       v.tierIndex && v.tierIndex.length === newTierIndex.length && 
       v.tierIndex.every((val, idx) => val === newTierIndex[idx])
    );
    
    if (matchedVariant) {
       setSelectedVariantId(matchedVariant.id);
       if (matchedVariant.imageUrl) setSelectedImage(matchedVariant.imageUrl);
    } else {
       setSelectedVariantId("");
    }
  };

  // Prepare images array
  const allImages = Array.from(
    new Set([
      selectedVariant?.imageUrl,
      product.thumbnailUrl,
      ...(product.imageUrls || [])
    ].filter((img): img is string => Boolean(img)))
  );

  const activeImageSrc = selectedImage || selectedVariant?.imageUrl || product.thumbnailUrl;

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    if (!store.state.sessionUserId) {
      showToast("Vui lòng đăng nhập để thêm vào giỏ hàng", "warning" as any);
      router.push("/login");
      return;
    }
    setAddingToCart(true);
    try {
      const result = await store.addToCart(selectedVariant.id, quantity);
      showToast(result.message, result.ok ? "success" : "danger");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!selectedVariant) return;
    if (!store.state.sessionUserId) {
      showToast("Vui lòng đăng nhập để mua hàng", "warning" as any);
      router.push("/login");
      return;
    }
    setBuyingNow(true);
    try {
      const result = await store.buyNow(selectedVariant.id, quantity);
      if (result.ok) {
        router.push("/checkout");
      } else {
        showToast(result.message, "danger");
      }
    } finally {
      setBuyingNow(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1252px] px-4 sm:px-6 lg:px-8 py-6 space-y-6 bg-canvas min-h-screen">
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <a href="/" className="hover:text-emerald-700 transition-colors">Shepoo</a>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <a href={`/shops/${activeShop.shopSlug}`} className="hover:text-emerald-700 transition-colors">{activeShop.shopName}</a>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="truncate max-w-[200px] sm:max-w-[300px] text-slate-800">{product.name}</span>
      </nav>

      {/* MAIN HERO CARD (GALLERY + SPECS) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm lg:grid lg:grid-cols-12 lg:gap-8">
        
        {/* LEFT GALLERY (Col 5) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 group">
            <img
              src={activeImageSrc}
              alt={product.name}
              className={`h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105 ${isSelectedVariantOutOfStock ? "opacity-50 grayscale-[40%]" : ""}`}
            />
            {(isProductOutOfStock || isSelectedVariantOutOfStock) && (
              <div className="absolute top-3 left-3 z-20">
                <span className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-md opacity-100">
                  Hết hàng
                </span>
              </div>
            )}
            {selectedVariant?.salePrice && (
              <div className="absolute top-3 right-3 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black uppercase text-white shadow-md">
                Giảm giá
              </div>
            )}
          </div>

          {/* THUMBNAILS */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {allImages.map((imgUrl, idx) => {
                const isActive = activeImageSrc === imgUrl;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(imgUrl)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                      isActive ? "border-emerald-600 ring-2 ring-emerald-600/20 scale-95" : "border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}


        </div>

        {/* RIGHT INFO (Col 7) */}
        <div className="lg:col-span-7 mt-6 lg:mt-0 flex flex-col justify-between space-y-5">
          <div>
            {/* TAGS & CATEGORY */}
            {(isProductOutOfStock || isSelectedVariantOutOfStock) && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-extrabold text-rose-700">
                  Hết hàng
                </span>
              </div>
            )}

            {/* TITLE */}
            <h1 className="mt-2.5 font-heading text-xl sm:text-2xl font-black text-slate-900 leading-snug">
              {product.name}
            </h1>

            {/* STATS BAR */}
            <div className="mt-3 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-500">
                <RatingStars rating={product.averageRating} count={product.reviewCount} />
                <span className="h-3 w-px bg-slate-200" />
                <span className="flex items-center gap-1 text-slate-700">
                  <strong className="text-slate-900 border-b border-slate-900 pb-[1px]">{product.reviewCount || 0}</strong> Đánh giá
                </span>
                <span className="h-3 w-px bg-slate-200" />
                <span className="flex items-center gap-1 text-slate-700">
                  <strong className="text-slate-900">{product.soldCount || 0}</strong> Đã bán
                </span>
              </div>
              <button
                onClick={() => {
                  if (!store.state.sessionUserId) {
                    showToast("Vui lòng đăng nhập để gửi báo cáo vi phạm", "warning" as any);
                    return;
                  }
                  setShowReport((v) => {
                    const willShow = !v;
                    if (willShow) {
                      setTimeout(() => {
                        document.getElementById("report-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 100);
                    }
                    return willShow;
                  });
                }}
                className="text-xs font-medium text-slate-400 hover:text-rose-500 transition-colors"
              >
                Tố cáo
              </button>
            </div>

            {/* PRICE CONTAINER */}
            <div className="mt-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 p-4">
              <div className="flex items-baseline gap-3">
                <PriceDisplay
                  price={selectedVariant?.price ?? productVariants[0]?.price ?? 0}
                  salePrice={selectedVariant?.salePrice}
                  className="text-slate-900 text-2xl font-extrabold"
                />
              </div>
              {selectedVariant?.salePrice ? (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  Ưu đãi áp dụng đến {formatDate(selectedVariant.saleEndAt)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Giá đã bao gồm thuế VAT & Bảo hành từ Shop
                </p>
              )}
            </div>

            {/* VARIANT SELECTOR */}
            {product.variantOptions && product.variantOptions.length > 0 ? (
              <div className="mt-6 space-y-4">
                {product.variantOptions.map((opt: any, optIdx: number) => (
                  <div key={optIdx} className="flex items-start gap-4">
                    <label className="text-sm text-slate-500 font-medium min-w-[100px] pt-2">
                      {opt.name}
                    </label>
                    <div className="flex flex-wrap gap-3 flex-1">
                      {opt.values.map((val: string, valIdx: number) => {
                        const isSelected = selectedTierIndex[optIdx] === valIdx;
                        
                        const targetTier = [...selectedTierIndex];
                        targetTier[optIdx] = valIdx;
                        const targetVariant = productVariants.find(v => v.tierIndex && v.tierIndex.length === targetTier.length && v.tierIndex.every((t, i) => t === targetTier[i]));
                        const isOutOfStock = !targetVariant || (targetVariant.inventory?.quantity ?? 0) <= 0 || targetVariant.status === "OUT_OF_STOCK";

                        return (
                          <button
                            key={valIdx}
                            type="button"
                            disabled={targetVariant ? (targetVariant.status !== "ACTIVE" && targetVariant.status !== "OUT_OF_STOCK") : false}
                            onClick={() => handleOptionClick(optIdx, valIdx)}
                            className={`relative inline-flex items-center justify-center min-w-[80px] px-3 py-2 text-sm transition-all border bg-white ${
                              isSelected
                                ? "border-emerald-600 text-emerald-600 z-10"
                                : "border-slate-200 text-slate-700 hover:border-slate-300"
                            } ${isOutOfStock && !isSelected ? "opacity-60 bg-slate-50 border-dashed" : ""}`}
                          >
                            {optIdx === 0 && targetVariant?.imageUrl && (
                              <img src={targetVariant.imageUrl} alt={val} className="w-5 h-5 mr-2 rounded-sm object-cover" />
                            )}
                            <span>{val}</span>
                            {isSelected && (
                              <div className="absolute bottom-0 right-0">
                                <svg viewBox="0 0 16 16" className="w-4 h-4 text-emerald-600 fill-current">
                                  <polygon points="16,0 16,16 0,16" />
                                </svg>
                                <Check className="absolute bottom-0 right-0 h-2.5 w-2.5 text-white mb-[1px] mr-[1px]" strokeWidth={4} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex items-start gap-4">
                <label className="text-sm text-slate-500 font-medium min-w-[100px] pt-2">
                  Phân loại
                </label>
                <div className="flex flex-wrap gap-3 flex-1">
                  {productVariants.map((variant) => {
                    const isSelected = selectedVariant?.id === variant.id;
                    const isVariantOutOfStock = (variant.inventory?.quantity ?? 0) <= 0 || variant.status === "OUT_OF_STOCK";
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={variant.status !== "ACTIVE" && variant.status !== "OUT_OF_STOCK"}
                        onClick={() => {
                          setSelectedVariantId(variant.id);
                          if (variant.imageUrl) setSelectedImage(variant.imageUrl);
                        }}
                        className={`relative inline-flex items-center justify-center min-w-[80px] px-3 py-2 text-sm transition-all border bg-white ${
                          isSelected
                            ? "border-emerald-600 text-emerald-600 z-10"
                            : "border-slate-200 text-slate-700 hover:border-slate-300"
                        } ${isVariantOutOfStock && !isSelected ? "opacity-60 bg-slate-50 border-dashed" : ""}`}
                      >
                        <span>{variant.variantName}</span>
                        {isSelected && (
                          <div className="absolute bottom-0 right-0">
                            <svg viewBox="0 0 16 16" className="w-4 h-4 text-emerald-600 fill-current">
                              <polygon points="16,0 16,16 0,16" />
                            </svg>
                            <Check className="absolute bottom-0 right-0 h-2.5 w-2.5 text-white mb-[1px] mr-[1px]" strokeWidth={4} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* QUANTITY STEPPER */}
            <div className="mt-5 flex items-center gap-4">
              <label className="text-sm text-slate-500 font-medium min-w-[100px]">
                Số lượng
              </label>
              <div className="flex items-center gap-4 flex-1">
                <QuantityStepper
                  value={isSelectedVariantOutOfStock ? 0 : Math.max(1, Math.min(quantity, selectedVariant?.inventory?.quantity ?? 1))}
                  onChange={setQuantity}
                  min={isSelectedVariantOutOfStock ? 0 : 1}
                  max={isSelectedVariantOutOfStock ? 0 : (selectedVariant?.inventory?.quantity ?? 1)}
                  disabled={isSelectedVariantOutOfStock}
                />
                <span className="text-sm text-slate-500">
                  {selectedVariant?.inventory?.quantity ?? 0} sản phẩm có sẵn
                  {isSelectedVariantOutOfStock && <span className="ml-2 font-bold text-rose-600">(Hết hàng)</span>}
                </span>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Button
                variant={"outline" as any}
                disabled={
                  addingToCart ||
                  buyingNow ||
                  !selectedVariant ||
                  product.status !== "ACTIVE" ||
                  selectedVariant.status !== "ACTIVE" ||
                  isSelectedVariantOutOfStock
                }
                onClick={handleAddToCart}
                className="flex-1 rounded-xl border-emerald-600 text-emerald-600 hover:bg-emerald-50 py-3 text-sm font-extrabold shadow-sm transition-all disabled:opacity-60"
              >
                {addingToCart ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                    <span>Đang thêm...</span>
                  </div>
                ) : isSelectedVariantOutOfStock ? (
                  <span>Sản Phẩm Hết Hàng</span>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <ShoppingCart className="h-4.5 w-4.5" />
                    <span>Thêm Vào Giỏ</span>
                  </div>
                )}
              </Button>

              <Button
                disabled={
                  addingToCart ||
                  buyingNow ||
                  !selectedVariant ||
                  product.status !== "ACTIVE" ||
                  selectedVariant.status !== "ACTIVE" ||
                  isSelectedVariantOutOfStock
                }
                onClick={handleBuyNow}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-60"
              >
                {buyingNow ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang xử lý...</span>
                  </div>
                ) : isSelectedVariantOutOfStock ? (
                  <span>Sản Phẩm Hết Hàng</span>
                ) : (
                  <span>Mua Ngay</span>
                )}
              </Button>
            </div>

          </div>
        </div>
      </div>

      {/* SHOP CARD */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-shrink-0 border-r-0 md:border-r border-slate-100 pr-0 md:pr-6 w-full md:w-auto">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xl font-black text-slate-600 overflow-hidden">
              {activeShop.logoUrl ? (
                <img src={activeShop.logoUrl} alt={activeShop.shopName} className="h-full w-full object-cover"/>
              ) : (
                activeShop.shopName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <a href={`/shops/${activeShop.shopSlug}`} className="text-base font-bold text-slate-900 hover:text-emerald-600 line-clamp-1 max-w-[200px]">
                {activeShop.shopName}
              </a>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2 md:mt-0 md:ml-4 w-full md:w-auto justify-between md:justify-start">
            <Button
              variant="outline"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-chat-widget', {
                  detail: {
                    shopId: Number(activeShop.id) || activeShop.id,
                    fromProductPage: true,
                    shopInfo: {
                      id: Number(activeShop.id) || activeShop.id,
                      name: activeShop.shopName,
                      avatar: activeShop.logoUrl || null,
                      shop_slug: activeShop.shopSlug,
                    },
                    productDraft: {
                       id: product.id,
                       public_id: product.id,
                       name: product.name,
                       slug: product.slug,
                       shop_slug: activeShop.shopSlug,
                       price: selectedVariant?.price || 0,
                       promotional_price: selectedVariant?.salePrice,
                       images: [{ image_url: activeImageSrc, is_thumbnail: true }],
                       variants: [{
                         price: selectedVariant?.price || 0,
                         sale_price: selectedVariant?.salePrice ?? null
                       }]
                    }
                  }
                }));
              }}
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/30 gap-2 h-9 px-4 text-xs font-bold flex-1 md:flex-none"
            >
              <MessageSquare className="h-4 w-4" />
              Chat Ngay
            </Button>
            <a href={`/shops/${activeShop.shopSlug}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-sm flex-1 md:flex-none">
              <Store className="h-4 w-4" />
              Xem Shop
            </a>
          </div>
        </div>

        <div className="flex-1 flex justify-around w-full gap-4 text-sm mt-4 md:mt-0">
          <div className="flex md:flex-row flex-col md:items-center gap-1 md:gap-4">
            <span className="text-slate-500 whitespace-nowrap">Đánh Giá</span>
            <span className="font-bold text-rose-500">{shopStats.reviews || product.reviewCount || 0}</span>
          </div>
          <div className="flex md:flex-row flex-col md:items-center gap-1 md:gap-4">
            <span className="text-slate-500 whitespace-nowrap">Đã Bán</span>
            <span className="font-bold text-rose-500">{shopStats.totalSold || activeShop.totalSold || 0}</span>
          </div>
          <div className="flex md:flex-row flex-col md:items-center gap-1 md:gap-4">
            <span className="text-slate-500 whitespace-nowrap">Sản Phẩm</span>
            <span className="font-bold text-rose-500">{shopStats.products || 0}</span>
          </div>
          <div className="flex md:flex-row flex-col md:items-center gap-1 md:gap-4">
            <span className="text-slate-500 whitespace-nowrap">Tham Gia</span>
            <span className="font-bold text-rose-500">
              {getJoinDuration(shopStats.approvedAt || activeShop.approvedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* REPORT PANEL IF TOGGLED */}
      {showReport && <ReportProductPanel product={product} onClose={() => setShowReport(false)} />}

      {/* DETAILS PANEL */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <h2 className="font-heading text-base font-medium text-slate-800 bg-slate-50 p-4 rounded-sm uppercase tracking-wide">
          Chi Tiết Sản Phẩm
        </h2>
        <div className="space-y-4 text-sm px-4">
          <div className="flex">
            <div className="w-[150px] sm:w-[200px] text-slate-500 font-medium">Danh Mục</div>
            <div className="flex-1 text-blue-600 flex items-center gap-1.5 flex-wrap">
              <a href="/" className="hover:underline">Shepoo</a>
              {product.categoryIds && product.categoryIds.length > 0 ? (
                product.categoryIds.map((id, index) => {
                  const cat = store.state.categories?.find((c) => c.id === id);
                  if (!cat) return null;
                  return (
                    <Fragment key={id}>
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                      <a href={`/categories/${cat.slug || cat.id}`} className="hover:underline">
                        {cat.name}
                      </a>
                    </Fragment>
                  );
                })
              ) : (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <span>Chưa phân loại</span>
                </>
              )}
            </div>
          </div>
          <div className="flex">
            <div className="w-[150px] sm:w-[200px] text-slate-500 font-medium">Số sản phẩm còn lại</div>
            <div className="flex-1 text-slate-800">
              {totalStock > 0 ? totalStock : "CÒN HÀNG"}
            </div>
          </div>
          <div className="flex">
            <div className="w-[150px] sm:w-[200px] text-slate-500 font-medium">Thương hiệu</div>
            <div className="flex-1 text-slate-800">
              {product.brand || "simple"}
            </div>
          </div>
          <div className="flex">
            <div className="w-[150px] sm:w-[200px] text-slate-500 font-medium">Xuất xứ</div>
            <div className="flex-1 text-slate-800">
              {product.origin || "Việt Nam"}
            </div>
          </div>
          <div className="flex">
            <div className="w-[150px] sm:w-[200px] text-slate-500 font-medium">Bảo hành</div>
            <div className="flex-1 text-slate-800">
              {product.warranty || "12 tháng"}
            </div>
          </div>
          <div className="flex">
            <div className="w-[150px] sm:w-[200px] text-slate-500 font-medium">Vận chuyển</div>
            <div className="flex-1 text-slate-800">
              Giao hàng toàn quốc
            </div>
          </div>
          <div className="flex">
            <div className="w-[150px] sm:w-[200px] text-slate-500 font-medium">Gửi từ</div>
            <div className="flex-1 text-slate-800">
              {activeShop.pickupAddress || "Tỉnh Bắc Ninh"}
            </div>
          </div>
        </div>
      </div>

      {/* DESCRIPTION PANEL */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <h2 className="font-heading text-base font-medium text-slate-800 bg-slate-50 p-4 rounded-sm uppercase tracking-wide">
          Mô Tả Sản Phẩm
        </h2>
        <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-600 space-y-3">
          <p className="font-semibold text-slate-800">{product.shortDescription}</p>
          <div className="whitespace-pre-line text-slate-600 leading-relaxed">
            {product.description}
          </div>
        </div>
      </div>

      {/* REVIEWS PANEL */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-5">
        <h2 className="font-heading text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          <span>Đánh giá sản phẩm</span>
        </h2>
        <ReviewsModule product={product} />
      </div>

      {/* SHOP SIMILAR PRODUCTS */}
      <ShopSimilarProducts productSlug={productSlug} shopSlug={activeShop.shopSlug} />

      {/* SEMANTIC SIMILAR PRODUCTS */}
      <SemanticSimilarProducts productSlug={productSlug} />

    </main>
  );
}

function ReportProductPanel({ product, onClose }: { product: Product; onClose: () => void }) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [reasonType, setReasonType] = useState("Hàng giả / Nhái thương hiệu");
  const [description, setDescription] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setImageFiles((prev) => [...prev, ...newFiles]);
      const newUrls = newFiles.map((f) => URL.createObjectURL(f));
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    }
    // reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => {
      const newUrls = [...prev];
      URL.revokeObjectURL(newUrls[index]);
      newUrls.splice(index, 1);
      return newUrls;
    });
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showToast("Vui lòng nhập mô tả chi tiết nội dung vi phạm", "danger");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Upload images first
      const uploadedUrls: string[] = [];
      const { uploadImage } = await import("@/services/upload-api");
      for (const file of imageFiles) {
        try {
          const url = await uploadImage(file);
          uploadedUrls.push(url);
        } catch (uploadErr) {
          console.error("Lỗi khi upload ảnh:", uploadErr);
        }
      }

      // 2. Submit report
      await store.submitViolationReport({
        productId: product.id,
        reasonType,
        description,
        imageUrls: uploadedUrls
      });
      showToast(`Đã gửi báo cáo vi phạm cho sản phẩm "${product.name}" thành công!`, "success");
      onClose();
    } catch (err: any) {
      showToast("Gửi báo cáo thất bại, vui lòng thử lại.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="report-panel" className="rounded-3xl border border-rose-200/90 bg-rose-50/70 p-6 shadow-sm space-y-4 backdrop-blur-sm transition-all">
      <div className="flex items-center justify-between border-b border-rose-200/60 pb-3">
        <h3 className="text-sm font-black text-rose-900 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <Flag className="h-4 w-4" />
          </span>
          Gửi Báo Cáo Vi Phạm Sản Phẩm
        </h3>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex text-xs font-semibold text-rose-600 bg-rose-100/80 px-2.5 py-1 rounded-full border border-rose-200">
            Bảo mật & Ẩn danh
          </span>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Lý do báo cáo">
          <Select 
            value={reasonType} 
            onChange={(e) => setReasonType(e.target.value)} 
            className="rounded-xl bg-white border-rose-200 focus:border-rose-400 focus:ring-rose-400/20"
          >
            <option value="Hàng giả / Nhái thương hiệu">Hàng giả / Nhái thương hiệu</option>
            <option value="Lừa đảo / Không giao đúng mẫu">Lừa đảo / Không giao đúng mẫu</option>
            <option value="Nội dung không phù hợp">Nội dung không phù hợp</option>
            <option value="Mô tả sai sự thật">Mô tả sai sự thật</option>
            <option value="Khác">Khác</option>
          </Select>
        </Field>

        <div className="md:col-span-3">
          <label className="text-xs font-bold text-slate-700 mb-2 block">
            Hình ảnh bằng chứng
          </label>
          <div className="flex flex-wrap gap-3">
            {previewUrls.map((url, idx) => (
              <div key={idx} className="relative h-20 w-20 shrink-0 rounded-xl overflow-hidden border border-rose-200 bg-white group">
                <button 
                  type="button"
                  onClick={() => {
                    setPreviewIndex(idx);
                    setPreviewImage(url);
                  }}
                  className="h-full w-full block cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Bằng chứng" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 h-6 w-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 hover:text-rose-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
            
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-500 transition-colors">
              <Plus className="h-6 w-6" />
              <span className="text-[10px] font-bold mt-1">Tải ảnh</span>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="hidden" 
              />
            </label>
          </div>
        </div>

        {previewImage && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {previewUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = (previewIndex - 1 + previewUrls.length) % previewUrls.length;
                    setPreviewIndex(next);
                    setPreviewImage(previewUrls[next]);
                  }}
                  className="absolute left-4 md:left-8 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = (previewIndex + 1) % previewUrls.length;
                    setPreviewIndex(next);
                    setPreviewImage(previewUrls[next]);
                  }}
                  className="absolute right-4 md:right-8 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <img
              src={previewImage}
              alt="Ảnh bằng chứng"
              className="max-h-[90vh] max-w-[min(96vw,56rem)] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}

        <div className="md:col-span-3">
          <Field label="Mô tả chi tiết nội dung vi phạm">
            <Textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả cụ thể lý do hoặc hành vi vi phạm mà bạn phát hiện..." 
              className="rounded-xl bg-white border-rose-200 focus:border-rose-400 focus:ring-rose-400/20 min-h-[90px]" 
            />
          </Field>
        </div>

        <div className="md:col-span-3 pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto px-6 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            onClick={onClose}
          >
            Hủy Bỏ
          </Button>
          <Button
            type="button"
            disabled={submitting}
            className="w-full sm:w-auto px-8 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 active:scale-[0.98] transition-all shadow-sm shadow-rose-600/20"
            onClick={handleSubmit}
          >
            {submitting ? "Đang gửi..." : "Gửi Báo Cáo"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewsModule({ product }: { product?: Product }) {
  const REVIEWS_PER_PAGE = 10;
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [page, setPage] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);

  const [activeFilter, setActiveFilter] = useState<"ALL" | "WITH_IMAGE" | "RATING" | "VARIANT">("ALL");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<number, string>>({});
  const [openDropdown, setOpenDropdown] = useState<"RATING" | "VARIANT" | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const ratingDropdownRef = useRef<HTMLDivElement>(null);
  const variantDropdownRef = useRef<HTMLDivElement>(null);

  const variantOptions = (product?.variantOptions ?? [])
    .map((optGroup: { name?: string; values?: string[]; options?: string[] }) => ({
      name: optGroup.name ?? "",
      values: (optGroup.values ?? optGroup.options ?? []).filter(Boolean)
    }))
    .filter((g) => g.name && g.values.length > 0);

  const selectedVariantLabel = Object.keys(selectedVariants)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => selectedVariants[Number(key)])
    .join(" - ");

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        ratingDropdownRef.current?.contains(target) ||
        variantDropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpenDropdown(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!previewImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewImage(null);
        return;
      }
      if (previewImages.length <= 1) return;
      if (event.key === "ArrowRight") {
        setPreviewIndex((prev) => {
          const next = (prev + 1) % previewImages.length;
          setPreviewImage(previewImages[next]);
          return next;
        });
      }
      if (event.key === "ArrowLeft") {
        setPreviewIndex((prev) => {
          const next = (prev - 1 + previewImages.length) % previewImages.length;
          setPreviewImage(previewImages[next]);
          return next;
        });
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [previewImage, previewImages]);

  useEffect(() => {
    if (!product?.id) {
      setLoadingReviews(false);
      return;
    }

    let isMounted = true;
    setLoadingReviews(true);

    let variantNameQuery = undefined;
    if (activeFilter === "VARIANT" && selectedVariantLabel) {
      variantNameQuery = selectedVariantLabel;
    }

    fetchProductReviewsApi(
      product.id,
      page,
      REVIEWS_PER_PAGE,
      activeFilter === "RATING" && selectedRating ? selectedRating : undefined,
      activeFilter === "WITH_IMAGE" ? true : undefined,
      variantNameQuery
    )
      .then((res) => {
        if (isMounted && res?.items) {
          setReviews(res.items);
          setTotalReviews(res.total ?? 0);
        }
      })
      .catch(() => {
        if (isMounted) {
          setReviews([]);
          setTotalReviews(0);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingReviews(false);
      });
    return () => {
      isMounted = false;
    };
  }, [product?.id, activeFilter, selectedRating, selectedVariantLabel, page]);

  const totalPages = Math.max(1, Math.ceil(totalReviews / REVIEWS_PER_PAGE));

  const getPageNumbers = (): Array<number | "ellipsis"> => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 3) return [1, 2, 3, 4, "ellipsis", totalPages];
    if (page >= totalPages - 2) {
      return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
  };

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(1, nextPage), totalPages));
  };

  const resetToFirstPage = () => setPage(1);

  const filterChipClass = (active: boolean) =>
    cn(
      "px-4 py-2 text-xs font-semibold rounded-full border transition-colors inline-flex items-center gap-1.5",
      active
        ? "bg-rose-500 text-white border-rose-500"
        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
    );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveFilter("ALL");
            setOpenDropdown(null);
            setSelectedRating(null);
            setSelectedVariants({});
            resetToFirstPage();
          }}
          className={filterChipClass(activeFilter === "ALL")}
        >
          Tất cả
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveFilter("WITH_IMAGE");
            setOpenDropdown(null);
            resetToFirstPage();
          }}
          className={filterChipClass(activeFilter === "WITH_IMAGE")}
        >
          Có hình ảnh
        </button>

        <div className="relative" ref={ratingDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setOpenDropdown((prev) => (prev === "RATING" ? null : "RATING"));
            }}
            className={filterChipClass(activeFilter === "RATING" && selectedRating != null)}
            aria-haspopup="listbox"
            aria-expanded={openDropdown === "RATING"}
          >
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>
              Sao
              {activeFilter === "RATING" && selectedRating ? ` (${selectedRating})` : ""}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                openDropdown === "RATING" && "rotate-180",
                activeFilter === "RATING" && selectedRating != null
                  ? "text-white/90"
                  : "text-slate-400"
              )}
            />
          </button>
          {openDropdown === "RATING" && (
            <div
              role="listbox"
              className="absolute top-full mt-2 left-0 min-w-[9.5rem] bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 z-20"
            >
              {[5, 4, 3, 2, 1].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="option"
                  aria-selected={selectedRating === star}
                  onClick={() => {
                    setSelectedRating(star);
                    setActiveFilter("RATING");
                    setOpenDropdown(null);
                    resetToFirstPage();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    selectedRating === star
                      ? "text-rose-600 bg-rose-50"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {Array.from({ length: star }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </span>
                  <span>{star} Sao</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {variantOptions.length > 0 && (
          <div className="relative" ref={variantDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setOpenDropdown((prev) => (prev === "VARIANT" ? null : "VARIANT"));
              }}
              className={filterChipClass(activeFilter === "VARIANT" && !!selectedVariantLabel)}
              aria-haspopup="listbox"
              aria-expanded={openDropdown === "VARIANT"}
            >
              <span className="max-w-[12rem] truncate">
                Phân loại
                {activeFilter === "VARIANT" && selectedVariantLabel
                  ? `: ${selectedVariantLabel}`
                  : ""}
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform",
                  openDropdown === "VARIANT" && "rotate-180",
                  activeFilter === "VARIANT" && selectedVariantLabel
                    ? "text-white/90"
                    : "text-slate-400"
                )}
              />
            </button>
            {openDropdown === "VARIANT" && (
              <div className="absolute top-full mt-2 left-0 w-72 max-w-[min(18rem,calc(100vw-2rem))] bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-20">
                <div className="space-y-3">
                  {variantOptions.map((optGroup, gIndex) => (
                    <div key={`${optGroup.name}-${gIndex}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        {optGroup.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {optGroup.values.map((opt) => {
                          const isSelected = selectedVariants[gIndex] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                const next = { ...selectedVariants };
                                if (isSelected) delete next[gIndex];
                                else next[gIndex] = opt;

                                setSelectedVariants(next);
                                if (Object.keys(next).length > 0) {
                                  setActiveFilter("VARIANT");
                                } else if (activeFilter === "VARIANT") {
                                  setActiveFilter("ALL");
                                }
                                resetToFirstPage();
                              }}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                                isSelected
                                  ? "border-rose-500 text-rose-600 bg-rose-50"
                                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                              )}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {Object.keys(selectedVariants).length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVariants({});
                      setActiveFilter("ALL");
                      resetToFirstPage();
                    }}
                    className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Xóa lựa chọn phân loại
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading & Empty State */}
      {loadingReviews ? (
        <div className="py-8 text-center text-xs font-semibold text-slate-400">
          Đang tải danh sách đánh giá...
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-3xl bg-slate-50">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <MessageSquare className="h-6 w-6 text-slate-300" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Không tìm thấy đánh giá</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
            Không có đánh giá nào phù hợp với bộ lọc bạn đã chọn.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div key={rev.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-bold text-white text-xs shadow-xs">
                    {rev.user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{rev.user?.full_name || "Khách hàng"}</p>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                      {formatDate(rev.created_at)}
                      {rev.variant_name ? (
                        <>
                          <span className="mx-1.5 text-slate-300">|</span>
                          <span>Phân loại: {rev.variant_name}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                <RatingStars rating={rev.rating} />
              </div>

              {rev.comment && (
                <p className="text-sm text-slate-700 leading-relaxed pl-12">
                  {rev.comment}
                </p>
              )}

              {rev.images && rev.images.length > 0 && (
                <div className="pl-12 flex gap-2 overflow-x-auto pb-2">
                  {rev.images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPreviewImages(rev.images || []);
                        setPreviewIndex(i);
                        setPreviewImage(img);
                      }}
                      className="shrink-0 rounded-lg border border-slate-200 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    >
                      <img
                        src={img}
                        alt={`Ảnh đánh giá ${i + 1}`}
                        className="h-16 w-16 object-cover transition hover:opacity-90 cursor-zoom-in"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {totalReviews > REVIEWS_PER_PAGE && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500">
                Hiển thị {(page - 1) * REVIEWS_PER_PAGE + 1}
                {" - "}
                {Math.min(page * REVIEWS_PER_PAGE, totalReviews)} / {totalReviews} đánh giá
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page === 1 || loadingReviews}
                  onClick={() => goToPage(page - 1)}
                  className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Trước
                </button>
                <div className="hidden sm:flex items-center gap-1">
                  {getPageNumbers().map((p, idx) =>
                    p === "ellipsis" ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        disabled={loadingReviews}
                        onClick={() => goToPage(p)}
                        className={cn(
                          "h-9 w-9 rounded-xl text-xs font-bold transition-colors",
                          page === p
                            ? "bg-rose-500 text-white"
                            : "text-slate-700 hover:bg-slate-50 border border-slate-200"
                        )}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>
                <span className="sm:hidden text-xs font-semibold text-slate-600 px-2">
                  {page}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages || loadingReviews}
                  onClick={() => goToPage(page + 1)}
                  className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh đánh giá"
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>

          {previewImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = (previewIndex - 1 + previewImages.length) % previewImages.length;
                  setPreviewIndex(next);
                  setPreviewImage(previewImages[next]);
                }}
                className="absolute left-3 md:left-6 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = (previewIndex + 1) % previewImages.length;
                  setPreviewIndex(next);
                  setPreviewImage(previewImages[next]);
                }}
                className="absolute right-3 md:right-6 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Ảnh sau"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <img
            src={previewImage}
            alt="Ảnh đánh giá phóng to"
            className="max-h-[90vh] max-w-[min(96vw,56rem)] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

