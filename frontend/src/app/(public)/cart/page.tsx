"use client";

import { Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/containers";
import { EmptyState } from "@/components/ui/feedback";
import { PriceDisplay, QuantityStepper } from "@/components/shared/cards";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { groupCartByShop, selectedCheckoutGroups, formatVnd } from "@/lib/helpers";
import Unauthorized from "@/components/shared/unauthorized-page";
import { useRouter } from "next/navigation";

export default function CartPage() {
  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Giỏ hàng cần đăng nhập" description="Vui lòng đăng nhập để xem giỏ hàng." />;
  }

  const groups = Object.values(groupCartByShop(store.getCartRows()));
  const selectedTotal = store.getCartRows()
    .filter((row) => row.item.isSelected && !row.unavailable)
    .reduce((sum, row) => sum + row.subtotal, 0);

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-panel border border-line bg-white p-3">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-semibold text-ink">{value}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <Section title="Giỏ hàng">
        {groups.length ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <Panel className="flex items-center justify-between gap-3">
                <Checkbox
                  label="Chọn tất cả"
                  checked={store.getCartRows().length > 0 && store.getCartRows().every((row) => row.item.isSelected)}
                  onChange={(event) => store.selectAllCart(event.target.checked)}
                />
                <Button variant="secondary" onClick={() => showToast("Đã cập nhật giá hiện tại.", "success")}>
                  Cập nhật giá
                </Button>
              </Panel>
              {groups.map((group) => (
                <Panel key={group.shop.id}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <a href={`/shops/${group.shop.shopSlug}`} className="font-bold text-ink">{group.shop.shopName}</a>
                    <span className="text-sm text-muted">Phí ship {formatVnd(group.shop.shippingFee)}</span>
                  </div>
                  <div className="space-y-3">
                    {group.rows.map((row) => (
                      <div key={row.item.id} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[24px_76px_1fr_auto] sm:items-center">
                        <Checkbox
                          checked={row.item.isSelected}
                          onChange={(event) => store.updateCartItem(row.item.id, { isSelected: event.target.checked })}
                          aria-label={`Chọn ${row.product.name}`}
                        />
                        <a href={`/shops/${group.shop.shopSlug}/products/${row.product.slug}`} className="block overflow-hidden rounded-panel">
                          <img src={row.product.thumbnailUrl} alt={row.product.name} className="h-20 w-20 rounded-panel object-cover transition-transform hover:scale-105" />
                        </a>
                        <div>
                          <a href={`/shops/${group.shop.shopSlug}/products/${row.product.slug}`} className="font-bold text-ink hover:text-primary hover:underline">
                            {row.product.name}
                          </a>
                          <p className="text-sm text-muted">Biến thể: {row.variant.variantName}</p>
                          {row.unavailable ? <p className="mt-1 text-sm font-semibold text-coral">{row.reason}</p> : null}
                          <PriceDisplay price={row.variant.price} salePrice={row.variant.salePrice} compact />
                        </div>
                        <div className="flex items-center gap-2">
                          <QuantityStepper
                            value={row.item.quantity}
                            onChange={(value) => store.updateCartItem(row.item.id, { quantity: value })}
                            max={row.variant.inventory.quantity || 1}
                          />
                          <Button variant="ghost" onClick={() => store.removeCartItem(row.item.id)}>Xóa</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              ))}
            </div>
            <Panel className="h-fit">
              <h2 className="text-lg font-bold">Tóm tắt</h2>
              <InfoRow label="Tiền hàng đã chọn" value={formatVnd(selectedTotal)} />
              <InfoRow label="Số shop" value={`${selectedCheckoutGroups(store.getCartRows()).length}`} />
              <Button className="mt-4 w-full" disabled={!selectedTotal} onClick={() => router.push("/checkout")}>
                Checkout
              </Button>
            </Panel>
          </div>
        ) : (
          <EmptyState
            title="Giỏ hàng trống"
            description="Bạn chưa có sản phẩm nào trong giỏ hàng."
            action={<Button onClick={() => router.push("/products")}>Mua sắm</Button>}
          />
        )}
      </Section>
    </main>
  );
}
