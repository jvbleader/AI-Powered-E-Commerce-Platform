"use client";

import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Box,
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
  Bot,
  UserPlus,
  Scale,
  Wallet,
  Landmark
} from "lucide-react";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
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
    <Link href={href} className={cn(NAV_LINK_CLASS, active && activeLinkClass)} title={label}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
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
          ["/seller/finance", "Tài chính", Wallet],
          ["/seller/chat", "Tin nhắn", MessageSquare],
          ["/seller/category-suggestions", "Đề xuất category", TicketPercent]
        ]
      : kind === "admin"
        ? [
            ["/admin", "Tổng quan", LayoutDashboard],
            ["/admin/finance", "Tài chính sàn", Landmark],
            ["/admin/users", "Người dùng", Users],
            ["/admin/sellers", "Người bán", Store],
            ["/admin/categories", "Danh mục", PanelLeft],
            ["/admin/products", "Sản phẩm", Package],
            ["/admin/violation-reports", "Báo cáo vi phạm", ShieldCheck],
            ["/admin/ai/knowledge", "Tri thức AI", Bot],
            ["/admin/role-management", "Tạo tài khoản", UserPlus]
          ]
        : [
            ["/supporter", "Dashboard", LayoutDashboard],
            ["/supporter/conversations", "Conversations", MessageSquare],
            ["/supporter/disputes", "Khiếu nại hoàn hàng", Scale]
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
        <Link key={href} href={href} className={cn(NAV_LINK_CLASS, pathname === href && activeLinkClass)} title={label}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Link>
      )
    );

  const frame = (
    <div className="h-screen bg-canvas flex flex-col overflow-hidden">
      <div className="border-b border-line bg-white shrink-0">
        <div className="flex items-center justify-between px-6 py-3">
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
              <div className="flex items-center gap-2 mr-2">
                {store.getCurrentShop()?.logoUrl ? (
                  <img
                    src={store.getCurrentShop()?.logoUrl}
                    alt={store.getCurrentShop()?.shopName}
                    className="h-8 w-8 rounded-full object-cover border border-line"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                    {store.getCurrentShop()?.shopName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-ink leading-tight">{store.getCurrentShop()?.shopName}</span>
                  <span className="text-xs text-muted leading-tight">{store.getCurrentUser()?.fullName}</span>
                </div>
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
          <div className={cn("w-full px-6 py-5 grid gap-4 items-start transition-all duration-300", kind !== "supporter" ? (store.state.sidebarCollapsed ? "lg:grid-cols-[80px_1fr]" : "lg:grid-cols-[250px_1fr]") : "")}>
            {kind !== "supporter" && (
              <aside className="sticky top-5 h-[calc(100vh-6.5rem)] overflow-hidden rounded-panel border border-line bg-white p-3 hidden lg:flex flex-col">
                <nav className={cn("grid gap-1", store.state.sidebarCollapsed ? "[&_span]:hidden [&_a]:justify-center [&_a]:px-0" : "")}>{renderSellerOrDefaultNav()}</nav>
                <div className="mt-auto pt-2 border-t border-line flex justify-center">
                  <button
                    onClick={() => store.toggleSidebar()}
                    className="p-1.5 rounded-full text-muted hover:text-primary hover:bg-slate-50 transition-colors"
                    title={store.state.sidebarCollapsed ? "Mở rộng" : "Thu gọn"}
                  >
                    {store.state.sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                  </button>
                </div>
              </aside>
            )}
            <main className="min-w-0 flex flex-col [&>section]:pt-0">{children}</main>
          </div>
        </div>
      ) : (
        <div className={cn("w-full flex-1 overflow-hidden px-6 py-5 grid gap-4 transition-all duration-300", kind !== "supporter" ? (store.state.sidebarCollapsed ? "lg:grid-cols-[80px_1fr]" : "lg:grid-cols-[250px_1fr]") : "")}>
          {kind !== "supporter" && (
            <aside className="h-full overflow-hidden rounded-panel border border-line bg-white p-3 hidden lg:flex flex-col">
              <nav className={cn("grid gap-1", store.state.sidebarCollapsed ? "[&_span]:hidden [&_a]:justify-center [&_a]:px-0" : "")}>{renderSellerOrDefaultNav()}</nav>
              <div className="mt-auto pt-2 border-t border-line flex justify-center">
                <button
                  onClick={() => store.toggleSidebar()}
                  className="p-1.5 rounded-full text-muted hover:text-primary hover:bg-slate-50 transition-colors"
                  title={store.state.sidebarCollapsed ? "Mở rộng" : "Thu gọn"}
                >
                  {store.state.sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </button>
              </div>
            </aside>
          )}
          <main className="min-w-0 h-full overflow-y-auto flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&>section]:pt-0">{children}</main>
        </div>
      )}
    </div>
  );

  if (kind === "seller") {
    return <SellerChatInboxProvider>{frame}</SellerChatInboxProvider>;
  }

  return frame;
}
