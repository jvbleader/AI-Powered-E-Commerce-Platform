"use client";

import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { getCategoryNames, productStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function AdminProductsPage() {
  const store = useMarketplaceStore();

  const getShopName = (sellerId?: string) => {
    return store.state.shops.find((shop) => shop.id === sellerId)?.shopName ?? "-";
  };

  return (
    <Section title="Sản phẩm toàn sàn">
      <DataTable
        columns={["Product", "Shop", "Category", "Status", "Sold", "Action"]}
        rows={store.state.products.map((product) => [
          <a key="p" className="font-bold text-primary" href={`/admin/products/${product.id}`}>
            {product.name}
          </a>,
          getShopName(product.sellerId),
          getCategoryNames(store.state.categories, product) || "-",
          <StatusBadge key="st" status={product.status} label={productStatusLabel[product.status]} />,
          `${product.soldCount}`,
          <span key="act" className="text-muted">
            Chỉ xem
          </span>
        ])}
      />
    </Section>
  );
}
