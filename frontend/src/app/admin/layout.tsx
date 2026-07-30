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
      <DashboardFrame kind="admin">
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
        title="Không có quyền truy cập"
        description="Bạn cần đăng nhập với tài khoản Admin để tiếp tục."
      />
    );
  }

  if (!store.getCurrentUser()!.roles.includes("ADMIN")) {
    return (
      <Unauthorized
        title="Không có quyền truy cập"
        description="Bạn không có quyền truy cập trang quản trị."
      />
    );
  }

  return <DashboardFrame kind="admin">{children}</DashboardFrame>;
}
