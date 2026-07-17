"use client";

import React from "react";
import { RefreshCcw } from "lucide-react";
import { Panel } from "@/components/ui/containers";
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
