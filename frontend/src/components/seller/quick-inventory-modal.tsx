"use client";

import { useState, useEffect } from "react";
import { X, Plus, Minus, Box, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { Product, ProductVariant } from "@/types/models";
import { cn } from "@/lib/utils";

interface QuickInventoryModalProps {
  product: Product | null;
  onClose: () => void;
}

export function QuickInventoryModal({ product, onClose }: QuickInventoryModalProps) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [loading, setLoading] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const variants: ProductVariant[] = product
    ? store.state.variants.filter((v) => v.productId === product.id)
    : [];

  useEffect(() => {
    if (variants.length > 0) {
      const initial: Record<string, number> = {};
      variants.forEach((v) => {
        initial[v.id] = v.inventory?.quantity ?? 0;
      });
      setQuantities(initial);
    }
  }, [product, store.state.variants]);

  if (!product) return null;

  const handleAdjust = (variantId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[variantId] ?? 0;
      return { ...prev, [variantId]: Math.max(0, current + delta) };
    });
  };

  const handleSetQuantity = (variantId: string, val: string) => {
    const parsed = parseInt(val, 10);
    setQuantities((prev) => ({
      ...prev,
      [variantId]: isNaN(parsed) ? 0 : Math.max(0, parsed)
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      variants: variants.map((v) => ({
        public_id: v.id,
        sku: v.sku,
        variant_name: v.variantName,
        price: v.price,
        quantity: quantities[v.id] ?? v.inventory?.quantity ?? 0,
        image_url: v.imageUrl,
        tier_index: v.tierIndex
      }))
    };

    const res = await store.updateSellerProduct(product.id, payload);
    setLoading(false);
    if (res.ok) {
      showToast("Đã cập nhật tồn kho cho sản phẩm thành công!", "success");
      onClose();
    } else {
      showToast(res.message || "Lỗi cập nhật tồn kho", "danger");
    }
  };

  const totalStock = Object.values(quantities).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-panel border border-line bg-white shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-canvas/50">
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-ink text-base">Quản lý tồn kho sản phẩm</h3>
              <p className="text-xs text-muted font-medium line-clamp-1">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted hover:bg-canvas hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div
            className={cn(
              "flex items-center justify-between text-sm p-3 rounded-panel border transition-colors",
              totalStock === 0
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : totalStock <= 10
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
            )}
          >
            <span className="font-medium">Tổng tồn kho sản phẩm:</span>
            <span className="font-bold text-base">{totalStock} cái</span>
          </div>

          {variants.length === 0 ? (
            <p className="text-center text-sm text-muted py-6">Không tìm thấy phân loại nào cho sản phẩm này.</p>
          ) : (
            <div className="space-y-3">
              {variants.map((v) => {
                const qty = quantities[v.id] ?? 0;
                return (
                  <div
                    key={v.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-panel border border-line bg-white hover:border-primary/40 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-sm text-ink">{v.variantName || "Mặc định"}</p>
                      <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                        <span>SKU: <strong className="text-ink">{v.sku || "-"}</strong></span>
                        <span>| Tạm khóa: <strong className="text-amber-600">{v.inventory?.reservedQuantity ?? 0}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-line bg-canvas hover:bg-rose-50 hover:border-rose-300 text-ink hover:text-rose-600 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        onClick={() => handleAdjust(v.id, -1)}
                        disabled={loading || qty <= 0}
                        title="Giảm 1"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <Input
                        type="number"
                        min={0}
                        className={cn(
                          "h-8 w-20 text-center font-bold text-sm border transition-colors",
                          qty === 0
                            ? "bg-rose-50/60 text-rose-700 border-rose-300"
                            : qty <= 10
                              ? "bg-amber-50/60 text-amber-700 border-amber-300"
                              : "bg-emerald-50/60 text-emerald-700 border-emerald-300"
                        )}
                        value={qty}
                        onChange={(e) => handleSetQuantity(v.id, e.target.value)}
                      />
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-line bg-canvas hover:bg-emerald-50 hover:border-emerald-300 text-ink hover:text-emerald-600 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        onClick={() => handleAdjust(v.id, 1)}
                        disabled={loading}
                        title="Tăng 1"
                      >
                        <Plus className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          className="h-8 px-2 text-xs font-semibold rounded bg-canvas hover:bg-primary/10 text-primary border border-line transition-colors"
                          onClick={() => handleAdjust(v.id, 5)}
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          className="h-8 px-2 text-xs font-semibold rounded bg-canvas hover:bg-primary/10 text-primary border border-line transition-colors"
                          onClick={() => handleAdjust(v.id, 10)}
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          className="h-8 px-2 text-xs font-semibold rounded bg-canvas hover:bg-primary/10 text-primary border border-line transition-colors"
                          onClick={() => handleAdjust(v.id, 50)}
                        >
                          +50
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-5 py-4 bg-canvas/50">
          <a
            href={`/seller/inventory?product_id=${product.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Chi tiết tại trang Tồn kho
          </a>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Hủy
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
