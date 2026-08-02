"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { fetchCategories } from "@/services/product-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { MarketplaceHeader, MarketplaceFooter } from "@/components/shared/navbar";
import { ChatWidget } from "@/components/ai/ChatWidget";

import { DashboardFrame } from "@/components/dashboard-frame";
import { Skeleton } from "@/components/ui/skeleton";

function RedirectTo({ href, kind }: { href: string; kind?: "admin" | "seller" | "supporter" }) {
  const router = useRouter();
  useEffect(() => {
    document.documentElement.classList.remove('hide-until-redirect');
    router.replace(href);
  }, [href, router]);

  if (kind) {
    return (
      <div className="bg-canvas min-h-screen text-slate-900">
        <DashboardFrame kind={kind}>
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
      </div>
    );
  }

  return (
    <main className="flex min-h-screen w-full items-start justify-center bg-[#faf6f0] px-4 pt-20 sm:pt-32 pb-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center animate-in fade-in-50 duration-200">
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
  const setCategories = useMarketplaceStore((s) => s.setCategories);
  const fetchAddresses = useMarketplaceStore((s) => s.fetchAddresses);

  const currentUser = useMarketplaceStore((s) => s.state.users.find((u) => u.id === s.state.sessionUserId));
  const currentUserId = currentUser?.id;
  const currentRoles = currentUser?.roles ?? [];

  let forcedKind: "admin" | "seller" | "supporter" | undefined;
  const forcedDashboardPath = !isDashboardRoute
    ? activeRole === "ADMIN" && currentRoles.includes("ADMIN")
      ? (forcedKind = "admin", "/admin")
      : activeRole === "SUPPORTER" && currentRoles.includes("SUPPORTER")
        ? (forcedKind = "supporter", "/supporter")
        : activeRole === "SELLER" && currentRoles.includes("SELLER")
          ? (forcedKind = "seller", "/seller")
          : ""
    : "";

  const fetchedUserAddressesRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || forcedDashboardPath) return;
    let active = true;
    // Always fetch latest categories from DB on mount
    fetchCategories().then((res) => {
      if (active && res.ok && res.categories) {
        setCategories(res.categories as any);
      }
    });
    if (currentUserId && fetchedUserAddressesRef.current !== currentUserId) {
      fetchedUserAddressesRef.current = currentUserId;
      fetchAddresses();
    }
    return () => {
      active = false;
    };
  }, [currentUserId, fetchAddresses, setCategories, ready, forcedDashboardPath]);

  if (forcedDashboardPath) {
    return <RedirectTo href={forcedDashboardPath} kind={forcedKind} />;
  }

  const isChatRoute = pathname === "/chat";

  if (isChatRoute) {
    return (
      <div className="h-screen bg-canvas text-slate-900 flex flex-col overflow-hidden">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-slate-900 flex flex-col justify-between pt-[144px]">
      {!ready ? (
        <div className="fixed top-0 left-0 right-0 z-50 h-[144px] bg-white border-b border-line shadow-sm" />
      ) : (
        <MarketplaceHeader />
      )}

      <ErrorBoundary>{children}</ErrorBoundary>

      {ready && (
        <>
          <ChatWidget />
          <MarketplaceFooter />
        </>
      )}
    </div>
  );
}



