"use client";

import React from "react";
import { RefreshCcw } from "lucide-react";
import { Panel } from "@/components/ui/containers";
import { DashboardFrame } from "@/components/dashboard-frame";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerDashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const store = useMarketplaceStore();

  if (!store.ready) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <Panel>
          <div className="flex items-center gap-3">
            <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-muted">Đang tải...</p>
          </div>
        </Panel>
      </main>
    );
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
