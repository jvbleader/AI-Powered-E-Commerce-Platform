"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/input";
import { Section, Panel } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { ProductVariant } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";
import { Minus, Plus, Search, Box, AlertTriangle, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function InventoryAdjuster({ variant }: { variant: ProductVariant }) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const product = store.state.products.find((item) => item.id === variant.productId);
  const [quantity, setQuantity] = useState(variant.inventory.quantity.toString());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuantity(variant.inventory.quantity.toString());
  }, [variant.inventory.quantity]);

  const handleAdjust = (delta: number) => {
    const current = Math.max(0, (parseInt(quantity) || 0) + delta);
    setQuantity(current.toString());
  };

  const handleSave = async () => {
    if (!product) return;
    setLoading(true);
    const allProductVariants = store.state.variants.filter((v) => v.productId === product.id);
    const payload = {
      variants: allProductVariants.map((v) => ({
        public_id: v.id,
        sku: v.sku,
        variant_name: v.variantName,
        price: v.price,
        quantity: v.id === variant.id ? Number(quantity) : v.inventory.quantity,
        image_url: v.imageUrl,
        tier_index: v.tierIndex,
      })),
    };
    const res = await store.updateSellerProduct(product.id, payload);
    setLoading(false);
    if (res.ok) {
      showToast("Đã điều chỉnh tồn kho thành công.", "success");
    } else {
      showToast(res.message || "Lỗi cập nhật tồn kho", "danger");
    }
  };

  const currentNum = parseInt(quantity) || 0;

  return (
    <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          className="h-8 w-8 rounded border border-line bg-canvas hover:bg-rose-50 hover:border-rose-300 text-ink hover:text-rose-600 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          onClick={() => handleAdjust(-1)}
          disabled={loading || currentNum <= 0}
          title="Giảm 1"
        >
          <Minus className="h-4 w-4" />
        </button>
        <Input
          className={cn(
            "h-8 !w-16 text-center font-bold text-sm shrink-0 border transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            currentNum === 0
              ? "bg-rose-50/60 text-rose-700 border-rose-300"
              : currentNum <= 10
                ? "bg-orange-50/60 text-orange-700 border-orange-300"
                : "bg-emerald-50/60 text-emerald-700 border-emerald-300"
          )}
          type="number"
          min={0}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <button
          type="button"
          className="h-8 w-8 rounded border border-line bg-canvas hover:bg-emerald-50 hover:border-emerald-300 text-ink hover:text-emerald-600 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          onClick={() => handleAdjust(1)}
          disabled={loading}
          title="Tăng 1"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Button variant="primary" className="h-8 px-3 min-h-0 shrink-0 ml-0.5" onClick={handleSave} disabled={loading}>
        Lưu
      </Button>
    </div>
  );
}

