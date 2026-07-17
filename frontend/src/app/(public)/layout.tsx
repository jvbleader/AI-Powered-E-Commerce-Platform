"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  User
} from "lucide-react";
import { hotKeywords } from "@/store/initial-state";
import { Button, IconButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/containers";
import { SearchField } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/error-boundary";
import { searchSuggestions } from "@/lib/helpers";
import { fetchCategories } from "@/services/product-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { BRAND_NAME, NAV_LINK_CLASS } from "@/lib/constants";



function RedirectTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4">
      <Panel className="w-full max-w-md text-center">
        <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-muted">Đang chuyển hướng...</p>
      </Panel>
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

  const ready = useMarketplaceStore(s => s.ready);
  const activeRole = useMarketplaceStore(s => s.state.activeRole);
  const categoriesLength = useMarketplaceStore(s => s.state.categories.length);
  const setCategories = useMarketplaceStore(s => s.setCategories);
  const fetchAddresses = useMarketplaceStore(s => s.fetchAddresses);
  
  const currentUser = useMarketplaceStore(s => s.state.users.find(u => u.id === s.state.sessionUserId));
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
    return () => { active = false; };
  }, [currentUserId, categoriesLength, fetchAddresses, setCategories]);

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
        <Panel className="w-full max-w-md text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-bold">Đang mở Shepoo</h1>
          <p className="mt-1 text-sm text-muted">Đang chuẩn bị giao diện mua sắm.</p>
        </Panel>
      </main>
    );
  }

  if (forcedDashboardPath) {
    return <RedirectTo href={forcedDashboardPath} />;
  }

  return (
    <div className="min-h-screen">
      <MarketplaceHeader />
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <MarketplaceFooter />
    </div>
  );
}

function MarketplaceHeader() {
  const store = useMarketplaceStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const suggestions = searchSuggestions(query, store.state.products, store.state.shops, store.state.categories);
  const selectedCount = store.getCartRows().reduce((sum, row) => sum + row.item.quantity, 0);
  const currentRoles = store.getCurrentUser()?.roles ?? [];
  const canSwitchBuyerSeller = currentRoles.includes("CUSTOMER") && currentRoles.includes("SELLER");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center gap-3">
          <a href="/" className="flex shrink-0 items-center gap-2" aria-label="Shepoo trang chủ">
            <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-primary text-lg font-black text-white">
              S
            </span>
            <span className="hidden text-xl font-black text-ink sm:inline">{BRAND_NAME}</span>
          </a>
          <div className="relative min-w-0 flex-1">
            <SearchField value={query} onChange={setQuery} />
            {query ? (
              <div className="absolute left-0 right-0 top-12 z-50 rounded-panel border border-line bg-white p-2 shadow-soft">
                {suggestions.length ? (
                  suggestions.map((item) => (
                    <a
                      key={`${item.type}-${item.href}`}
                      href={item.href}
                      className="flex items-center justify-between rounded-panel px-3 py-2 text-sm hover:bg-canvas"
                    >
                      <span className="truncate font-semibold text-ink">{item.label}</span>
                      <span className="text-xs text-muted">{item.type}</span>
                    </a>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-muted">Không có gợi ý phù hợp.</p>
                )}
              </div>
            ) : null}
          </div>
          <IconButton aria-label="Mở menu" className="lg:hidden" onClick={() => setMobileNavOpen((value) => !value)}>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </IconButton>
          <nav className="hidden items-center gap-1 lg:flex">
            <a className={NAV_LINK_CLASS} href="/products">
              <Search className="h-4 w-4" aria-hidden="true" />
              Sản phẩm
            </a>
            <a className={NAV_LINK_CLASS} href="/chat">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Chat
            </a>
            <a className={NAV_LINK_CLASS} href="/cart">
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              Giỏ hàng
              <span className="rounded-[6px] bg-coral px-1.5 py-0.5 text-xs text-white">{selectedCount}</span>
            </a>
            {store.getCurrentUser() ? (
              <>
                <a className={NAV_LINK_CLASS} href="/account">
                  <User className="h-4 w-4" aria-hidden="true" />
                  {store.getCurrentUser()!.fullName.split(" ").slice(-1)}
                </a>
                {canSwitchBuyerSeller ? (
                  <Button
                    variant="secondary"
                    className="px-3"
                    onClick={() => {
                      store.switchRole("SELLER");
                      router.push("/seller");
                    }}
                  >
                    <Store className="h-4 w-4" aria-hidden="true" />
                    Kênh người bán
                  </Button>
                ) : null}
                <IconButton aria-label="Đăng xuất" onClick={store.logout}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </>
            ) : (
              <>
                <a className={NAV_LINK_CLASS} href="/login">
                  Đăng nhập
                </a>
                <a className="inline-flex min-h-10 items-center rounded-panel bg-primary px-3 py-2 text-sm font-bold text-white" href="/register">
                  Đăng ký
                </a>
              </>
            )}
          </nav>
        </div>
        <div className="mt-3 hidden gap-2 overflow-x-auto lg:flex">
          {store.state.categories.map((category) => (
            <a
              key={category.id}
              className="shrink-0 rounded-panel border border-line bg-white px-3 py-1.5 text-sm font-semibold text-muted hover:border-primary/40 hover:text-primary"
              href={`/categories/${category.slug}`}
            >
              {category.name}
            </a>
          ))}
        </div>
        {mobileNavOpen ? (
          <div className="mt-3 grid gap-2 lg:hidden">
            {[
              ["/products", "Sản phẩm"],
              ["/cart", "Giỏ hàng"],
              ["/account", "Tài khoản"],
              ["/seller/register", "Đăng ký người bán"],
              ["/chat", "Chat hỗ trợ"]
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-panel border border-line bg-white px-3 py-2 text-sm font-semibold">
                {label}
              </a>
            ))}
            {canSwitchBuyerSeller ? (
              <Button
                variant="secondary"
                onClick={() => {
                  store.switchRole("SELLER");
                  router.push("/seller");
                }}
              >
                <Store className="h-4 w-4" aria-hidden="true" />
                Kênh người bán
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function MarketplaceFooter() {
  return (
    <footer className="mt-8 border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Chính sách mua hàng", "Thanh toán an toàn và theo dõi đơn hàng rõ ràng."],
          ["Hỗ trợ", "Liên hệ hỗ trợ khi bạn cần thêm thông tin."],
          ["Marketplace", "Khám phá sản phẩm từ nhiều cửa hàng trên Shepoo."],
          ["Người bán", "Quản lý sản phẩm và đơn hàng trong kênh người bán."]
        ].map(([title, text]) => (
          <div key={title}>
            <h3 className="font-bold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
          </div>
        ))}
      </div>
    </footer>
  );
}
