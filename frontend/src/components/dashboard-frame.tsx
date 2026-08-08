"use client";

import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Box,
  ChartNoAxesCombined,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  TicketPercent,
  Users,
  PanelLeft,
  ShieldCheck,
  MessageSquare,
  ClipboardCheck,
  Bot
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { roleHomePath } from "@/store/slices/types";
import { BRAND_NAME, NAV_LINK_CLASS } from "@/lib/constants";
import {
  SellerChatInboxProvider,
  useOptionalSellerChatInboxContext
} from "@/components/seller/SellerChatInboxProvider";

const activeLinkClass = "bg-white text-primary shadow-sm";

const kindLabel: Record<string, string> = {
  seller: "Người bán",
  admin: "Quản trị",
  supporter: "Hỗ trợ"
};

function SellerNavLink({
  href,
  label,
  Icon,
  active
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  const inbox = useOptionalSellerChatInboxContext();
  const showBadge = href === "/seller/chat" && (inbox?.unreadCount ?? 0) > 0;

  return (
    <Link href={href} className={cn(NAV_LINK_CLASS, active && activeLinkClass)}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {showBadge ? (
        <span className="ml-auto inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
          {inbox!.unreadCount > 99 ? "99+" : inbox!.unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardFrame({
  kind,
  children
}: {
  kind: "seller" | "admin" | "supporter";
  children: ReactNode;
}) {
  const store = useMarketplaceStore();
  const pathname = usePathname() || "/";
  const router = useRouter();

  const nav: Array<[string, string, LucideIcon]> =
    kind === "seller"
      ? [
          ["/seller", "Dashboard", LayoutDashboard],
          ["/seller/profile", "Hồ sơ shop", Store],
          ["/seller/products", "Sản phẩm", Package],
          ["/seller/inventory", "Tồn kho", Box],
          ["/seller/orders", "Đơn hàng", ShoppingBag],
          ["/seller/chat", "Tin nhắn", MessageSquare],
          ["/seller/revenue", "Doanh thu", ChartNoAxesCombined],
          ["/seller/category-suggestions", "Đề xuất category", TicketPercent]
        ]
      : kind === "admin"
        ? [
            ["/admin", "Dashboard", LayoutDashboard],
            ["/admin/users", "Users", Users],
            ["/admin/sellers", "Sellers", Store],
            ["/admin/categories", "Categories", PanelLeft],
            ["/admin/products", "Products", Package],
            ["/admin/statistics", "Statistics", ChartNoAxesCombined],
            ["/admin/violation-reports", "Reports", ShieldCheck],
            ["/admin/supporters", "Supporters", MessageSquare],
            ["/admin/chats", "Chats", MessageSquare],
            ["/admin/system-reports", "System", ClipboardCheck],
            ["/admin/ai/knowledge", "AI Knowledge", Bot],
            ["/admin/role-management", "Phân quyền", ShieldCheck]
          ]
        : [
            ["/supporter", "Dashboard", LayoutDashboard],
            ["/supporter/conversations", "Conversations", MessageSquare]
          ];

  const homeHref = roleHomePath(kind.toUpperCase() as any);
  const currentUser = store.getCurrentUser();
  const canSwitchToBuyer =
    Boolean(currentUser) &&
    Boolean(currentUser?.roles?.includes("CUSTOMER")) &&
    kind !== "admin" &&
    kind !== "supporter";

  const renderSellerOrDefaultNav = () =>
    nav.map(([href, label, Icon]) =>
      kind === "seller" ? (
        <SellerNavLink
          key={href}
          href={href}
          label={label}
          Icon={Icon}
          active={pathname === href}
        />
      ) : (
        <Link key={href} href={href} className={cn(NAV_LINK_CLASS, pathname === href && activeLinkClass)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </Link>
      )
    );

  const frame = (
    <div className="h-screen bg-canvas flex flex-col overflow-hidden">
      <div className="border-b border-line bg-white shrink-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={homeHref} className="flex items-center gap-2 font-black text-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-panel bg-primary text-white">S</span>
              <span>{BRAND_NAME}</span>
              <span className="text-muted text-sm font-normal">– {kindLabel[kind]}</span>
            </Link>

            {kind === "supporter" && (
              <nav className="hidden md:flex items-center gap-1">
                {nav.map(([href, label, Icon]) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-colors",
                      pathname === href ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2">
            {kind === "seller" && store.getCurrentShop() ? (
              <div className="flex flex-col items-end mr-2">
                <span className="text-sm font-medium text-ink leading-tight">{store.getCurrentShop()?.shopName}</span>
                <span className="text-xs text-muted leading-tight">{store.getCurrentUser()?.fullName}</span>
              </div>
            ) : (
              <span className="text-sm text-muted mr-2">{store.getCurrentUser()?.fullName ?? "Khách"}</span>
            )}
            {canSwitchToBuyer ? (
              <Button
                variant="secondary"
                onClick={() => {
                  store.switchRole("CUSTOMER");
                  router.push("/");
                }}
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Mua hàng
              </Button>
            ) : null}
            <IconButton
              aria-label="Đăng xuất"
              onClick={async () => {
                await store.logout();
                if (typeof window !== "undefined") {
                  window.location.href = "/login?logout=1";
                }
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>
      {pathname.includes("/violation-reports") ? (
        <div className="w-full flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className={cn("mx-auto w-full max-w-7xl px-4 py-5 grid gap-4 items-start", kind !== "supporter" ? "lg:grid-cols-[250px_1fr]" : "")}>
            {kind !== "supporter" && (
              <aside className="sticky top-5 h-[calc(100vh-6.5rem)] overflow-y-auto rounded-panel border border-line bg-white p-3 hidden lg:block [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <nav className="grid gap-1 pb-4">{renderSellerOrDefaultNav()}</nav>
              </aside>
            )}
            <main className="min-w-0 flex flex-col">{children}</main>
          </div>
        </div>
      ) : (
        <div className={cn("mx-auto w-full flex-1 overflow-hidden max-w-7xl px-4 py-5 grid gap-4", kind !== "supporter" ? "lg:grid-cols-[250px_1fr]" : "")}>
          {kind !== "supporter" && (
            <aside className="h-full overflow-y-auto rounded-panel border border-line bg-white p-3 hidden lg:block">
              <nav className="grid gap-1">{renderSellerOrDefaultNav()}</nav>
            </aside>
          )}
          <main className="min-w-0 h-full overflow-y-auto flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">{children}</main>
        </div>
      )}
    </div>
  );

  if (kind === "seller") {
    return <SellerChatInboxProvider>{frame}</SellerChatInboxProvider>;
  }

  return frame;
}
