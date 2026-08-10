"use client";

import { useState, useEffect } from "react";
import { Check, CheckCircle2, Clock, Minus, PackageCheck, Plus, ShoppingBag, Star, Store, Truck, XCircle } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import Link from "next/link";
import { Panel } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatVnd,
  getPrimaryVariant,
  getProductPriceRange,
  getProductVariants,
  orderStatusLabel,
  productStatusLabel,
  sellerStatusLabel
} from "@/lib/helpers";
import type { Category, Order, OrderStatus, Product, ProductVariant, Shop } from "@/types/models";

export function PriceDisplay({
  price,
  salePrice,
  compact,
  className
}: {
  price: number;
  salePrice?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", compact && "gap-1", className)}>
      <span className={cn("font-bold text-coral", compact ? "text-sm" : "text-lg")}>{formatVnd(salePrice ?? price)}</span>
      {salePrice ? <span className="text-xs text-muted line-through">{formatVnd(price)}</span> : null}
    </div>
  );
}

export function RatingStars({ rating, count }: { rating: number; count?: number }) {
  if (count === 0) {
    return <span className="text-xs text-slate-400">Chưa có đánh giá</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="inline-flex items-center gap-0.5" aria-label={`Đánh giá ${rating.toFixed(1)} trên 5 sao`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const fillPercentage = Math.max(0, Math.min(100, (rating - (star - 1)) * 100));
          return (
            <span
              key={star}
              aria-hidden="true"
              style={{
                fontSize: "15px",
                lineHeight: 1,
                backgroundImage: `linear-gradient(90deg, #f59e0b ${fillPercentage}%, #cbd5e1 ${fillPercentage}%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: "inline-block"
              }}
            >
              ★
            </span>
          );
        })}
      </span>
      <span className="font-bold text-amber-600 ml-0.5">{rating.toFixed(1)}</span>
    </span>
  );
}

export function ProductCard({
  product,
  variants,
  shop,
  categories = [],
  onAdd,
  className
}: {
  product: Product;
  variants: ProductVariant[];
  shop?: Shop;
  categories?: Category[];
  onAdd?: (variantId: string) => void;
  className?: string;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const primaryVariant = getPrimaryVariant(product, variants);
  const priceRange = getProductPriceRange(product, variants);
  const category = categories.find((item) => product.categoryIds.includes(item.id));
  const href = `/shops/${shop?.shopSlug || "shop"}/products/${product.slug}`;

  const productVariants = getProductVariants(product, variants);
  const totalStock = productVariants.reduce((sum: number, v: ProductVariant) => sum + (v.inventory?.quantity ?? 0), 0);
  const isOutOfStock =
    product.status === "OUT_OF_STOCK" ||
    (productVariants.length > 0 ? totalStock <= 0 : (primaryVariant?.inventory?.quantity ?? 1) <= 0);

  return (
    <article className={cn("group hover-lift overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-all duration-300 hover:border-slate-300 hover:shadow-xl relative", isOutOfStock && "bg-slate-50/60", className)}>
      <Link href={href} className="block">
        <div className={cn("relative aspect-square overflow-hidden bg-slate-100", !imageLoaded && "animate-pulse")}>
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={cn(
              "h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-110",
              isOutOfStock && "opacity-60",
              !imageLoaded ? "opacity-0" : "opacity-100"
            )}
          />
          {isOutOfStock && (
            <span className="absolute top-2.5 left-2.5 z-30 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-md opacity-100">
              Hết hàng
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
        <div className={cn("space-y-2 p-2.5 transition-opacity", isOutOfStock && "opacity-60")}>
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-800 group-hover:text-emerald-700 transition-colors duration-200">{product.name}</h3>

          {shop ? (
            <p className="flex items-center gap-1 truncate text-xs text-slate-500">
              <Store className="h-3.5 w-3.5 text-emerald-600 group-hover:scale-110 transition-transform duration-200" aria-hidden="true" />
              {shop.shopName}
            </p>
          ) : null}
          <PriceDisplay price={priceRange.min} salePrice={primaryVariant?.salePrice} compact />
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <RatingStars rating={product.averageRating} count={product.reviewCount} />
            <span className="text-xs font-semibold text-slate-600">Đã bán <span className="text-emerald-600 font-bold">{product.soldCount.toLocaleString("vi-VN")}</span></span>
          </div>
        </div>
      </Link>
      {primaryVariant && onAdd ? (
        <div className={cn("border-t border-slate-100 p-3 bg-slate-50/50 transition-opacity", isOutOfStock && "opacity-60")}>
          <Button
            className="w-full"
            variant="secondary"
            disabled={isOutOfStock || product.status !== "ACTIVE" || primaryVariant.status !== "ACTIVE"}
            onClick={() => {
              const variantId = primaryVariant.id === "es-dummy" ? product.id : primaryVariant.id;
              onAdd(variantId);
            }}
          >
            {isOutOfStock ? "Hết hàng" : "Thêm giỏ"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link
      href={`/shops/${shop.shopSlug}`}
      className="group hover-lift block rounded-2xl border border-slate-200/90 bg-white p-4 transition-all duration-300 hover:border-slate-300 hover:shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="relative overflow-hidden rounded-xl">
          <img src={shop.logoUrl} alt={shop.shopName} className="h-14 w-14 object-cover transition-transform duration-500 group-hover:scale-110" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{shop.shopName}</h3>
            <StatusBadge status={shop.status} label={sellerStatusLabel[shop.status]} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{shop.description}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 p-2.5 transition-colors group-hover:bg-emerald-50/50">
          <p className="text-xs font-semibold text-slate-400">Đã bán</p>
          <p className="font-bold text-slate-900">{shop.totalSold.toLocaleString("vi-VN")}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5 transition-colors group-hover:bg-emerald-50/50">
          <p className="text-xs font-semibold text-slate-400">Phí ship</p>
          <p className="font-bold text-slate-900">{formatVnd(shop.shippingFee)}</p>
        </div>
      </div>
    </Link>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const text = e.target.value.replace(/[^0-9]/g, "");
    setInputValue(text);
    if (text !== "") {
      let num = parseInt(text, 10);
      if (num > max) {
        num = max;
        setInputValue(String(num));
      }
      onChange(num);
    }
  };

  const handleBlur = () => {
    if (disabled) return;
    let num = parseInt(inputValue, 10);
    if (isNaN(num) || num < min) num = min;
    if (num > max) num = max;
    setInputValue(String(num));
    onChange(num);
  };

  return (
    <div className={`inline-flex h-10 items-center overflow-hidden rounded-panel border border-line bg-white ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}>
      <IconButton
        aria-label="Giảm số lượng"
        className="h-10 w-10 rounded-none border-0"
        onClick={() => !disabled && onChange(Math.max(min, value - 1))}
        disabled={disabled}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </IconButton>
      <input
        type="text"
        className="h-10 w-12 border-x border-line bg-transparent px-1 text-center text-sm font-bold outline-none"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
      />
      <IconButton
        aria-label="Tăng số lượng"
        className="h-10 w-10 rounded-none border-0"
        onClick={() => !disabled && onChange(Math.min(max, value + 1))}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </div>
  );
}

export function OrderProgressStepper({ order }: { order: Order }) {
  const status = order.orderStatus;
  if (status === "CANCELLED") {
    const cancelledEntry = order.timeline.find(t => t.newStatus === "CANCELLED");
    const cancelledTime = cancelledEntry ? formatDate(cancelledEntry.createdAt) : (order.cancelledAt ? formatDate(order.cancelledAt) : null);
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-red-800">
        <div className="flex items-center gap-3">
          <XCircle className="h-6 w-6 shrink-0 text-red-600" />
          <div>
            <h4 className="font-bold text-sm text-red-900">Đơn hàng đã bị hủy</h4>
            <p className="text-xs text-red-700 mt-0.5">
              Đơn hàng này đã được hủy thành công. Nếu có thắc mắc hoặc cần hỗ trợ, vui lòng liên hệ Bộ phận Chăm sóc khách hàng.
            </p>
            {cancelledTime && (
              <p className="text-[11px] font-medium text-red-600 mt-1">Thời gian hủy: {cancelledTime}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { key: "PLACED", label: "Đơn hàng đã đặt", icon: ShoppingBag },
    { key: "CONFIRMED", label: "Đã xác nhận", icon: CheckCircle2 },
    { key: "SHIPPING", label: "Đang giao hàng", icon: Truck },
    { key: "COMPLETED", label: "Hoàn thành", icon: PackageCheck },
  ];

  const statusMap: Record<string, number> = {
    PLACED: 0,
    CONFIRMED: 1,
    SHIPPING: 2,
    COMPLETED: 3,
  };

  const currentStep = statusMap[status] ?? 0;

  return (
    <div className="w-full py-2">
      <div className="relative">
        {/* Background Connecting Line (Centered behind step buttons) */}
        <div className="absolute left-[12.5%] right-[12.5%] top-5 -translate-y-1/2 h-1 bg-slate-200 z-0">
          <div
            className="h-full bg-emerald-600 transition-all duration-500"
            style={{
              width: `${(currentStep / (steps.length - 1)) * 100}%`,
            }}
          />
        </div>

        {/* Step Buttons and Labels */}
        <div className="relative z-10 flex items-start justify-between">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isPassed = idx <= currentStep;
            const isCurrent = idx === currentStep;

            const timelineEntry = order.timeline.find((t) => t.newStatus === step.key);
            let timestamp = timelineEntry ? formatDate(timelineEntry.createdAt) : null;
            if (!timestamp && step.key === "PLACED") {
              timestamp = formatDate(order.createdAt);
            }

            return (
              <div key={step.key} className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 shadow-sm",
                    isPassed
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-400",
                    isCurrent && "ring-4 ring-emerald-100 scale-105"
                  )}
                >
                  {isPassed && idx < currentStep ? (
                    <Check className="h-5 w-5 stroke-[3]" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-semibold text-center transition-colors max-w-[110px]",
                    isCurrent
                      ? "text-emerald-700 font-bold"
                      : isPassed
                      ? "text-slate-800"
                      : "text-slate-400"
                  )}
                >
                  {step.label}
                </span>
                {isPassed && timestamp && (
                  <span className="mt-0.5 text-[10px] font-medium text-slate-500 text-center max-w-[110px] leading-tight">
                    {timestamp}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function OrderTimeline({ order }: { order: Order }) {
  return (
    <ol className="relative border-l border-slate-200 ml-3 space-y-4 py-1">
      {order.timeline.map((entry, index) => {
        const isLatest = index === 0;
        return (
          <li key={entry.id} className="ml-6 relative">
            <span
              className={cn(
                "absolute -left-[31px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white",
                isLatest ? "bg-emerald-600" : "bg-slate-300"
              )}
            />
            <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-md", isLatest ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700")}>
                  {orderStatusLabel[entry.newStatus]}
                </span>
                <span className="text-[11px] font-medium text-slate-400">{formatDate(entry.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 font-medium leading-relaxed">{entry.note}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Panel className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </Panel>
  );
}
