"use client";

import React, { useEffect, useState } from "react";
import { LoadingPage } from "@/components/ui/feedback";
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

  if (!store.ready || loadingSeller) {
    return (
      <DashboardFrame kind="seller">
         <div className="p-4 space-y-4 h-full flex flex-col">
           <Skeleton className="h-8 w-64 mb-4" />
           <div className="flex-1 rounded-panel border border-line bg-white p-6">
             <Skeleton className="h-10 w-full mb-6" />
             <div className="space-y-4">
               <Skeleton className="h-16 w-full" />
               <Skeleton className="h-16 w-full" />
               <Skeleton className="h-16 w-full" />
             </div>
           </div>
         </div>
      </DashboardFrame>
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