function InventoryContent() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const searchParams = useSearchParams();
  const productIdParam = searchParams.get("product_id");
  const filterParam = searchParams.get("filter") || searchParams.get("stock");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>(productIdParam || "ALL");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW" | "OUT">(() => {
    if (filterParam === "LOW" || filterParam === "low_stock") return "LOW";
    if (filterParam === "OUT" || filterParam === "out_of_stock") return "OUT";
    return "ALL";
  });

  useEffect(() => {
    if (productIdParam) {
      setSelectedProductId(productIdParam);
    }
  }, [productIdParam]);

  useEffect(() => {
    if (filterParam === "LOW" || filterParam === "low_stock") {
      setStockFilter("LOW");
    } else if (filterParam === "OUT" || filterParam === "out_of_stock") {
      setStockFilter("OUT");
    }
  }, [filterParam]);

  useEffect(() => {
    if (shop) {
      store.fetchSellerProducts();
    }
  }, [shop, store.fetchSellerProducts]);

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
  const allVariants = store.state.variants.filter((variant) => productIds.has(variant.productId));

  // Stat computations
  const totalVariantsCount = allVariants.length;
  const totalStockQuantity = allVariants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0);
  const lowStockCount = allVariants.filter((v) => (v.inventory?.quantity ?? 0) > 0 && (v.inventory?.quantity ?? 0) <= 10).length;
  const outOfStockCount = allVariants.filter((v) => (v.inventory?.quantity ?? 0) === 0).length;

  // Filtered variants
  const filteredVariants = allVariants.filter((v) => {
    const product = products.find((p) => p.id === v.productId);
    const qty = v.inventory?.quantity ?? 0;

    // Filter by product dropdown
    if (selectedProductId !== "ALL" && v.productId !== selectedProductId) {
      return false;
    }

    // Filter by stock status tab
    if (stockFilter === "LOW" && (qty <= 0 || qty > 10)) {
      return false;
    }
    if (stockFilter === "OUT" && qty !== 0) {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchVariantName = v.variantName.toLowerCase().includes(q);
      const matchSku = v.sku.toLowerCase().includes(q);
      const matchProductName = product?.name.toLowerCase().includes(q) ?? false;
      if (!matchVariantName && !matchSku && !matchProductName) {
        return false;
      }
    }

    return true;
  });

  return (
    <Section title="Quản lý tồn kho" className="space-y-6 pb-0">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Panel className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-panel bg-primary/10 text-primary">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Tổng số phân loại</p>
            <p className="text-lg font-bold text-ink">{totalVariantsCount}</p>
          </div>
        </Panel>

        <Panel className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-panel bg-sky/10 text-sky">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Tổng tồn kho</p>
            <p className="text-lg font-bold text-ink">{totalStockQuantity}</p>
          </div>
        </Panel>

        <Panel className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-panel bg-orange-100 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Sắp hết (≤ 10)</p>
            <p className="text-lg font-bold text-orange-600">{lowStockCount}</p>
          </div>
        </Panel>

        <Panel className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-panel bg-rose-100 text-rose-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Hết hàng (= 0)</p>
            <p className="text-lg font-bold text-rose-600">{outOfStockCount}</p>
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        {/* Filters bar */}
        <div className="space-y-4 mb-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-4 border-b border-line pb-2">
            <button
              type="button"
              className={cn(
                "pb-2 text-sm font-semibold transition-colors relative",
                stockFilter === "ALL" ? "border-b-2 border-primary text-primary" : "text-muted hover:text-primary"
              )}
              onClick={() => setStockFilter("ALL")}
            >
              Tất cả ({totalVariantsCount})
            </button>
            <button
              type="button"
              className={cn(
                "pb-2 text-sm font-semibold transition-colors relative",
                stockFilter === "LOW" ? "border-b-2 border-primary text-primary" : "text-muted hover:text-primary"
              )}
              onClick={() => setStockFilter("LOW")}
            >
              Sắp hết hàng ({lowStockCount})
            </button>
            <button
              type="button"
              className={cn(
                "pb-2 text-sm font-semibold transition-colors relative",
                stockFilter === "OUT" ? "border-b-2 border-primary text-primary" : "text-muted hover:text-primary"
              )}
              onClick={() => setStockFilter("OUT")}
            >
              Hết hàng ({outOfStockCount})
            </button>
          </div>

          {/* Search & Product Dropdown */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <Input
                placeholder="Tìm theo tên phân loại, SKU, hoặc tên sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="w-full sm:w-64">
              <Select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="h-9"
              >
                <option value="ALL">-- Tất cả sản phẩm --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <DataTable
          columns={["Variant", "SKU", "Sản phẩm", "Số lượng", "Tạm khóa", "Trạng thái", "Điều chỉnh tồn kho"]}
          aligns={["left", "left", "left", "center", "center", "left", "left"]}
          rows={filteredVariants.map((variant) => {
            const product = products.find((item) => item.id === variant.productId);
            const qty = variant.inventory?.quantity ?? 0;
            return [
              <span key="vname" className="font-bold">{variant.variantName || "Mặc định"}</span>,
              variant.sku || "-",
              product?.name ?? "-",
              <span
                key="qty"
                className={cn(
                  "inline-block font-bold text-xs px-2.5 py-1 rounded border text-center min-w-[3rem]",
                  qty === 0
                    ? "bg-rose-50 text-rose-600 border-rose-200"
                    : qty <= 10
                      ? "bg-orange-50 text-orange-600 border-orange-200"
                      : "bg-emerald-50 text-emerald-600 border-emerald-200"
                )}
              >
                {qty}
              </span>,
              `${variant.inventory?.reservedQuantity ?? 0}`,
              <StatusBadge
                key="st"
                status={variant.status}
                label={variant.status === "ACTIVE" ? "Hoạt động" : variant.status}
              />,
              <InventoryAdjuster key={`adj-${variant.id}`} variant={variant} />,
            ];
          })}
        />
      </div>
    </Section>
  );
}

export default function SellerInventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Đang tải trang tồn kho...</div>}>
      <InventoryContent />
    </Suspense>
  );
}
