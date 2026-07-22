"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ShoppingCart,
  ShieldCheck,
  PackageCheck,
  Eye,
  Star,
  Flag,
  ChevronRight,
  Check,
  Info,
  Tag
} from "lucide-react";
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
import { fetchProductDetail } from "@/services/product-api";
import { fetchProductReviewsApi, ProductReview } from "@/services/review-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import NotFoundPage from "@/components/shared/not-found-page";
import type { Product, ProductVariant, Shop } from "@/types/models";

export default function ProductDetailPage() {
  const params = useParams();
  const shopSlug = typeof params.shopSlug === "string" ? params.shopSlug : "";
  const productSlug = typeof params.productSlug === "string" ? params.productSlug : "";

  const store = useMarketplaceStore();
  const { showToast } = store;

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [showReport, setShowReport] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [shop, setShop] = useState<Shop | undefined>(undefined);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadDetail = async () => {
      if (!shopSlug || !productSlug) return;
      setLoading(true);
      const res = await fetchProductDetail(shopSlug, productSlug);
      if (isMounted) {
        if (res.ok && res.product) {
          setProduct(res.product);
          setProductVariants(res.variants!);
          setShop(res.shop);
          setSelectedVariantId(res.variants![0]?.id ?? "");
          setSelectedImage(res.product.thumbnailUrl);
          store.saveProduct(res.product, res.variants!);
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
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Đang tải chi tiết sản phẩm...</p>
      </main>
    );
  }

  if (!shop || !product) return <NotFoundPage />;
  
  const selectedVariant = productVariants.find((variant) => variant.id === selectedVariantId) ?? productVariants[0];

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
    setAddingToCart(true);
    try {
      const result = await store.addToCart(selectedVariant.id, quantity);
      showToast(result.message, result.ok ? "success" : "danger");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 bg-canvas min-h-screen">
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <a href="/" className="hover:text-emerald-700 transition-colors">Trang chủ</a>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <a href={`/shops/${shop.shopSlug}`} className="hover:text-emerald-700 transition-colors">{shop.shopName}</a>
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
              className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            />
            {product.status === "OUT_OF_STOCK" && (
              <div className="absolute top-3 left-3">
                <StatusBadge status="OUT_OF_STOCK" label="Hết hàng" />
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

          {/* SHOP CARD STRIP */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-extrabold text-white text-sm">
                {shop.shopName.charAt(0).toUpperCase()}
              </div>
              <div>
                <a href={`/shops/${shop.shopSlug}`} className="text-xs font-extrabold text-slate-900 hover:text-emerald-700 flex items-center gap-1.5">
                  <span>{shop.shopName}</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                </a>
                <p className="text-[11px] text-slate-500 mt-0.5">Gian hàng chính hãng Verified</p>
              </div>
            </div>
            <a
              href={`/shops/${shop.shopSlug}`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 transition-colors shadow-2xs"
            >
              Xem Shop
            </a>
          </div>
        </div>

        {/* RIGHT INFO (Col 7) */}
        <div className="lg:col-span-7 mt-6 lg:mt-0 flex flex-col justify-between space-y-5">
          <div>
            {/* TAGS & CATEGORY */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
                <Tag className="h-3 w-3" />
                {getCategoryNames(store.state.categories, product) || "Sản phẩm Shepoo"}
              </span>
            </div>

            {/* TITLE */}
            <h1 className="mt-2.5 font-heading text-xl sm:text-2xl font-black text-slate-900 leading-snug">
              {product.name}
            </h1>

            {/* STATS BAR */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 border-b border-slate-100 pb-4">
              <RatingStars rating={product.averageRating} count={product.reviewCount} />
              <span className="h-3 w-px bg-slate-200" />
              <span className="flex items-center gap-1 text-slate-700">
                <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
                Đã bán <strong className="text-slate-900">{product.soldCount}</strong>
              </span>
              <span className="h-3 w-px bg-slate-200" />
              <span className="flex items-center gap-1 text-slate-700">
                <Eye className="h-3.5 w-3.5 text-slate-400" />
                {product.viewCount.toLocaleString("vi-VN")} lượt xem
              </span>
            </div>

            {/* PRICE CONTAINER */}
            <div className="mt-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 p-4">
              <div className="flex items-baseline gap-3">
                <PriceDisplay
                  price={selectedVariant?.price ?? 0}
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
            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Chọn biến thể:
              </label>
              <div className="flex flex-wrap gap-2">
                {productVariants.map((variant) => {
                  const isSelected = selectedVariant.id === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={variant.status !== "ACTIVE"}
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        if (variant.imageUrl) setSelectedImage(variant.imageUrl);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all border ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/80 text-emerald-800 ring-2 ring-emerald-600/20 shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      <span>{variant.variantName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QUANTITY STEPPER */}
            <div className="mt-5 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Số lượng mua:
              </label>
              <div className="flex items-center gap-4">
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  max={selectedVariant?.inventory.quantity ?? 1}
                />
                <span className="text-xs font-medium text-slate-500">
                  Kho còn: <strong className="text-slate-900">{selectedVariant?.inventory.quantity ?? 0}</strong> sản phẩm
                </span>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  addingToCart ||
                  !selectedVariant ||
                  product.status !== "ACTIVE" ||
                  selectedVariant.status !== "ACTIVE" ||
                  (selectedVariant?.inventory.quantity ?? 0) <= 0
                }
                onClick={handleAddToCart}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-60"
              >
                {addingToCart ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang thêm...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <ShoppingCart className="h-4.5 w-4.5" />
                    <span>Thêm Vào Giỏ Hàng</span>
                  </div>
                )}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setShowReport((v) => !v)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-100"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>Báo cáo</span>
              </Button>
            </div>

            {/* SPECIFICATIONS GRID */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <span className="text-slate-400 font-medium">Thương hiệu:</span>
                <p className="font-bold text-slate-800 mt-0.5 truncate">{product.brand || "Chính hãng"}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <span className="text-slate-400 font-medium">Xuất xứ:</span>
                <p className="font-bold text-slate-800 mt-0.5 truncate">{product.origin || "Việt Nam"}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <span className="text-slate-400 font-medium">Bảo hành:</span>
                <p className="font-bold text-slate-800 mt-0.5 truncate">{product.warranty || "12 tháng"}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <span className="text-slate-400 font-medium">Vận chuyển:</span>
                <p className="font-bold text-slate-800 mt-0.5 truncate">Giao hàng toàn quốc</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* REPORT PANEL IF TOGGLED */}
      {showReport && <ReportProductPanel product={product} />}

      {/* DESCRIPTION PANEL */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <h2 className="font-heading text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Info className="h-5 w-5 text-emerald-600" />
          <span>Mô Tả Sản Phẩm</span>
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
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <span>Đánh Giá Khách Hàng</span>
        </h2>
        <ReviewsModule product={product} />
      </div>
    </main>
  );

  function ReportProductPanel({ product }: { product: Product }) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-amber-900 flex items-center gap-2">
          <Flag className="h-4 w-4 text-amber-600" />
          Gửi Báo Cáo Vi Phạm Cho Sản Phẩm này
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Lý do báo cáo">
            <Select className="rounded-xl bg-white border-slate-200">
              <option>Hàng giả / Nhái thương hiệu</option>
              <option>Lừa đảo / Không giao đúng mẫu</option>
              <option>Nội dung không phù hợp</option>
              <option>Mô tả sai sự thật</option>
              <option>Khác</option>
            </Select>
          </Field>
          <Field label="Ảnh chứng minh">
            <Input type="file" className="rounded-xl bg-white border-slate-200" />
          </Field>
          <div className="flex items-end">
            <Button
              className="w-full rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700"
              onClick={() => {
                showToast(`Đã gửi báo cáo cho sản phẩm ${product.name}`, "success");
                setShowReport(false);
              }}
            >
              Gửi Báo Cáo
            </Button>
          </div>
          <div className="md:col-span-3">
            <Field label="Mô tả chi tiết nội dung vi phạm">
              <Textarea placeholder="Mô tả cụ thể vấn đề bạn phát hiện..." className="rounded-xl bg-white border-slate-200" />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function ReviewsModule({ product }: { product?: Product }) {
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    useEffect(() => {
      if (!product?.id) {
        setLoadingReviews(false);
        return;
      }

      let isMounted = true;
      setLoadingReviews(true);
      fetchProductReviewsApi(product.id)
        .then((res) => {
          if (isMounted && res?.items) {
            setReviews(res.items);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingReviews(false);
        });
      return () => { isMounted = false; };
    }, [product?.id]);

    if (loadingReviews) {
      return (
        <div className="py-8 text-center text-xs font-semibold text-slate-400">
          Đang tải danh sách đánh giá...
        </div>
      );
    }

    if (!reviews.length) {
      return (
        <EmptyState
          title="Chưa có đánh giá nào"
          description="Sản phẩm này chưa có đánh giá nào từ người mua hàng."
        />
      );
    }

    return (
      <div className="space-y-4">
        {reviews.map((rev) => (
          <div key={rev.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-bold text-white text-xs shadow-xs">
                  {rev.user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">{rev.user?.full_name || "Khách hàng"}</p>
                  <p className="text-[11px] font-medium text-slate-400">{formatDate(rev.created_at)}</p>
                </div>
              </div>
              <RatingStars rating={rev.rating} />
            </div>

            {rev.comment && (
              <p className="text-xs text-slate-700 leading-relaxed pl-12">
                {rev.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }
}

