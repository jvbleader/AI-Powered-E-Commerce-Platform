"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        title="Không tìm thấy route"
        description="Đường dẫn không đúng hoặc không còn tồn tại."
        action={<Button onClick={() => (window.location.href = "/")}>Về trang chủ</Button>}
      />
    </main>
  );
}

export default function AdminProductDetailPage() {
  const params = useParams();
  const productId = params.productId as string;
  const store = useMarketplaceStore();
  const { showToast } = store;
  const product = store.state.products.find((item) => item.id === productId);

  const [productStatus, setProductStatus] = useState<string>(product?.status || "ACTIVE");

  if (!product) return <NotFoundPage />;

  return (
    <Section
      title={
        <div className="flex items-center gap-2">
          <span>{product.name}</span>
          <StatusBadge status={productStatus} label={productStatus} />
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel>
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="aspect-[16/9] w-full rounded-panel object-cover"
          />
          <p className="mt-3 text-sm leading-6 text-muted">{product.description}</p>
        </Panel>
        <Panel>
          <h3 className="font-bold">Thao tác kiểm duyệt</h3>
          <div className="mt-3 grid gap-2">
            <Button variant="secondary" onClick={() => {
              const updatedProduct = { ...product, status: "HIDDEN" as const };
              store.saveProduct(updatedProduct);
              setProductStatus("HIDDEN");
              showToast("Đã ẩn sản phẩm.", "success");
            }}>
              Ẩn sản phẩm
            </Button>
            <Button variant="danger" onClick={() => {
              const updatedProduct = { ...product, status: "DELETED" as const };
              store.saveProduct(updatedProduct);
              setProductStatus("DELETED");
              showToast("Đã xóa sản phẩm.", "danger");
            }}>
              Xóa sản phẩm
            </Button>
            <Button variant="secondary" onClick={() => {
              const shop = store.state.shops.find((s) => s.id === product.sellerId);
              if (shop) {
                store.toggleUserLock(shop.userId);
              }
              showToast("Đã khóa người bán.", "success");
            }}>
              Khóa người bán
            </Button>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
