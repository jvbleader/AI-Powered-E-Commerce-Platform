"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { Panel, Section } from "@/components/ui/containers";
import { ImageUpload } from "@/components/ui/image-upload";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { SellerApplication, ShippingProvider } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";
import { shippingApi } from "@/services/shipping-api";

export default function SellerProfilePage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const router = useRouter();
  const { showToast } = store;

  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [shopLogoUrl, setShopLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shippingProviders, setShippingProviders] = useState<ShippingProvider[]>([]);

  const [form, setForm] = useState<SellerApplication>({
    shopName: shop?.shopName ?? "",
    phone: shop?.phone ?? "",
    email: shop?.email ?? "",
    pickupAddress: shop?.pickupAddress ?? "",
    taxCode: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
    shopDescription: shop?.description ?? "",
    shippingProviderPublicIds: []
  });

  useEffect(() => {
    let cancelled = false;

    if (!store.ready) return;

    if (!store.getCurrentUser()) {
      setLoading(false);
      return;
    }

    if (!shop) {
      router.push("/seller/register");
      return;
    }

    store.getSellerApplication().then((result) => {
      if (cancelled) return;
      if (result.ok && result.application) {
        setApplication(result.application);
      }
      setLoading(false);
    });

    shippingApi.getProviders().then((res) => {
      if (!cancelled) setShippingProviders(res);
    });

    return () => {
      cancelled = true;
    };
  }, [store.ready, store.getCurrentUser(), shop, router, store.getSellerApplication]);

  useEffect(() => {
    if (application) {
      setShopLogoUrl(application.shopLogoUrl || "");
      setForm({
        shopName: application.shopName || shop?.shopName || "",
        phone: application.phone || shop?.phone || "",
        email: application.email || shop?.email || "",
        pickupAddress: application.pickupAddress || shop?.pickupAddress || "",
        taxCode: application.taxCode || "",
        bankName: application.bankName || "",
        bankAccountNumber: application.bankAccountNumber || "",
        bankAccountName: application.bankAccountName || "",
        shopSlug: application.shopSlug || shop?.shopSlug || "",
        shopDescription: application.shopDescription || shop?.description || "",
        shippingProviderPublicIds: application.shippingProviders?.map((p: any) => p.publicId) ?? []
      });
    } else if (shop) {
      setShopLogoUrl(shop.logoUrl || "");
      setForm({
        shopName: shop.shopName || "",
        phone: shop.phone || "",
        email: shop.email || "",
        pickupAddress: shop.pickupAddress || "",
        taxCode: "",
        bankName: "",
        bankAccountNumber: "",
        bankAccountName: "",
        shopSlug: shop.shopSlug || "",
        shopDescription: shop.description || "",
        shippingProviderPublicIds: []
      });
    }
  }, [application, shop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await store.saveSellerApplication(
      {
        ...form,
        shopLogoUrl
      },
      "update"
    );
    setSaving(false);
    if (result.ok) {
      showToast(result.message || "Đã lưu hồ sơ shop.", "success");
    } else {
      showToast(result.message || "Không thể lưu hồ sơ shop.", "danger");
    }
  };

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi truy cập hồ sơ shop." />;
  }

  if (!shop && loading) {
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
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <Field label="Logo Shop">
              <ImageUpload value={shopLogoUrl} onChange={setShopLogoUrl} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên shop">
              <Input
                value={form.shopName}
                onChange={(e) => setForm((prev) => ({ ...prev, shopName: e.target.value }))}
              />
            </Field>
            <Field label="Slug">
              <Input
                value={form.shopSlug || ""}
                disabled
              />
            </Field>

            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </Field>
            <Field label="Mã số thuế">
              <Input
                value={form.taxCode}
                onChange={(e) => setForm((prev) => ({ ...prev, taxCode: e.target.value }))}
              />
            </Field>
            <Field label="Tên ngân hàng">
              <Input
                value={form.bankName}
                onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
              />
            </Field>
            <Field label="Số tài khoản">
              <Input
                value={form.bankAccountNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
              />
            </Field>
            <Field label="Tên chủ tài khoản">
              <Input
                value={form.bankAccountName}
                onChange={(e) => setForm((prev) => ({ ...prev, bankAccountName: e.target.value }))}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Đơn vị vận chuyển">
                <MultiSelect
                  options={shippingProviders.map(p => ({
                    label: p.fixedFee ? `${p.name} (${Number(p.fixedFee).toLocaleString("vi-VN")}đ)` : p.name,
                    value: p.publicId
                  }))}
                  value={form.shippingProviderPublicIds ?? []}
                  onChange={(val) => setForm(prev => ({ ...prev, shippingProviderPublicIds: val }))}
                  placeholder="Chọn đơn vị vận chuyển..."
                  className="mt-2"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Địa chỉ kho">
                <Input
                  value={form.pickupAddress}
                  onChange={(e) => setForm((prev) => ({ ...prev, pickupAddress: e.target.value }))}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Mô tả shop">
                <Textarea
                  value={form.shopDescription || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, shopDescription: e.target.value }))}
                  className="min-h-[100px]"
                />
              </Field>
            </div>
          </div>
          <Button className="mt-4" type="submit" disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </form>
      </Panel>
    </Section>
  );
}
