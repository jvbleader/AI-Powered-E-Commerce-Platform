"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Store, ShieldCheck, MapPin, ShoppingBag, Truck, Phone, Mail } from "lucide-react";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { Panel } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { sellerStatusLabel, formatVnd } from "@/lib/helpers";
import ProductListing from "@/components/shared/product-listing";
import NotFoundPage from "@/components/shared/not-found-page";
import { fetchPublicShop } from "@/services/product-api";
import type { Shop } from "@/types/models";

export default function ShopDetailPage() {
  const params = useParams();
  const shopSlug = typeof params.shopSlug === "string" ? params.shopSlug : "";
  const store = useMarketplaceStore();

  const [shop, setShop] = useState<Shop | undefined>(() =>
    store.state.shops.find((item) => item.shopSlug === shopSlug)
  );
  const [loading, setLoading] = useState(!shop);

  useEffect(() => {
    let isMounted = true;
    if (shopSlug) {
      setLoading(!shop);
      fetchPublicShop(shopSlug).then((res) => {
        if (isMounted) {
          if (res.ok && res.shop) {
            setShop(res.shop);
            store.saveShop(res.shop);
          }
          setLoading(false);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [shopSlug]);

  if (loading && !shop) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 text-center text-muted">
        <div className="inline-flex items-center gap-2">
          <span className="loading loading-spinner"></span>
          <span>Đang tải thông tin cửa hàng...</span>
        </div>
      </main>
    );
  }

  if (!shop) return <NotFoundPage />;

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      {/* Shop Profile Header - Matching Website Design System */}
      <Panel className="p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="relative h-20 w-20 shrink-0">
              {shop.logoUrl ? (
                <img
                  src={shop.logoUrl}
                  alt={shop.shopName}
                  className="h-20 w-20 rounded-panel border border-line object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-panel border border-line bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-3xl">
                  {shop.shopName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 rounded-full bg-primary p-0.5 text-white">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-ink">{shop.shopName}</h1>
                <StatusBadge status={shop.status} label={sellerStatusLabel[shop.status] || "Đang hoạt động"} />

              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted">{shop.description}</p>
              
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted">
                {shop.pickupAddress && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {shop.pickupAddress}
                  </span>
                )}
                {shop.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    {shop.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Shop Quick Stats */}
          <div className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs sm:grid-cols-3 md:border-t-0 md:pt-0">
            <div className="rounded-panel border border-line bg-canvas p-3 text-center">
              <p className="text-muted">Đã bán</p>
              <p className="mt-1 font-bold text-ink sm:text-sm">{(shop.totalSold || 0).toLocaleString("vi-VN")}</p>
            </div>
            <div className="col-span-2 rounded-panel border border-line bg-canvas p-3 text-center sm:col-span-2">
              <p className="text-muted">Đơn vị vận chuyển</p>
              <p className="mt-1 font-bold text-ink sm:text-sm">
                {shop.shippingProviders?.length ? shop.shippingProviders.map(p => p.name).join(", ") : "Chưa cấu hình"}
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {/* Product Listing for this shop */}
      <ProductListing title={`Sản phẩm của ${shop.shopName}`} shopSlug={shop.shopSlug} />
    </main>
  );
}
