"use client";

import { useParams } from "next/navigation";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { Panel } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { sellerStatusLabel, formatVnd } from "@/lib/helpers";
import ProductListing from "@/components/shared/product-listing";
import NotFoundPage from "@/components/shared/not-found-page";

export default function ShopDetailPage() {
  const params = useParams();
  const shopSlug = typeof params.shopSlug === "string" ? params.shopSlug : "";
  const store = useMarketplaceStore();

  const shop = store.state.shops.find((item) => item.shopSlug === shopSlug);
  if (!shop) return <NotFoundPage />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <img src={shop.logoUrl} alt={shop.shopName} className="h-24 w-24 rounded-panel object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black text-ink">{shop.shopName}</h1>
              <StatusBadge status={shop.status} label={sellerStatusLabel[shop.status]} />
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{shop.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
              <span>Đã bán {shop.totalSold.toLocaleString("vi-VN")}</span>
              <span>Phí ship {formatVnd(shop.shippingFee)}</span>
              <span>{shop.shippingProviderName}</span>
            </div>
          </div>
        </div>
      </Panel>
      <ProductListing title={`Sản phẩm của ${shop.shopName}`} shopSlug={shop.shopSlug} />
    </main>
  );
}
