"use client";

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Clock,
  Compass,
  Grid,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
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

import { formatDate } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { BRAND_NAME } from "@/lib/constants";
import { SearchField } from "@/components/ui/input";
import { Button, IconButton } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { fetchAutocomplete, fetchHotKeywords, type SearchSuggestion } from "@/services/search-api";
import { getSearchHistory, addSearchHistory, removeSearchHistory, clearSearchHistory } from "@/lib/search-history";

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

const HEADER_VISIBLE_CATEGORY_COUNT = 6;



export function MarketplaceHeader() {
  const store = useMarketplaceStore();
  const router = useRouter();
  const pathname = usePathname() || "/";

  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [catMoreOpen, setCatMoreOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const catMoreRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus state data (loaded once)
  const [hotKeywords, setHotKeywords] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    fetchHotKeywords().then(setHotKeywords);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      if (q) setQuery(q);
    }
  }, [pathname]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setHighlightIndex(-1);

    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsSearchLoading(false);
      return;
    }

    // Shopee-style: show "Tìm Shop" immediately while keyword suggestions load
    setSuggestions([
      { keyword: `Tìm Shop "${trimmed}"`, type: "shop", shop_slug: null },
    ]);
    setIsSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      const result = await fetchAutocomplete(trimmed);
      setSuggestions(result.suggestions);
      setIsSearchLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    setSearchHistory(getSearchHistory());
  };

  const performSearch = (keyword: string, isShop?: boolean, _shopSlug?: string) => {
    if (isShop) {
      // Shopee-style: always go to shop search results for the typed query
      const shopQuery = query.trim();
      if (!shopQuery) return;
      addSearchHistory(shopQuery);
      window.location.href = `/search/shops?q=${encodeURIComponent(shopQuery)}`;
      return;
    }
    if (keyword.trim()) {
      addSearchHistory(keyword.trim());
      window.location.href = `/search?q=${encodeURIComponent(keyword.trim())}`;
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && suggestions[highlightIndex]) {
        const s = suggestions[highlightIndex];
        performSearch(s.keyword, s.type === "shop", s.shop_slug ?? undefined);
      } else {
        performSearch(query);
      }
    }
  };

  const selectedCount = store.getCartRows().reduce((sum, row) => sum + row.item.quantity, 0);
  const currentUser = store.getCurrentUser();
  const currentRoles = currentUser?.roles ?? [];
  const categories = store.state.categories;
  const headerCategories = categories.slice(0, HEADER_VISIBLE_CATEGORY_COUNT);
  const moreCategories = categories.slice(HEADER_VISIBLE_CATEGORY_COUNT);
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
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (catMoreRef.current && !catMoreRef.current.contains(event.target as Node)) {
        setCatMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
    setUserMenuOpen(false);
    setCartOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const syncHeaderOffset = () => {
      document.documentElement.style.setProperty(
        "--marketplace-header-offset",
        `${header.offsetHeight}px`
      );
    };

    syncHeaderOffset();
    const observer = new ResizeObserver(syncHeaderOffset);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50 w-full pointer-events-none isolate">
      <div className="w-full nav-glass-header pointer-events-auto">
      {/* TOP ANNOUNCEMENT BAR (Permanently fixed at top edge at all times) */}
      <div className="text-slate-600 text-[11px] py-1.5 px-4 w-full">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-medium text-slate-600 overflow-x-auto no-scrollbar">
            <a href="/seller" className="hover:text-emerald-700 transition-colors flex items-center gap-1 shrink-0">
              <Store className="h-3.5 w-3.5 text-emerald-600" />
              Kênh người bán
            </a>
            <span className="text-[rgba(205,188,165,1)]">|</span>
            <a href="/seller/register" className="hover:text-emerald-700 transition-colors shrink-0">
              Trở thành người bán
            </a>
          </div>

          <div className="flex items-center gap-4 text-slate-600 shrink-0 font-medium">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-700 transition-colors flex items-center gap-1.5 shrink-0"
              title="Ghé thăm Fanpage chính thức"
            >
              <svg className="h-3.5 w-3.5 text-[#1877F2] fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Fanpage Facebook</span>
            </a>
            <span className="hidden md:inline text-[rgba(205,188,165,1)]">|</span>
            <a href="tel:19006868" className="hidden md:flex hover:text-emerald-700 transition-colors items-center gap-1.5 text-emerald-700 font-bold">
              <Phone className="h-3 w-3 text-emerald-600" />
              <span>Hotline: 1900 6868</span>
            </a>
            <span className="hidden md:inline text-[rgba(205,188,165,1)]">|</span>
            <a href="/support" className="hidden md:flex hover:text-emerald-700 transition-colors items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Hỗ trợ
            </a>
          </div>
        </div>
      </div>

      {/* MAIN NAVIGATION BAR */}
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-2.5">
          <div className="flex min-h-10 items-center gap-2.5 sm:gap-4 md:gap-6">
            {/* LOGO */}
            <a
              href="/"
              className="group flex shrink-0 items-center gap-2 sm:gap-2.5"
              aria-label={`${BRAND_NAME} Trang chủ`}
            >
              <div className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 font-heading text-xl font-black text-white shadow-sm transition-all duration-500 group-hover:scale-105">
                  S
                </span>
              </div>
              <div className="hidden sm:flex flex-col items-center justify-center">
                <span className="font-heading text-2xl font-black tracking-tight text-slate-900 leading-none transition-all duration-500 group-hover:text-emerald-600 sm:text-[26px]">
                  {BRAND_NAME}
                </span>
                <div className="mt-0.5 max-h-4 overflow-hidden opacity-100">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-tight">
                    Marketplace
                  </span>
                </div>
              </div>
            </a>

            {/* SEARCH + ACTION — khoảng cách search ↔ thông báo = 5px */}
            <div className="flex min-w-0 flex-1 items-center gap-[5px]">
            <div className="min-w-0 flex-1" ref={searchContainerRef}>
              <div className="relative w-full">
                <SearchField
                  inputRef={searchInputRef}
                  value={query}
                  onChange={setQuery}
                  onFocus={handleSearchFocus}
                  onBlur={() => {}}
                  onKeyDown={handleSearchKeyDown}
                />

                {/* SEARCH SUGGESTION DROPDOWN */}
                {isSearchFocused && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-full max-h-[80vh] overflow-y-auto animate-scale-in rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                    {query.trim() ? (
                      /* === AUTOCOMPLETE RESULTS (Shopee-style: shop row first) === */
                      <div className="space-y-0.5">
                        {suggestions.map((item, index) => (
                          <button
                            key={`${item.type}-${item.keyword}-${index}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => performSearch(item.keyword, item.type === "shop", item.shop_slug ?? undefined)}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                              index === highlightIndex
                                ? "bg-rose-50 text-slate-900"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {item.type === "shop" ? (
                              <Store className="h-4 w-4 shrink-0 text-rose-500" />
                            ) : (
                              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            )}
                            <span className={`truncate ${item.type === "shop" ? "font-semibold text-slate-800" : "font-medium"}`}>
                              {item.type === "shop" ? (
                                <>
                                  Tìm Shop &quot;<span className="text-rose-600">{query.trim()}</span>&quot;
                                </>
                              ) : (
                                item.keyword
                              )}
                            </span>
                          </button>
                        ))}
                        {isSearchLoading && (
                          <div className="flex items-center justify-center py-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                          </div>
                        )}
                        {!isSearchLoading && suggestions.every((s) => s.type === "shop") && (
                          <div className="px-3 py-2 text-xs text-slate-400">
                            Không có gợi ý sản phẩm cho &quot;{query.trim()}&quot;
                          </div>
                        )}
                      </div>
                    ) : (
                      /* === FOCUS STATE: HISTORY + HOT KEYWORDS === */
                      <div className="space-y-3 p-1">
                        {/* Search History */}
                        {searchHistory.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-slate-400" />
                                Lịch sử tìm kiếm
                              </span>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { clearSearchHistory(); setSearchHistory([]); }}
                                className="text-[10px] font-bold text-red-600"
                              >
                                Xóa tất cả
                              </button>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {searchHistory.map((kw) => (
                                <div key={kw} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 group">
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => performSearch(kw)}
                                    className="flex flex-1 items-center gap-2 text-xs font-medium text-slate-600 truncate text-left"
                                  >
                                    <Clock className="h-3 w-3 text-slate-300 shrink-0" />
                                    {kw}
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      removeSearchHistory(kw);
                                      setSearchHistory(getSearchHistory());
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-0.5"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hot Keywords */}
                        <div>
                          <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Tag className="h-3 w-3 text-emerald-600" />
                            Từ khóa hot hôm nay
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {hotKeywords.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => performSearch(tag)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ACTION NAV — width theo nội dung; có badge thì nở, search flex-1 tự thu */}
            <div className="hidden shrink-0 items-center justify-end gap-1 lg:flex">
              {/* NOTIFICATION BELL */}
              <NotificationBell />

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
                  className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all duration-300 ${
                    pathname === "/cart" || cartOpen
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-700 hover:bg-slate-200/50 hover:text-emerald-700"
                  }`}
                >
                  <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">Giỏ hàng</span>
                  {selectedCount > 0 && (
                    <span className="min-w-[1.25rem] animate-bounce-subtle rounded-full bg-emerald-600 px-2 py-0.5 text-center text-[10px] font-black text-white shadow-sm">
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

              {/* USER PROFILE DROPDOWN — giữ chỗ cố định khi store chưa ready */}
              {!store.ready ? (
                <div className="ml-1 h-9 w-[96px] shrink-0 rounded-xl bg-slate-100/80" aria-hidden />
              ) : currentUser ? (
                <div
                  className="relative ml-0.5 w-[96px] shrink-0"
                  ref={userMenuRef}
                  onMouseEnter={() => setUserMenuOpen(true)}
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex h-9 w-full items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 shadow-2xs transition-[border-color,background-color] duration-300 hover:border-emerald-450 hover:bg-emerald-50/50 active:scale-98"
                  >
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="h-6 w-6 shrink-0 rounded-lg object-cover shadow-2xs ring-1 ring-slate-200" />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600 font-heading text-xs font-black text-white shadow-2xs">
                        {currentUser.fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="min-w-0 flex-1 truncate text-left">{currentUser.fullName.split(" ").slice(-1)}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
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
                <div className="ml-1 flex h-9 shrink-0 items-center justify-end gap-1.5">
                  <a
                    href="/login"
                    className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs transition-[border-color,background-color] duration-300 hover:border-slate-300 hover:bg-slate-50"
                  >
                    Đăng nhập
                  </a>
                  <a
                    href="/register"
                    className="whitespace-nowrap rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-md transition-[background-color] duration-300 hover:bg-emerald-500"
                  >
                    Đăng ký
                  </a>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* CATEGORY NAV RIBBON */}
          <div className="hidden lg:flex items-center justify-center gap-1.5 px-3 py-[10px]">
              <a
                href="/products"
                className={`shrink-0 inline-flex items-center px-2 py-0.5 text-[11px] font-bold leading-none transition-colors ${
                  pathname === "/products"
                    ? "text-emerald-600"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                Tất cả sản phẩm
              </a>

              {headerCategories.map((category) => {
                const isActive = pathname === `/categories/${category.slug}`;
                return (
                  <a
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 text-[11px] font-bold leading-none transition-colors ${
                      isActive
                        ? "text-emerald-600"
                        : "text-slate-600 hover:text-emerald-700"
                    }`}
                  >
                    {category.name}
                  </a>
                );
              })}
              {moreCategories.length > 0 && (
                <div className="relative inline-flex shrink-0 items-center" ref={catMoreRef}>
                  <button
                    type="button"
                    onClick={() => setCatMoreOpen((v) => !v)}
                    className={`inline-flex items-center gap-0.5 border-0 bg-transparent px-2 py-0.5 text-[11px] font-bold leading-none transition-colors ${
                      catMoreOpen
                        ? "text-emerald-600"
                        : "text-slate-600 hover:text-emerald-700"
                    }`}
                  >
                    <span>Xem thêm</span>
                    <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${catMoreOpen ? "rotate-180" : ""}`} />
                  </button>
                  {catMoreOpen && (() => {
                    const rect = catMoreRef.current?.getBoundingClientRect();
                    if (!rect) return null;

                    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
                    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
                    const filtered = categoryFilter
                      ? moreCategories.filter((c) => c.name.toLowerCase().includes(categoryFilter.toLowerCase()))
                      : moreCategories;

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
                              <p className="text-[11px] text-slate-500 font-medium">{moreCategories.length} danh mục khác</p>
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
                                autoComplete="new-password"
                                name="category_search_fake_name"
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
