"use client";

import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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

const activeLinkClass = "bg-white text-primary shadow-sm";

const kindLabel: Record<string, string> = {
  seller: "Người bán",
  admin: "Quản trị",
  supporter: "Hỗ trợ"
};



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
            ["/admin/ai/knowledge", "AI Knowledge", Bot]
          ]
        : [
            ["/supporter", "Dashboard", LayoutDashboard],
            ["/supporter/conversations", "Conversations", MessageSquare]
          ];

  const homeHref = roleHomePath(kind.toUpperCase() as any);
  const canSwitchToBuyer = Boolean(store.getCurrentUser());

  return (
    <div className="min-h-screen bg-canvas">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <a href={homeHref} className="flex items-center gap-2 font-black text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-panel bg-primary text-white">S</span>
            <span>{BRAND_NAME}</span>
            <span className="text-muted text-sm font-normal">– {kindLabel[kind]}</span>
          </a>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{store.getCurrentUser()?.fullName ?? "Khách"}</span>
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
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-panel border border-line bg-white p-3">
          <nav className="grid gap-1">
            {nav.map(([href, label, Icon]) => (
              <a key={href} href={href} className={cn(NAV_LINK_CLASS, pathname === href && activeLinkClass)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </a>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
