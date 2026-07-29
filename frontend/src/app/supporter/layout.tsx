"use client";

import React from "react";
import { LoadingPage } from "@/components/ui/feedback";
import { DashboardFrame } from "@/components/dashboard-frame";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SupporterLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const store = useMarketplaceStore();

  if (!store.ready) {
    return <LoadingPage message="Đang tải trang hỗ trợ..." />;
  }

  if (!store.getCurrentUser()) {
    return (
      <Unauthorized
        title="Không có quyền truy cập"
        description="Bạn cần đăng nhập với tài khoản Supporter để tiếp tục."
      />
    );
  }

  if (!store.getCurrentUser()!.roles.includes("SUPPORTER")) {
    return (
      <Unauthorized
        title="Không có quyền truy cập"
        description="Bạn không có quyền truy cập trang supporter."
      />
    );
  }

  return <DashboardFrame kind="supporter">{children}</DashboardFrame>;
}
