"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { sellerStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { SellerApplication, SellerStatus } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerRejectedPage() {
  const router = useRouter();
  const store = useMarketplaceStore();
  const [application, setApplication] = useState<SellerApplication | undefined>();
  const [actualStatus, setActualStatus] = useState<SellerStatus>("REJECTED");
  const [hasProfile, setHasProfile] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!store.ready) return;

    if (!store.getCurrentUser()) {
      setLoadingStatus(false);
      return;
    }

    store.getSellerApplication()
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          setStatusError(result.message);
          return;
        }

        setHasProfile(result.sellerMe.has_seller_profile);
        const nextStatus = result.application?.status ?? result.sellerMe.status ?? "REJECTED";
        setActualStatus(nextStatus);
        setApplication(result.application);
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [store.ready, store.getCurrentUser()?.id, store.getSellerApplication]);

  if (!store.ready || loadingStatus) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Panel>
          <div className="flex items-center gap-3">
            <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-muted">Đang kiểm tra trạng thái hồ sơ...</p>
          </div>
        </Panel>
      </main>
    );
  }

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi gửi hoặc theo dõi hồ sơ mở shop." />;
  }

  if (statusError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState title="Không tải được trạng thái seller" description={statusError} />
      </main>
    );
  }

  if (!hasProfile) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="Chưa có hồ sơ mở shop"
          description="Bạn cần gửi hồ sơ seller trước khi theo dõi trạng thái xét duyệt."
          action={<Button onClick={() => router.push("/seller/register")}>Gửi hồ sơ</Button>}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Panel>
        <StatusBadge status={actualStatus} label={sellerStatusLabel[actualStatus]} />
        <h1 className="mt-3 text-3xl font-black text-ink">Trạng thái shop: {sellerStatusLabel[actualStatus]}</h1>
        {application?.shopName ? <p className="mt-1 text-sm font-semibold text-muted">{application.shopName}</p> : null}
        <p className="mt-2 text-sm leading-6 text-muted">
          {actualStatus === "PENDING" && "Hồ sơ đang chờ admin duyệt."}
          {actualStatus === "REJECTED" && `Hồ sơ bị từ chối.${application?.rejectedReason ? ` Lý do: ${application.rejectedReason}.` : ""}`}
          {actualStatus === "SUSPENDED" && "Shop bị tạm ngưng, không được truy cập dashboard bán hàng."}
          {actualStatus === "APPROVED" && "Shop đã được duyệt. Bạn có thể vào kênh người bán."}
          {actualStatus === "CLOSED" && "Shop đã đóng."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {actualStatus === "APPROVED" ? <Button onClick={() => router.push("/seller")}>Vào kênh người bán</Button> : null}
          {actualStatus === "REJECTED" ? <Button onClick={() => router.push("/seller/register")}>Sửa hồ sơ</Button> : null}
          <Button variant="secondary" onClick={() => router.push("/")}>Về marketplace</Button>
        </div>
      </Panel>
    </main>
  );
}
