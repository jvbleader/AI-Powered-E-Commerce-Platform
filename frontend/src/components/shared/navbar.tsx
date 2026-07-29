"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  ChevronDown,
  Compass,
  Grid,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Phone,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  User,
  X
} from "lucide-react";

import { searchSuggestions, formatDate } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { BRAND_NAME } from "@/lib/constants";
import { SearchField } from "@/components/ui/input";
import { Button, IconButton } from "@/components/ui/button";

const CATEGORY_ICONS: Record<string, string> = {
  "thoi-trang": "👕",
  "dien-tu": "📱",
  "gia-dung": "🏠",
  "lam-dep": "💄",
  "the-thao": "⚽",
  "sach": "📚",
  "do-choi": "🧸",
  "thuc-pham": "🍎"
};



export function MarketplaceHeader() {
  const store = useMarketplaceStore();
  const router = useRouter();
  const pathname = usePathname() || "/";

  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [catMoreOpen, setCatMoreOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const notifications = store.state.notifications;
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const catMoreRef = useRef<HTMLDivElement>(null);

  const suggestions = searchSuggestions(
    query,
    store.state.products,
    store.state.shops,
    store.state.categories
  );

  const selectedCount = store.getCartRows().reduce((sum, row) => sum + row.item.quantity, 0);
  const currentUser = store.getCurrentUser();
  const currentRoles = currentUser?.roles ?? [];
  const canSwitchBuyerSeller = currentRoles.includes("CUSTOMER") && currentRoles.includes("SELLER");

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (catMoreRef.current && !catMoreRef.current.contains(event.target as Node)) {
        setCatMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isScrolled, setIsScrolled] = useState(false);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
    setUserMenuOpen(false);
    setNotifOpen(false);
    setCartOpen(false);
  }, [pathname]);

  // Hallmark N10 Floating Morph + Ribbon Height Hysteresis Buffer (>85px / <20px) to prevent layout feedback loop
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          if (y > 85) {
            setIsScrolled(true);
          } else if (y < 20) {
            setIsScrolled(false);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full pointer-events-none isolate">
      {/* TOP ANNOUNCEMENT BAR (Permanently fixed at top edge at all times) */}
      <div className="bg-slate-900 text-slate-300 text-[11px] py-1.5 px-4 border-b border-slate-800 w-full pointer-events-auto">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-medium text-slate-300 overflow-x-auto no-scrollbar">
            <a href="/seller" className="hover:text-emerald-400 transition-colors flex items-center gap-1 shrink-0">
              <Store className="h-3.5 w-3.5 text-emerald-400" />
              Kênh người bán
            </a>
            <span className="text-slate-800">|</span>
            <a href="/seller/register" className="hover:text-emerald-400 transition-colors shrink-0">
              Trở thành người bán
            </a>
            <span className="text-slate-800">|</span>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 shrink-0"
              title="Ghé thăm Fanpage chính thức"
            >
              <svg className="h-3.5 w-3.5 text-[#1877F2] fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Fanpage Facebook</span>
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4 text-slate-400 shrink-0 font-medium">
            <a href="tel:19006868" className="hover:text-emerald-300 transition-colors flex items-center gap-1.5 text-emerald-400 font-bold">
              <Phone className="h-3 w-3 text-emerald-400" />
              <span>Hotline: 1900 6868</span>
            </a>
            <span className="text-slate-800">|</span>
            <a href="/chat" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
              <Bot className="h-3 w-3" /> Hỗ trợ AI
            </a>
            <span className="text-slate-800">|</span>
            <span className="text-slate-300 font-semibold">🇻🇳 VN / VND</span>
          </div>
        </div>
      </div>

      {/* MAIN NAVIGATION BAR (Hallmark N10 Floating Morph) */}
      <div
        className={`mx-auto w-full nav-glass-header pointer-events-auto ${
          isScrolled ? "nav-glass-header-island" : ""
        }`}
      >
        <div
          className={`mx-auto w-full max-w-7xl px-4 sm:px-6 transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
            isScrolled ? "py-2" : "py-3"
          }`}
        >
          <div className="flex items-center justify-between gap-2.5 sm:gap-4 md:gap-6">
            {/* LOGO */}
            <a
              href="/"
              className="group flex shrink-0 items-center gap-2 sm:gap-2.5"
              aria-label={`${BRAND_NAME} Trang chủ`}
            >
              <div className="relative">
                <span
                  className={`flex items-center justify-center bg-emerald-600 font-heading font-black text-white shadow-sm transition-all duration-500 group-hover:scale-105 ${
                    isScrolled ? "h-9 w-9 text-lg rounded-xl" : "h-10 w-10 text-xl rounded-2xl"
                  }`}
                >
                  S
                </span>
              </div>
              <div className="hidden sm:flex flex-col items-center justify-center">
                <span
                  className={`font-heading font-black text-slate-900 tracking-tight leading-none group-hover:text-emerald-600 transition-all duration-500 ${
                    isScrolled ? "text-xl sm:text-2xl" : "text-2xl sm:text-[26px]"
                  }`}
                >
                  {BRAND_NAME}
                </span>
                <div
                  className={`transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) overflow-hidden origin-top ${
                    isScrolled ? "max-h-0 opacity-0 scale-y-0 mt-0" : "max-h-4 opacity-100 scale-y-100 mt-0.5"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-tight block">
                    Marketplace
                  </span>
                </div>
              </div>
            </a>

            {/* SEARCH AREA (Morphing search field with fixed center position) */}
            <div className="relative flex-1 flex items-center justify-center min-w-0 px-1 sm:px-2">
              <div
                className={`w-full transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
                  isScrolled ? "max-w-xs sm:max-w-sm md:max-w-md" : "max-w-xl lg:max-w-2xl"
                }`}
              >
                <SearchField
                  inputRef={searchInputRef}
                  value={query}
                  onChange={setQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  isScrolled={isScrolled}
                />

                {/* SEARCH SUGGESTION DROPDOWN */}
                {(isSearchFocused || query) && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 animate-scale-in rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl max-h-[80vh] overflow-y-auto">
                    {query ? (
                      suggestions.length ? (
                        <div className="space-y-1">
                          <div className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>Gợi ý tìm kiếm</span>
                            <span className="text-emerald-600">{suggestions.length} kết quả</span>
                          </div>
                          {suggestions.map((item) => (
                            <a
                              key={`${item.type}-${item.href}`}
                              href={item.href}
                              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-150 group"
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600" />
                                <span className="truncate font-bold text-slate-900 group-hover:text-emerald-700">
                                  {item.label}
                                </span>
                              </div>
                              <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                                {item.type}
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-500">
                          <Search className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                          Không tìm thấy từ khóa phù hợp với &quot;{query}&quot;
                        </div>
                      )
                    ) : (
                      <div className="space-y-3 p-1">
                        <div>
                          <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Tag className="h-3 w-3 text-emerald-600" />
                            Từ khóa hot hôm nay
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {["iPhone 15 Pro", "Tai nghe Bluetooth", "Áo Nam Basic", "Bàn Phím Cơ", "Mỹ Phẩm Korea"].map(
                              (tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => setQuery(tag)}
                                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:bg-emerald-55 hover:text-emerald-700 transition-all"
                                >
                                  {tag}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ACTION NAV LINKS */}
            <div className="hidden items-center gap-1 lg:flex shrink-0">
              <a
                href="/chat"
                className={`inline-flex items-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                  isScrolled ? "px-2.5 py-1.5" : "px-3 py-2"
                } ${
                  pathname.startsWith("/chat")
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-700 hover:bg-slate-200/50 hover:text-emerald-700"
                }`}
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                <span>Chat</span>
              </a>

              {/* NOTIFICATION BELL */}
              <div
                className="relative"
                ref={notifRef}
                onMouseEnter={() => setNotifOpen(true)}
                onMouseLeave={() => setNotifOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  className={`relative inline-flex items-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                    isScrolled ? "px-2.5 py-1.5" : "px-3 py-2"
                  } ${
                    notifOpen
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-700 hover:bg-slate-200/50 hover:text-emerald-700"
                  } active:scale-95`}
                  aria-label="Thông báo"
                >
                  <div className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-455 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                  <span>Thông báo</span>
                </button>

                {/* NOTIFICATION POPOVER */}
                {notifOpen && (
                  <div className="absolute right-0 top-11 z-50 w-80 animate-scale-in rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
                      <span className="font-heading text-xs font-bold text-slate-900">Thông báo mới</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setReadIds(new Set(notifications.map((n) => n.id)))}
                          className="text-[10px] font-bold text-emerald-600 hover:underline"
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-6 text-center text-[11px] text-slate-400">
                          <Bell className="mx-auto h-6 w-6 text-slate-200 mb-1.5" />
                          Không có thông báo nào
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isUnread = !readIds.has(n.id);
                          return (
                            <div
                              key={n.id}
                              className={`rounded-xl p-2.5 text-xs transition-colors ${
                                isUnread ? "bg-emerald-50/60" : "hover:bg-slate-50"
                              }`}
                            >
                              <div className="font-bold text-slate-900 flex items-center justify-between">
                                <span>{n.title}</span>
                                <span className="text-[9px] font-medium text-slate-400">
                                  {formatDate(n.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-600 leading-snug">{n.content}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CART ICON & POPOVER */}
              <div
                className="relative"
                onMouseEnter={() => {
                  setCartOpen(true);
                  store.refreshCart?.();
                }}
                onMouseLeave={() => setCartOpen(false)}
              >
                <a
                  href="/cart"
                  onClick={() => store.refreshCart?.()}
                  className={`relative inline-flex items-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                    isScrolled ? "px-2.5 py-1.5" : "px-3 py-2"
                  } ${
                    pathname === "/cart" || cartOpen
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-700 hover:bg-slate-200/50 hover:text-emerald-700"
                  }`}
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  <span>Giỏ hàng</span>
                  {selectedCount > 0 && (
                    <span className="animate-bounce-subtle rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                      {selectedCount}
                    </span>
                  )}
                </a>

                {/* CART HOVER POPOVER */}
                {cartOpen && (
                  <div className="absolute right-0 top-11 z-50 w-80 animate-scale-in rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
                      <span className="font-heading text-xs font-bold text-slate-900">Giỏ hàng mới thêm</span>
                      <a href="/cart" className="text-[10px] font-bold text-emerald-600 hover:underline">
                        Xem tất cả
                      </a>
                    </div>

                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
                      {store.getCartRows().length > 0 ? (
                        store.getCartRows().map((row) => (
                          <div key={row.item.id} className="flex gap-2.5 text-xs hover:bg-slate-50 p-1.5 rounded-xl transition-colors">
                            <img
                              src={row.product.thumbnailUrl}
                              alt={row.product.name}
                              className="h-10 w-10 shrink-0 rounded-lg object-cover bg-slate-100"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 truncate">{row.product.name}</p>
                              <p className="text-[10px] text-slate-500">Phân loại: {row.variant.variantName}</p>
                              <p className="text-[10px] text-slate-400">Số lượng: {row.item.quantity}</p>
                            </div>
                            <div className="text-right shrink-0 font-extrabold text-emerald-600">
                              {((row.variant.salePrice || row.variant.price) * row.item.quantity).toLocaleString()}đ
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-slate-400">
                          <ShoppingCart className="mx-auto h-8 w-8 text-slate-200 mb-2" />
                          Chưa có sản phẩm nào
                        </div>
                      )}
                    </div>

                    {store.getCartRows().length > 0 && (
                      <div className="mt-3 border-t border-slate-100 pt-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-slate-500">Tổng tiền tạm tính:</span>
                        <span className="text-xs font-black text-emerald-600">
                          {store.getCartRows().reduce((total, row) => total + (row.variant.salePrice || row.variant.price) * row.item.quantity, 0).toLocaleString()}đ
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* USER PROFILE DROPDOWN */}
              {currentUser ? (
                <div
                  className="relative ml-0.5"
                  ref={userMenuRef}
                  onMouseEnter={() => setUserMenuOpen(true)}
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 hover:border-emerald-450 hover:bg-emerald-50/50 transition-all duration-300 shadow-2xs active:scale-98 ${
                      isScrolled ? "px-2 py-1" : "px-2.5 py-1.5"
                    }`}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 font-heading text-xs font-black text-white shadow-2xs">
                      {currentUser.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="max-w-[100px] truncate">{currentUser.fullName.split(" ").slice(-1)}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  {/* MENU POPUP */}
                  {userMenuOpen && (
                    <div className="absolute right-0 top-11 z-50 w-64 animate-scale-in rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']">
                      <div className="border-b border-slate-100 p-2.5">
                        <p className="font-heading text-xs font-bold text-slate-900 truncate">{currentUser.fullName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {currentRoles.map((role) => (
                            <span
                              key={role}
                              className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 uppercase tracking-wider"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-1 space-y-0.5">
                        <a
                          href="/account"
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <User className="h-4 w-4 text-emerald-650" />
                          Tài khoản của tôi
                        </a>
                        <a
                          href="/account/orders"
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Package className="h-4 w-4 text-emerald-650" />
                          Đơn mua của tôi
                        </a>
                        {canSwitchBuyerSeller && (
                          <button
                            type="button"
                            onClick={() => {
                              store.switchRole("SELLER");
                              router.push("/seller");
                            }}
                            className="w-full flex items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors border border-amber-200"
                          >
                            <Store className="h-4 w-4 text-amber-600" />
                            Kênh Người Bán
                          </button>
                        )}
                      </div>

                      <div className="mt-1 border-t border-slate-100 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await store.logout();
                            if (typeof window !== "undefined") {
                              window.location.href = "/login";
                            }
                          }}
                          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 ml-1">
                  <a
                    href="/login"
                    className={`rounded-xl border border-slate-200 bg-white font-bold text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 shadow-2xs ${
                      isScrolled ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-xs"
                    }`}
                  >
                    Đăng nhập
                  </a>
                  <a
                    href="/register"
                    className={`rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500 transition-all duration-300 shadow-md ${
                      isScrolled ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-xs"
                    }`}
                  >
                    Đăng ký
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* CATEGORY NAV RIBBON (Collapses ultra smoothly on scroll) */}
          <div
            className={`hidden lg:block transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) overflow-hidden origin-top ${
              isScrolled
                ? "max-h-0 opacity-0 mt-0 pointer-events-none scale-y-95 -translate-y-1"
                : "max-h-14 opacity-100 mt-2.5 transform-none"
            }`}
          >
            <div className="relative flex items-center justify-center gap-2 py-1 px-4">
              <a
                href="/products"
                className={`shrink-0 inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-2xs ${
                  pathname === "/products"
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                    : "border-slate-200 bg-white/90 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                Tất cả sản phẩm
              </a>

              {store.state.categories.slice(0, 6).map((category) => {
                const isActive = pathname === `/categories/${category.slug}`;
                return (
                  <a
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className={`shrink-0 inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-2xs ${
                      isActive
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-md"
                        : "border-slate-200 bg-white/90 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    {category.name}
                  </a>
                );
              })}
              {store.state.categories.length > 6 && (
                <div
                  className="relative shrink-0"
                  ref={catMoreRef}
                >
                  <button
                    type="button"
                    onClick={() => setCatMoreOpen((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition-all ${
                      catMoreOpen
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white/90 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    <span>Xem thêm</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${catMoreOpen ? "rotate-180" : ""}`} />
                  </button>
                  {catMoreOpen && (() => {
                    const rect = catMoreRef.current?.getBoundingClientRect();
                    if (!rect) return null;

                    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
                    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
                    const allCategories = store.state.categories;
                    const filtered = categoryFilter
                      ? allCategories.filter((c) => c.name.toLowerCase().includes(categoryFilter.toLowerCase()))
                      : allCategories;

                    const popoverWidth = Math.min(800, Math.max(340, viewportWidth - 32));
                    let rightPos = viewportWidth - rect.right;
                    if (rightPos < 16) rightPos = 16;
                    if (viewportWidth - rightPos - popoverWidth < 16) {
                      rightPos = Math.max(16, viewportWidth - popoverWidth - 16);
                    }

                    return (
                      <div
                        style={{
                          position: "fixed",
                          top: Math.min(rect.bottom + 6, viewportHeight - 200),
                          right: rightPos,
                          width: popoverWidth,
                          zIndex: 9999
                        }}
                        className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 animate-in fade-in-50 duration-150"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-gradient-to-r from-emerald-50/60 via-teal-50/30 to-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-xs shadow-emerald-500/30">
                              <Grid className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Danh mục sản phẩm</h4>
                              <p className="text-[11px] text-slate-500 font-medium">Tổng cộng {allCategories.length} danh mục</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative w-36 sm:w-48">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Tìm danh mục..."
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                autoComplete="off"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all"
                              />
                              {categoryFilter && (
                                <button
                                  type="button"
                                  onClick={() => setCategoryFilter("")}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setCatMoreOpen(false); setCategoryFilter(""); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Content Grid */}
                        <div className="max-h-[55vh] overflow-y-auto p-3.5 space-y-2">
                          {filtered.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                              Không tìm thấy danh mục phù hợp với "{categoryFilter}"
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {filtered.map((category) => {
                                const isActive = pathname === `/categories/${category.slug}`;
                                return (
                                  <a
                                    key={category.id}
                                    href={`/categories/${category.slug}`}
                                    onClick={() => { setCatMoreOpen(false); setCategoryFilter(""); }}
                                    className={`group flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                                      isActive
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-2xs"
                                        : "border-slate-100 bg-slate-50/60 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/70 hover:text-emerald-700 hover:shadow-xs"
                                    }`}
                                  >
                                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                      isActive ? "bg-emerald-500 text-white" : "bg-white text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white border border-slate-200/80 shadow-2xs"
                                    }`}>
                                      <Package className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="truncate leading-tight">{category.name}</span>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium text-[11px]">
                            Chọn danh mục để lọc sản phẩm
                          </span>
                          <a
                            href="/products"
                            onClick={() => { setCatMoreOpen(false); setCategoryFilter(""); }}
                            className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                          >
                            Xem tất cả sản phẩm &rarr;
                          </a>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </header>
    );
}


export function MarketplaceFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 font-heading text-sm font-black text-white">
              S
            </span>
            <span className="font-heading text-lg font-black text-slate-900">{BRAND_NAME}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Sàn thương mại điện tử AI thế hệ mới. Mua sắm thông minh, bảo mật tuyệt đối và giao hàng thần tốc.
          </p>
        </div>

        <div>
          <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-900">Chính Sách Mua Hàng</h4>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Thanh toán an toàn, bảo vệ quyền lợi người mua và theo dõi đơn hàng thời gian thực.
          </p>
        </div>

        <div>
          <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-900">Hỗ Trợ Khách Hàng</h4>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Trợ lý AI 24/7 luôn sẵn sàng giải đáp thắc mắc và xử lý khiếu nại đơn hàng.
          </p>
        </div>

        <div>
          <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-900">Dành Cho Người Bán</h4>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Quản lý gian hàng, đăng sản phẩm và theo dõi doanh thu trong Kênh Người Bán Shepoo.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50 py-4 text-center text-[11px] text-slate-500">
        © 2026 {BRAND_NAME} Cyber Marketplace. All rights reserved.
      </div>
    </footer>
  );
}
