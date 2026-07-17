"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCategoryNames, productStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerProductsPage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HIDDEN">("ACTIVE");

  useEffect(() => {
    if (shop) {
      store.fetchSellerProducts();
    }
  }, [shop, store.fetchSellerProducts]);

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi quản lý sản phẩm." />;
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm font-semibold text-muted">Đang tải thông tin shop...</p>
      </main>
    );
  }

  const products = store.state.products.filter((product) => product.sellerId === shop?.id && product.status === activeTab);

  return (
    <Section title="Quản lý sản phẩm" action={<Button onClick={() => (window.location.href = "/seller/products/new")}><Plus className="h-4 w-4" />Tạo sản phẩm</Button>}>
      <div className="flex gap-4 border-b border-line mb-4">
        <button
          className={cn(
            "pb-2 text-sm font-semibold transition-colors",
            activeTab === "ACTIVE"
              ? "border-b-2 border-primary text-primary"
              : "text-muted hover:text-primary"
          )}
          onClick={() => setActiveTab("ACTIVE")}
        >
          Sản phẩm đang bán
        </button>
        <button
          className={cn(
            "pb-2 text-sm font-semibold transition-colors",
            activeTab === "HIDDEN"
              ? "border-b-2 border-primary text-primary"
              : "text-muted hover:text-primary"
          )}
          onClick={() => setActiveTab("HIDDEN")}
        >
          Sản phẩm đã ẩn
        </button>
      </div>
      <DataTable
        columns={["Sản phẩm", "Categories", "Variants", "Kho", "Đã bán", "Rating", "Status", "Action"]}
        rows={products.map((product) => {
          const productVariants = store.state.variants.filter((variant) => variant.productId === product.id);
          const stock = productVariants.reduce((sum, variant) => sum + variant.inventory.quantity, 0);
          return [
            <span key="name" className="font-bold">{product.name}</span>,
            getCategoryNames(store.state.categories, product) || "Bỏ trống",
            `${productVariants.length}`,
            `${stock}`,
            `${product.soldCount}`,
            product.averageRating.toFixed(1),
            <StatusBadge key="st" status={product.status} label={productStatusLabel[product.status]} />,
            <div key="actions" className="flex gap-3 text-sm">
              <a className="font-bold text-primary" href={`/seller/products/${product.id}/edit`}>Sửa</a>
              {product.status !== "HIDDEN" ? (
                <button className="text-muted hover:text-primary" onClick={() => { if (confirm("Ẩn sản phẩm?")) { store.hideSellerProduct(product.id).then((r) => { if(!r.ok) showToast(r.message||"", "danger") }) } }}>Ẩn</button>
              ) : (
                <button className="text-muted hover:text-primary" onClick={() => { if (confirm("Bỏ ẩn sản phẩm?")) { store.unhideSellerProduct(product.id).then((r) => { if(!r.ok) showToast(r.message||"", "danger") }) } }}>Bỏ ẩn</button>
              )}
              <button className="text-danger hover:text-danger/80" onClick={() => { if(confirm("Xóa sản phẩm?")) store.deleteSellerProduct(product.id).then((r) => { if(!r.ok) showToast(r.message||"", "danger") }) }}>Xóa</button>
            </div>
          ];
        })}
      />
    </Section>
  );
}
