"use client";

import React, { useEffect, useState } from "react";
import { LoadingPage } from "@/components/ui/feedback";
import { DashboardFrame } from "@/components/dashboard-frame";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerDashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const store = useMarketplaceStore();
  const [loadingSeller, setLoadingSeller] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const user = store.getCurrentUser();
    if (store.ready && user?.roles.includes("SELLER")) {
      store.getSellerApplication()
        .finally(() => {
          if (!cancelled) setLoadingSeller(false);
        });
    } else if (store.ready) {
      setLoadingSeller(false);
    }
    return () => {
      cancelled = true;
    };
  }, [store.ready, store.getCurrentUser()?.id, store.getSellerApplication]);

  if (!store.ready || loadingSeller) {
    return <LoadingPage message="Đang tải thông tin shop..." />;
  }

  if (!store.getCurrentUser()) {
    return (
      <Unauthorized
        title="Cần đăng nhập"
        description="Bạn cần đăng nhập trước khi truy cập dashboard người bán."
      />
    );
  }

  if (!store.getCurrentUser()!.roles.includes("SELLER")) {
    return (
      <Unauthorized
        title="Không có quyền truy cập"
        description="Bạn cần có tài khoản Người bán để truy cập trang này."
      />
    );
  }

  return <DashboardFrame kind="seller">{children}</DashboardFrame>;
}

