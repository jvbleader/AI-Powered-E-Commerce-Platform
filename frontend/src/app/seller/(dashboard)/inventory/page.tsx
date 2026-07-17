"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { ProductVariant } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";

function InventoryAdjuster({ variant }: { variant: ProductVariant }) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const product = store.state.products.find((item) => item.id === variant.productId);
  const [quantity, setQuantity] = useState(variant.inventory.quantity.toString());
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!product) return;
    setLoading(true);
    const allProductVariants = store.state.variants.filter(v => v.productId === product.id);
    const payload = {
        variants: allProductVariants.map(v => ({
            public_id: v.id,
            sku: v.sku,
            variant_name: v.variantName,
            price: v.price,
            quantity: v.id === variant.id ? Number(quantity) : v.inventory.quantity,
            image_url: v.imageUrl,
            tier_index: v.tierIndex
        }))
    };
    const res = await store.updateSellerProduct(product.id, payload);
    setLoading(false);
    if (res.ok) {
        showToast("Đã điều chỉnh tồn kho.", "success");
    } else {
        showToast(res.message || "Lỗi cập nhật tồn kho", "danger");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input className="w-24" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
      <Button variant="secondary" onClick={handleSave} disabled={loading}>Lưu</Button>
    </div>
  );
}

export default function SellerInventoryPage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi xem tồn kho." />;
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm font-semibold text-muted">Đang tải thông tin shop...</p>
      </main>
    );
  }

  const products = store.state.products.filter((product) => product.sellerId === shop?.id);
  const productIds = new Set(products.map((product) => product.id));
  const variants = store.state.variants.filter((variant) => productIds.has(variant.productId));

  return (
    <Section title="Tồn kho theo variant">
      <DataTable
        columns={["Variant", "SKU", "Sản phẩm", "Quantity", "Reserved", "Status", "Điều chỉnh"]}
        rows={variants.map((variant) => {
          const product = store.state.products.find((item) => item.id === variant.productId);
          return [
            variant.variantName,
            variant.sku,
            product?.name ?? "-",
            `${variant.inventory.quantity}`,
            `${variant.inventory.reservedQuantity}`,
            <StatusBadge key="st" status={variant.status} label={variant.status} />,
            <InventoryAdjuster key={`adj-${variant.id}`} variant={variant} />
          ];
        })}
      />
    </Section>
  );
}
