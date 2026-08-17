"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RefreshCcw, ArrowLeft, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { sellerStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { SellerApplication, User } from "@/types/models";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink break-words">{value}</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        title="Không tìm thấy người bán"
        description="Hồ sơ người bán không đúng hoặc không tồn tại."
        action={<Button onClick={() => (window.location.href = "/admin/sellers")}>Về danh sách người bán</Button>}
      />
    </main>
  );
}

export default function AdminSellerDetailPage() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [detail, setDetail] = useState<{ user: User; application: SellerApplication } | undefined>();
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!sellerId) {
      setLoadingDetail(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingDetail(true);
    setDetailError("");

    store.getSellerApplicationDetail(sellerId)
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          setDetailError(result.message);
          return;
        }

        setDetail(result.detail);
        setRejectReason(result.detail.application.rejectedReason ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sellerId, store.getSellerApplicationDetail]);

  const reviewApplication = async (action: "approve" | "reject") => {
    if (!sellerId) return;

    setReviewing(true);
    const result = await store.reviewSellerApplication(
      sellerId,
      action,
      action === "reject" ? rejectReason : undefined
    );
    setReviewing(false);

    if (!result.ok) {
      showToast(result.message, "danger");
      return;
    }

    showToast(result.message, "success");
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            application: {
              ...prev.application,
              status: result.application.status,
              rejectedReason: result.application.rejectedReason,
              approvedAt: result.application.approvedAt
            }
          }
        : prev
    );
  };

  if (loadingDetail) {
    return (
      <Section title="Chi tiết người bán">
        <Panel>
          <div className="flex items-center gap-3">
            <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-muted">Đang tải chi tiết seller...</p>
          </div>
        </Panel>
      </Section>
    );
  }

  if (detailError) {
    return (
      <Section title="Chi tiết người bán">
        <ErrorState title="Không tải được chi tiết seller" description={detailError} />
      </Section>
    );
  }

  if (!detail) return <NotFoundPage />;

  const application = detail.application;
  const applicationStatus = application.status ?? "PENDING";

  return (
    <Section
      title={
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            className="h-8 px-2.5 text-xs flex items-center gap-1.5"
            onClick={() => (window.location.href = "/admin/sellers")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Danh sách
          </Button>
          <span className="font-bold text-lg">{application.shopName}</span>
          <StatusBadge status={applicationStatus} label={sellerStatusLabel[applicationStatus as keyof typeof sellerStatusLabel] ?? applicationStatus} />
        </div>
      }
      className="h-full overflow-y-auto pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* Shop Header card if logo or description exists */}
          {(application.shopLogoUrl || application.shopDescription) && (
            <Panel>
              <div className="flex items-start gap-4">
                {application.shopLogoUrl ? (
                  <img
                    src={application.shopLogoUrl}
                    alt={application.shopName}
                    className="w-16 h-16 rounded-panel object-cover border border-line"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-panel bg-primary/10 text-primary flex items-center justify-center border border-line">
                    <Store className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg text-ink">{application.shopName}</h3>
                  {application.shopSlug && (
                    <p className="text-xs text-muted font-mono">slug: {application.shopSlug}</p>
                  )}
                  {application.shopDescription && (
                    <p className="mt-2 text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {application.shopDescription}
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {/* Details info grid */}
          <Panel>
            <h3 className="font-bold text-base mb-3">Thông tin chi tiết</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow label="Trạng thái" value={sellerStatusLabel[applicationStatus as keyof typeof sellerStatusLabel] ?? applicationStatus} />
              <InfoRow label="Chủ sở hữu" value={detail.user?.fullName ?? "-"} />
              <InfoRow label="Email chủ sở hữu" value={detail.user?.email ?? "-"} />
              <InfoRow label="SĐT chủ sở hữu" value={detail.user?.phone ?? "-"} />
              <InfoRow label="Email cửa hàng" value={application.email} />
              <InfoRow label="SĐT cửa hàng" value={application.phone} />
              <InfoRow label="Slug cửa hàng" value={application.shopSlug ?? "-"} />
              <InfoRow label="Mã số thuế" value={application.taxCode} />
              <InfoRow label="Ngân hàng" value={application.bankName} />
              <InfoRow label="Số tài khoản" value={application.bankAccountNumber} />
              <InfoRow label="Chủ tài khoản" value={application.bankAccountName} />
              <InfoRow label="Địa chỉ lấy hàng" value={application.pickupAddress} />
              {application.approvedAt && (
                <InfoRow label="Ngày duyệt" value={new Date(application.approvedAt).toLocaleString("vi-VN")} />
              )}
              <InfoRow label="Lý do từ chối" value={application.rejectedReason ?? "Không có"} />
            </div>
          </Panel>

          {/* Shipping providers */}
          {application.shippingProviders && application.shippingProviders.length > 0 && (
            <Panel>
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Đơn vị vận chuyển đã cấu hình ({application.shippingProviders.length})
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {application.shippingProviders.map((sp) => (
                  <div key={sp.code || sp.publicId || sp.name} className="p-3 bg-canvas rounded-panel border border-line flex items-center gap-3">
                    {sp.logoUrl && (
                      <img src={sp.logoUrl} alt={sp.name} className="w-8 h-8 rounded object-contain border border-line" />
                    )}
                    <div>
                      <p className="font-semibold text-sm text-ink">{sp.name}</p>
                      <p className="text-xs text-muted">Mã: {sp.code || "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Review panel */}
        <Panel className="h-fit">
          <h3 className="font-bold text-base">Kiểm duyệt hồ sơ</h3>
          <div className="mt-3 grid gap-3">
            <Field label="Lý do từ chối">
              <Textarea
                placeholder="Nhập lý do từ chối hồ sơ (nếu từ chối)..."
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </Field>
            <Button
              disabled={reviewing || applicationStatus !== "PENDING"}
              onClick={() => reviewApplication("approve")}
            >
              Phê duyệt (Approve)
            </Button>
            <Button
              variant="danger"
              disabled={reviewing || applicationStatus !== "PENDING"}
              onClick={() => reviewApplication("reject")}
            >
              Từ chối (Reject)
            </Button>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
