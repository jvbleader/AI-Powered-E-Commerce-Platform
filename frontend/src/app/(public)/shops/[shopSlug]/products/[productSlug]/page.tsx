"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ShoppingCart,
  ShieldCheck,
  PackageCheck,
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
  console.log("[DEBUG ProductDetailPage] params:", params);
  const shopSlug = typeof params?.shopSlug === "string" ? params.shopSlug : "shop";
  const productSlug = typeof params?.productSlug === "string" ? params.productSlug : "";

  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [showReport, setShowReport] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  
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

  if (!product) return <NotFoundPage />;

  const activeShop: Shop = shop || {
    id: shopSlug || "shop",
    userId: "",
    shopName: "Cửa hàng",
    shopSlug: shopSlug || "shop",
    logoUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=240&q=80",
    description: "",
    phone: "",
    email: "",
    pickupAddress: "",
    shippingFee: 0,
    shippingProviderName: "Giao hàng nhanh",
    status: "APPROVED",
    totalSold: 0,
    totalRevenue: 0
  };
  
  const selectedVariant = productVariants.find((variant) => variant.id === selectedVariantId) ?? productVariants[0];

  const totalStock = productVariants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0);
  const isSelectedVariantOutOfStock = (selectedVariant?.inventory?.quantity ?? 0) <= 0 || selectedVariant?.status === "OUT_OF_STOCK";
  const isProductOutOfStock = product.status === "OUT_OF_STOCK" || (productVariants.length > 0 && totalStock <= 0);

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
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 bg-canvas min-h-screen">
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <a href="/" className="hover:text-emerald-700 transition-colors">Trang chủ</a>
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

          {/* SHOP CARD STRIP */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-extrabold text-white text-sm">
                {activeShop.shopName.charAt(0).toUpperCase()}
              </div>
              <div>
                <a href={`/shops/${activeShop.shopSlug}`} className="text-xs font-extrabold text-slate-900 hover:text-emerald-700 flex items-center gap-1.5">
                  <span>{activeShop.shopName}</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                </a>
                <p className="text-[11px] text-slate-500 mt-0.5">Gian hàng chính hãng Verified</p>
              </div>
            </div>
            <a
              href={`/shops/${activeShop.shopSlug}`}
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
              {(isProductOutOfStock || isSelectedVariantOutOfStock) && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-extrabold text-rose-700">
                  Hết hàng
                </span>
              )}
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
                  const isVariantOutOfStock = (variant.inventory?.quantity ?? 0) <= 0 || variant.status === "OUT_OF_STOCK";
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
                      } ${isVariantOutOfStock ? "opacity-60 bg-slate-50" : ""}`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      <span>{variant.variantName}</span>
                      {isVariantOutOfStock && (
                        <span className="ml-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                          Hết hàng
                        </span>
                      )}
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
                  Kho còn: <strong className={isSelectedVariantOutOfStock ? "text-rose-600 font-bold" : "text-slate-900"}>{selectedVariant?.inventory?.quantity ?? 0}</strong> sản phẩm
                  {isSelectedVariantOutOfStock && <span className="ml-2 font-extrabold text-rose-600">(Hết hàng)</span>}
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

              <Button
                variant={"outline" as any}
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
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-100"
              >
                <Flag className="h-3.5 w-3.5" />
                <span className="sm:hidden">Báo cáo</span>
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
      {showReport && <ReportProductPanel product={product} onClose={() => setShowReport(false)} />}

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
          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          <span>Đánh Giá Khách Hàng</span>
        </h2>
        <ReviewsModule product={product} />
      </div>
    </main>
  );
}

function ReportProductPanel({ product, onClose }: { product: Product; onClose: () => void }) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [reasonType, setReasonType] = useState("Hàng giả / Nhái thương hiệu");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Create mock/preview URLs for uploaded image evidence
      const newUrls = Array.from(files).map((f) => URL.createObjectURL(f));
      setImages((prev) => [...prev, ...newUrls]);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showToast("Vui lòng nhập mô tả chi tiết nội dung vi phạm", "danger");
      return;
    }
    setSubmitting(true);
    try {
      await store.submitViolationReport({
        productId: product.id,
        reasonType,
        description,
        imageUrls: images
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
        <span className="text-xs font-semibold text-rose-600 bg-rose-100/80 px-2.5 py-1 rounded-full border border-rose-200">
          Bảo mật & Ẩn danh
        </span>
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

        <Field label="Hình ảnh bằng chứng">
          <Input 
            type="file" 
            multiple 
            accept="image/*" 
            onChange={handleImageUpload} 
            className="rounded-xl bg-white border-rose-200 focus:border-rose-400 text-xs" 
          />
        </Field>

        <div className="flex items-end">
          <Button
            disabled={submitting}
            className="w-full rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 active:scale-[0.98] transition-all shadow-sm shadow-rose-600/20"
            onClick={handleSubmit}
          >
            {submitting ? "Đang gửi..." : "Gửi Báo Cáo"}
          </Button>
        </div>

        {images.length > 0 && (
          <div className="md:col-span-3 flex gap-2 overflow-x-auto py-1">
            {images.map((url, idx) => (
              <div key={idx} className="relative h-14 w-14 rounded-lg overflow-hidden border border-rose-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Bằng chứng" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
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

