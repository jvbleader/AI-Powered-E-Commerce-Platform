"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { sellerStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { SellerApplication, User } from "@/types/models";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

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
    <Section title={`Seller ${application.shopName}`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow label="Status" value={sellerStatusLabel[applicationStatus]} />
            <InfoRow label="Owner" value={detail.user?.fullName ?? "-"} />
            <InfoRow label="Email owner" value={detail.user?.email ?? "-"} />
            <InfoRow label="Phone owner" value={detail.user?.phone ?? "-"} />
            <InfoRow label="Shop email" value={application.email} />
            <InfoRow label="Shop phone" value={application.phone} />
            <InfoRow label="Slug" value={application.shopSlug ?? "-"} />
            <InfoRow label="Tax code" value={application.taxCode} />
            <InfoRow label="Bank" value={application.bankName} />
            <InfoRow label="Bank account" value={application.bankAccountNumber} />
            <InfoRow label="Account name" value={application.bankAccountName} />
            <InfoRow label="Pickup" value={application.pickupAddress} />
            <InfoRow label="Rejected reason" value={application.rejectedReason ?? "Không có"} />
          </div>
        </Panel>
        <Panel className="h-fit">
          <h3 className="font-bold">Review</h3>
          <div className="mt-3 grid gap-3">
            <Field label="Lý do từ chối">
              <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
            </Field>
            <Button
              disabled={reviewing || applicationStatus !== "PENDING"}
              onClick={() => reviewApplication("approve")}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              disabled={reviewing || applicationStatus !== "PENDING"}
              onClick={() => reviewApplication("reject")}
            >
              Reject
            </Button>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
