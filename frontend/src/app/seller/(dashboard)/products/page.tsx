"use client";

import { useEffect, useState } from "react";
import { Plus, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { SearchField } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getCategoryNames, productStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";
import { QuickInventoryModal } from "@/components/seller/quick-inventory-modal";
import type { Product } from "@/types/models";

export default function SellerProductsPage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HIDDEN">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(null);

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

  const allShopProducts = store.state.products.filter((product) => product.sellerId === shop?.id);
  const activeCount = allShopProducts.filter((p) => p.status === "ACTIVE").length;
  const hiddenCount = allShopProducts.filter((p) => p.status === "HIDDEN").length;

  const products = allShopProducts.filter((product) => {
    if (product.status !== activeTab) return false;
    if (searchQuery.trim()) {
      return product.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    }
    return true;
  });

  return (
    <>
      <Section
        title="Quản lý sản phẩm"
        action={
          <Button onClick={() => (window.location.href = "/seller/products/new")}>
            <Plus className="h-4 w-4" />
            Tạo sản phẩm
          </Button>
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line mb-4 pb-2 sm:pb-0">
          <div className="flex gap-4">
            <button
              type="button"
              className={cn(
                "pb-2 text-sm font-semibold transition-colors",
                activeTab === "ACTIVE"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-primary"
              )}
              onClick={() => setActiveTab("ACTIVE")}
            >
              Sản phẩm đang bán ({activeCount})
            </button>
            <button
              type="button"
              className={cn(
                "pb-2 text-sm font-semibold transition-colors",
                activeTab === "HIDDEN"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-primary"
              )}
              onClick={() => setActiveTab("HIDDEN")}
            >
              Sản phẩm đã ẩn ({hiddenCount})
            </button>
          </div>

          <div className="w-full sm:w-72 pb-2 sm:pb-2">
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Tìm kiếm sản phẩm theo tên..."
              className="w-full"
            />
          </div>
        </div>
        <DataTable
          empty={
            searchQuery.trim() ? (
              <div className="p-8 text-center bg-white rounded-panel border border-line">
                <p className="text-sm font-semibold text-slate-700">Không tìm thấy sản phẩm nào</p>
                <p className="text-xs text-muted mt-1">Không có sản phẩm nào khớp với từ khóa "{searchQuery}"</p>
              </div>
            ) : undefined
          }
          columns={["Sản phẩm", "Categories", "Variants", "Kho", "Đã bán", "Rating", "Status", "Action"]}
          rows={products.map((product) => {
            const productVariants = store.state.variants.filter((variant) => variant.productId === product.id);
            const stock = productVariants.reduce((sum, variant) => sum + variant.inventory.quantity, 0);
            return [
              <span key="name" className="font-bold">{product.name}</span>,
              getCategoryNames(store.state.categories, product) || "Bỏ trống",
              `${productVariants.length}`,
              <button
                key="stock"
                type="button"
                onClick={() => setInventoryProduct(product)}
                className={cn(
                  "inline-block font-bold text-xs px-2.5 py-1 rounded border text-center cursor-pointer transition-all hover:scale-105 min-w-[3rem]",
                  stock === 0
                    ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                    : stock <= 10
                      ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                      : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                )}
                title="Click để sửa nhanh tồn kho"
              >
                {stock}
              </button>,
              `${product.soldCount}`,
              product.averageRating.toFixed(1),
              <StatusBadge key="st" status={product.status} label={productStatusLabel[product.status]} />,
              <div key="actions" className="flex items-center gap-3 text-sm">
                <button
                  type="button"
                  className="font-bold text-sky hover:underline inline-flex items-center gap-1"
                  onClick={() => setInventoryProduct(product)}
                  title="Quản lý tồn kho phân loại"
                >
                  <Box className="h-3.5 w-3.5" />
                  Quản lý kho
                </button>
                <a className="font-bold text-primary hover:underline" href={`/seller/products/${product.id}/edit`}>Sửa</a>
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

      <QuickInventoryModal
        product={inventoryProduct}
        onClose={() => setInventoryProduct(null)}
      />
    </>
  );
}
