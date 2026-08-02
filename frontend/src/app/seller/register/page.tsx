"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { RefreshCcw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { sellerStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { SellerApplication, SellerStatus } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerRegisterPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [form, setForm] = useState<SellerApplication>({
    shopName: "",
    phone: store.getCurrentUser()?.phone ?? "",
    email: store.getCurrentUser()?.email ?? "",
    pickupAddress: "",
    taxCode: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: store.getCurrentUser()?.fullName ?? ""
  });
  const [mode, setMode] = useState<"create" | "update">("create");
  const [applicationStatus, setApplicationStatus] = useState<SellerStatus | undefined>();
  const [loadingApplication, setLoadingApplication] = useState(true);
  const [savingApplication, setSavingApplication] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!store.ready) return;

    if (!store.getCurrentUser()) {
      setLoadingApplication(false);
      return () => {
        cancelled = true;
      };
    }

    setForm((prev) => ({
      ...prev,
      phone: prev.phone || store.getCurrentUser()?.phone || "",
      email: prev.email || store.getCurrentUser()?.email || "",
      bankAccountName: prev.bankAccountName || store.getCurrentUser()?.fullName || ""
    }));

    store.getSellerApplication()
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          setFormError(result.message);
          return;
        }

        const application = result.application;
        const status = application?.status ?? result.sellerMe.status ?? undefined;
        setApplicationStatus(status);

        if (application) {
          setMode("update");
          setForm({
            shopName: application.shopName,
            phone: application.phone,
            email: application.email,
            pickupAddress: application.pickupAddress,
            taxCode: application.taxCode,
            bankName: application.bankName,
            bankAccountNumber: application.bankAccountNumber,
            bankAccountName: application.bankAccountName,
            shopSlug: application.shopSlug,
            status
          });
        } else {
          setMode("create");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingApplication(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    store.ready,
    store.getCurrentUser()?.id,
    store.getCurrentUser()?.email,
    store.getCurrentUser()?.phone,
    store.getCurrentUser()?.fullName,
    store.getSellerApplication
  ]);

  const updateField = (field: keyof SellerApplication) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingApplication(true);
    setFormError("");

    const result = await store.saveSellerApplication(form, mode);
    setSavingApplication(false);

    if (!result.ok) {
      setFormError(result.message);
      showToast(result.message, "danger");
      return;
    }

    showToast(result.message, "success");
    window.location.href = result.redirectTo;
  };

  if (!store.ready || loadingApplication) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Panel>
          <div className="flex items-center gap-3">
            <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-muted">Đang tải hồ sơ shop...</p>
          </div>
        </Panel>
      </main>
    );
  }

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi gửi hồ sơ mở shop." />;
  }

  if (applicationStatus === "APPROVED") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Panel>
          <StatusBadge status="APPROVED" label={sellerStatusLabel.APPROVED} />
          <h1 className="mt-3 text-2xl font-black text-ink">Shop đã được duyệt</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Hồ sơ đã được duyệt.</p>
          <Button className="mt-4" onClick={() => (window.location.href = "/seller")}>
            Vào kênh người bán
          </Button>
        </Panel>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Section title={mode === "update" ? "Cập nhật hồ sơ mở shop" : "Đăng ký trở thành người bán"}>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Panel>
            {formError ? (
              <div className="mb-4">
                <ErrorState title="Chưa gửi được hồ sơ" description={formError} />
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <Field label="Tên shop" hint="4-100 ký tự">
                <Input value={form.shopName} onChange={updateField("shopName")} placeholder="Shepoo Store" />
              </Field>
              <Field label="Email shop">
                <Input value={form.email} onChange={updateField("email")} placeholder="shop@example.com" />
              </Field>
              <Field label="Số điện thoại shop">
                <Input value={form.phone} onChange={updateField("phone")} placeholder="0901234567" />
              </Field>
              <Field label="Mã số thuế" hint="10-14 ký tự">
                <Input value={form.taxCode} onChange={updateField("taxCode")} placeholder="0312345678" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Địa chỉ lấy hàng" hint="10-200 ký tự">
                  <Input value={form.pickupAddress} onChange={updateField("pickupAddress")} placeholder="Số nhà, phường/xã, quận/huyện, tỉnh/thành" />
                </Field>
              </div>
              <Field label="Ngân hàng">
                <Input value={form.bankName} onChange={updateField("bankName")} placeholder="VCB, ACB, BIDV..." />
              </Field>
              <Field label="Số tài khoản">
                <Input value={form.bankAccountNumber} onChange={updateField("bankAccountNumber")} placeholder="0123456789" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Tên chủ tài khoản">
                  <Input value={form.bankAccountName} onChange={updateField("bankAccountName")} placeholder={store.getCurrentUser()?.fullName} />
                </Field>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button type="submit" disabled={savingApplication}>
                  {savingApplication ? "Đang gửi..." : mode === "update" ? "Cập nhật và gửi duyệt lại" : "Gửi yêu cầu"}
                </Button>
                {applicationStatus === "REJECTED" ? (
                  <Button type="button" variant="secondary" onClick={() => (window.location.href = "/seller/rejected")}>
                    Xem trạng thái từ chối
                  </Button>
                ) : null}
              </div>
            </form>
          </Panel>
          <Panel className="h-fit">
            <div className="flex items-center gap-3">
              <Store className="h-9 w-9 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm text-muted">Trạng thái hồ sơ</p>
                <div className="mt-1">
                  <StatusBadge status={applicationStatus ?? "PENDING"} label={applicationStatus ? sellerStatusLabel[applicationStatus] : "Chưa gửi"} />
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
              {applicationStatus === "PENDING" ? <p>Hồ sơ đang chờ admin duyệt.</p> : null}
              {applicationStatus === "REJECTED" ? <p>Hồ sơ bị từ chối có thể sửa và gửi duyệt lại.</p> : null}
            </div>
          </Panel>
        </div>
      </Section>
    </main>
  );
}
