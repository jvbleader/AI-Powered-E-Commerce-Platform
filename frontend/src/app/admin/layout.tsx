"use client";

import React from "react";
import { LoadingPage } from "@/components/ui/feedback";
import { DashboardFrame } from "@/components/dashboard-frame";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const store = useMarketplaceStore();

  if (!store.ready) {
    return (
      <>
        <div id="admin-ssr-blank" style={{ display: "block" }} suppressHydrationWarning>
          <div className="min-h-screen bg-canvas" />
        </div>
        <div id="admin-ssr-skeleton" style={{ display: "none" }} suppressHydrationWarning>
          <div className="bg-canvas min-h-screen text-slate-900">
            <DashboardFrame kind="admin">
              <div className="p-4 space-y-4 h-full flex flex-col">
                <div className="h-8 w-64 mb-4 rounded-md bg-slate-200/50 animate-pulse" />
                <div className="flex-1 rounded-panel border border-line bg-white" />
              </div>
            </DashboardFrame>
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = localStorage.getItem('shepoo-marketplace-state-v5');
                if (s) {
                  var p = JSON.parse(s);
                  if (p.activeRole === 'ADMIN') {
                    var b = document.getElementById('admin-ssr-blank');
                    var sk = document.getElementById('admin-ssr-skeleton');
                    if (b && sk) {
                      b.style.display = 'none';
                      sk.style.display = 'block';
                    }
                  }
                }
              } catch(e) {}
            `
          }}
        />
      </>
    );
  }

  const currentUser = store.getCurrentUser();
  if (!currentUser) {
    return (
      <Unauthorized
        title="Không có quyền truy cập"
        description="Bạn cần đăng nhập với tài khoản Quản trị viên hoặc Hỗ trợ viên để tiếp tục."
      />
    );
  }

  if (!currentUser.roles.includes("ADMIN") && !currentUser.roles.includes("SUPPORTER")) {
    return (
      <Unauthorized
        title="Không có quyền truy cập"
        description="Bạn không có quyền truy cập trang quản trị & hỗ trợ."
      />
    );
  }

  const frameKind = currentUser.roles.includes("ADMIN") ? "admin" : "supporter";
  return <DashboardFrame kind={frameKind}>{children}</DashboardFrame>;
}
