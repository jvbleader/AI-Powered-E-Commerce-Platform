"use client";

import { Minus, Plus, Star, Store } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatVnd,
  getPrimaryVariant,
  getProductPriceRange,
  orderStatusLabel,
  productStatusLabel,
  sellerStatusLabel
} from "@/lib/helpers";
import type { Category, Order, Product, ProductVariant, Shop } from "@/types/models";

export function PriceDisplay({
  price,
  salePrice,
  compact
}: {
  price: number;
  salePrice?: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", compact && "gap-1")}>
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

    <span className="inline-flex items-center gap-1 text-xs">
      <span className="inline-flex items-center" aria-label={`Đánh giá ${rating.toFixed(1)} trên 5 sao`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = rating >= star;
          const half = !filled && rating >= star - 0.5;
          return (
            <span
              key={star}
              aria-hidden="true"
              style={{
                fontSize: "15px",
                lineHeight: 1,
                color: filled ? "#f59e0b" : half ? "#fcd34d" : "#d1d5db",
              }}
            >
              ★
            </span>
          );
        })}
      </span>
      <span className="font-bold text-amber-600">{rating.toFixed(1)}</span>
      {typeof count === "number" ? <span className="text-slate-500">({count})</span> : null}
    </span>
  );
}

export function ProductCard({
  product,
  variants,
  shop,
  categories,
  onAdd
}: {
  product: Product;
  variants: ProductVariant[];
  shop?: Shop;
  categories: Category[];
  onAdd?: (variantId: string) => void;
}) {
  const primaryVariant = getPrimaryVariant(product, variants);
  const priceRange = getProductPriceRange(product, variants);
  const category = categories.find((item) => product.categoryIds.includes(item.id));
  const href = `/shops/${shop?.shopSlug}/products/${product.slug}`;
  return (
    <article className="group hover-lift overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-all duration-300 hover:border-slate-300 hover:shadow-xl">
      <a href={href} className="block">
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
        <div className="space-y-2 p-3.5">

          {product.status === "OUT_OF_STOCK" && (
            <div className="flex items-center gap-2">
              <StatusBadge status="OUT_OF_STOCK" label="Hết hàng" />
            </div>
          )}
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
      </a>
      {primaryVariant && onAdd ? (
        <div className="border-t border-slate-100 p-3 bg-slate-50/50">
          <Button
            className="w-full"
            variant="secondary"
            disabled={product.status !== "ACTIVE" || primaryVariant.status !== "ACTIVE"}
            onClick={() => onAdd(primaryVariant.id)}
          >
            Thêm giỏ
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <a
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
    </a>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex h-10 items-center overflow-hidden rounded-panel border border-line bg-white">
      <IconButton
        aria-label="Giảm số lượng"
        className="h-10 w-10 rounded-none border-0"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </IconButton>
      <span className="min-w-10 px-2 text-center text-sm font-bold">{value}</span>
      <IconButton
        aria-label="Tăng số lượng"
        className="h-10 w-10 rounded-none border-0"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </div>
  );
}

export function OrderTimeline({ order }: { order: Order }) {
  return (
    <ol className="space-y-3">
      {order.timeline.map((entry, index) => (
        <li key={entry.id} className="flex gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
            {index + 1}
          </span>
          <div>
            <p className="font-semibold text-ink">{orderStatusLabel[entry.newStatus]}</p>
            <p className="text-sm text-muted">{entry.note}</p>
            <p className="text-xs text-muted">{formatDate(entry.createdAt)}</p>
          </div>
        </li>
      ))}
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
