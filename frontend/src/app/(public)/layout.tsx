"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { fetchCategories } from "@/services/product-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { MarketplaceHeader, MarketplaceFooter } from "@/components/shared/navbar";

function RedirectTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4 bg-[#eaf0f6]">
      <div className="bento-card w-full max-w-md rounded-2xl p-8 text-center border border-slate-200 bg-white shadow-xl">
        <Sparkles className="mx-auto h-8 w-8 text-emerald-600 animate-spin" aria-hidden="true" />
        <p className="mt-4 font-heading text-base font-bold text-slate-900">Đang chuyển hướng hệ thống...</p>
      </div>
    </main>
  );
}

export default function MarketplaceLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const segments = pathname.split("/").filter(Boolean);
  const isDashboardRoute = ["seller", "admin", "supporter"].includes(segments[0] ?? "");

  const ready = useMarketplaceStore((s) => s.ready);
  const activeRole = useMarketplaceStore((s) => s.state.activeRole);
  const categoriesLength = useMarketplaceStore((s) => s.state.categories.length);
  const setCategories = useMarketplaceStore((s) => s.setCategories);
  const fetchAddresses = useMarketplaceStore((s) => s.fetchAddresses);

  const currentUser = useMarketplaceStore((s) => s.state.users.find((u) => u.id === s.state.sessionUserId));
  const currentUserId = currentUser?.id;
  const currentRoles = currentUser?.roles ?? [];

  const forcedDashboardPath = !isDashboardRoute
    ? activeRole === "ADMIN" && currentRoles.includes("ADMIN")
      ? "/admin"
      : activeRole === "SUPPORTER" && currentRoles.includes("SUPPORTER")
        ? "/supporter"
        : activeRole === "SELLER" && currentRoles.includes("SELLER")
          ? "/seller"
          : ""
    : "";

  const fetchedUserAddressesRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    if (categoriesLength === 0) {
      fetchCategories().then((res) => {
        if (active && res.ok && res.categories) {
          setCategories(res.categories as any);
        }
      });
    }
    if (currentUserId && fetchedUserAddressesRef.current !== currentUserId) {
      fetchedUserAddressesRef.current = currentUserId;
      fetchAddresses();
    }
    return () => {
      active = false;
    };
  }, [currentUserId, categoriesLength, fetchAddresses, setCategories]);

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 bg-[#eaf0f6]">
        <div className="bento-card w-full max-w-md rounded-2xl p-8 text-center border border-slate-200 bg-white shadow-xl">
          <Sparkles className="mx-auto h-8 w-8 text-emerald-600 animate-pulse" aria-hidden="true" />
          <h1 className="mt-4 font-heading text-xl font-extrabold text-slate-900">Đang Khởi Động Shepoo</h1>
          <p className="mt-2 text-xs text-slate-500">Đang chuẩn bị giao diện Porcelain Light...</p>
        </div>
      </main>
    );
  }

  if (forcedDashboardPath) {
    return <RedirectTo href={forcedDashboardPath} />;
  }

  return (
    <div className="min-h-screen bg-[#eaf0f6] text-slate-900 flex flex-col justify-between">
      <MarketplaceHeader />
      <ErrorBoundary>{children}</ErrorBoundary>
      <MarketplaceFooter />
    </div>
  );
}



