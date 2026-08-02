"use client";

import React, { useEffect, useState } from "react";
import { DashboardFrame } from "@/components/dashboard-frame";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

import { Skeleton } from "@/components/ui/skeleton";

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

  // Handle access denied states immediately once store is ready
  if (store.ready) {
    const user = store.getCurrentUser();
    if (!user) {
      return (
        <Unauthorized
          title="Cần đăng nhập"
          description="Bạn cần đăng nhập trước khi truy cập dashboard người bán."
        />
      );
    }

    if (!user.roles.includes("SELLER")) {
      return (
        <Unauthorized
          title="Không có quyền truy cập"
          description="Bạn cần có tài khoản Người bán để truy cập trang này."
        />
      );
    }
  }

  if (!store.ready || loadingSeller) {
    return (
      <>
        <div id="seller-ssr-blank" style={{ display: "block" }} suppressHydrationWarning>
          <div className="min-h-screen bg-canvas" />
        </div>
        <div id="seller-ssr-skeleton" style={{ display: "none" }} suppressHydrationWarning>
          <div className="bg-canvas min-h-screen text-slate-900">
            <DashboardFrame kind="seller">
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
                  if (p.activeRole === 'SELLER') {
                    var b = document.getElementById('seller-ssr-blank');
                    var sk = document.getElementById('seller-ssr-skeleton');
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

  return <DashboardFrame kind="seller">{children}</DashboardFrame>;
}

