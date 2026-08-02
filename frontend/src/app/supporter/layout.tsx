"use client";

import React from "react";
import { LoadingPage } from "@/components/ui/feedback";
import { DashboardFrame } from "@/components/dashboard-frame";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

import { Skeleton } from "@/components/ui/skeleton";

export default function SupporterLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const store = useMarketplaceStore();

  if (!store.ready) {
    return (
      <>
        <div id="supporter-ssr-blank" style={{ display: "block" }} suppressHydrationWarning>
          <div className="min-h-screen bg-canvas" />
        </div>
        <div id="supporter-ssr-skeleton" style={{ display: "none" }} suppressHydrationWarning>
          <div className="bg-canvas min-h-screen text-slate-900">
            <DashboardFrame kind="supporter">
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
                  if (p.activeRole === 'SUPPORTER') {
                    var b = document.getElementById('supporter-ssr-blank');
                    var sk = document.getElementById('supporter-ssr-skeleton');
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
