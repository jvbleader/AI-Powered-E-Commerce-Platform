"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerProfilePage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const router = useRouter();
  const { showToast } = store;

  useEffect(() => {
    if (store.ready && store.getCurrentUser() && !shop) {
      router.push("/seller/register");
    }
  }, [store.ready, store.getCurrentUser(), shop, router]);

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi truy cập hồ sơ shop." />;
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Panel>
          <p className="text-sm font-semibold text-muted">Đang tải hồ sơ shop...</p>
        </Panel>
      </main>
    );
  }

  return (
    <Section title="Hồ sơ shop">
      <Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tên shop"><Input defaultValue={shop.shopName} /></Field>
          <Field label="Slug"><Input defaultValue={shop.shopSlug} /></Field>
          <Field label="Email"><Input defaultValue={shop.email} /></Field>
          <Field label="Phone"><Input defaultValue={shop.phone} /></Field>
          <Field label="Phí ship"><Input type="number" defaultValue={shop.shippingFee} /></Field>
          <Field label="Đơn vị vận chuyển"><Input defaultValue={shop.shippingProviderName} /></Field>
          <div className="md:col-span-2"><Field label="Địa chỉ kho"><Input defaultValue={shop.pickupAddress} /></Field></div>
          <div className="md:col-span-2"><Field label="Mô tả"><Textarea defaultValue={shop.description} /></Field></div>
        </div>
        <Button className="mt-4" onClick={() => showToast("Đã lưu hồ sơ shop.", "success")}>Lưu</Button>
      </Panel>
    </Section>
  );
}
