"use client";

import { useEffect, useState, useRef } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bell,
  Bot,
  Box,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PackageCheck,
  PanelLeft,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  TicketPercent,
  Truck,
  User,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { hotKeywords } from "@/data/mock";
import {
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Panel,
  Radio,
  SearchField,
  Section,
  Select,
  StatusBadge,
  Textarea,
  Toast,
  cn
} from "@/components/common/ui";
import {
  MetricCard,
  OrderTimeline,
  PriceDisplay,
  ProductCard,
  QuantityStepper,
  RatingStars,
  ShopCard
} from "@/components/marketplace/cards";
import {
  canCustomerCancel,
  formatDate,
  formatVnd,
  getCategoryNames,
  getPrimaryVariant,
  getProductPriceRange,
  groupCartByShop,
  orderStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  productStatusLabel,
  roleLabel,
  searchSuggestions,
  selectedCheckoutGroups,
  sellerStatusLabel
} from "@/lib/helpers";
import { fetchPublicProducts, fetchRecommendedProducts, fetchProductDetail, fetchCategories } from "@/lib/product-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { AddressType, Order, OrderStatus, PaymentMethod, Product, ProductVariant, SellerApplication, SellerStatus, Shop } from "@/types/models";

type ToastTone = "success" | "danger" | "info";
type ToastState = { message: string; tone: ToastTone } | undefined;

const brandName = "Shepoo";
const authEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const authPhonePattern = /^0(3|5|7|8|9)\d{8}$/;
const normalizeAuthPhoneInput = (value: string) => {
  const compact = value.trim().replace(/[\s.\-()]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
};
type AuthFormErrors = Partial<Record<"fullName" | "email" | "phone" | "password" | "confirmPassword", string>>;
type PasswordFormErrors = Partial<Record<"email" | "token" | "currentPassword" | "newPassword" | "confirmPassword", string>>;

const linkClass =
  "inline-flex min-h-10 items-center gap-2 rounded-panel px-3 py-2 text-sm font-semibold text-muted transition hover:bg-white hover:text-primary";

const activeLinkClass = "bg-white text-primary shadow-sm";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const roleHomePath = (role: string) => {
  if (role === "ADMIN") return "/admin";
  if (role === "SUPPORTER") return "/supporter";
  if (role === "SELLER") return "/seller";
  return "/";
};

function RedirectTo({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4">
      <Panel className="w-full max-w-md text-center">
        <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-muted">Đang chuyển hướng...</p>
      </Panel>
    </main>
  );
}

export function AppShell() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const segments = pathname.split("/").filter(Boolean);
  const store = useMarketplaceStore();
  const [toast, setToast] = useState<ToastState>();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDashboardRoute = ["seller", "admin", "supporter"].includes(segments[0] ?? "");
  const currentRoles = store.currentUser?.roles ?? [];
  const forcedDashboardPath = !isDashboardRoute
    ? store.state.activeRole === "ADMIN" && currentRoles.includes("ADMIN")
      ? "/admin"
      : store.state.activeRole === "SUPPORTER" && currentRoles.includes("SUPPORTER")
        ? "/supporter"
        : store.state.activeRole === "SELLER" && currentRoles.includes("SELLER")
          ? "/seller"
          : ""
    : "";

  const showToast = (message: string, tone: ToastTone = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(undefined), 2600);
  };

  const fetchedUserAddressesRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    if (store.state.categories.length === 0) {
      fetchCategories().then((res) => {
        if (active && res.ok && res.categories) {
          store.setCategories(res.categories as any);
        }
      });
    }
    if (store.currentUser && fetchedUserAddressesRef.current !== store.currentUser.id) {
      fetchedUserAddressesRef.current = store.currentUser.id;
      store.fetchAddresses();
    }
    return () => { active = false; };
  }, [store.currentUser, store.fetchAddresses, store.setCategories]);

  const findPaymentForOrder = (orderCode: string) =>
    store.state.payments.find((payment) => payment.orderCodes.includes(orderCode));

  const canContinuePayment = (order: Order) =>
    order.orderStatus !== "CANCELLED" && (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED");

  const goToPaymentForOrder = (order: Order) => {
    const payment = findPaymentForOrder(order.orderCode);
    if (!payment) {
      showToast("Không tìm thấy payment liên kết với đơn hàng.", "danger");
      return;
    }
    window.location.href = `/payment/${payment.paymentCode}`;
  };

  const publicChrome = !isDashboardRoute && !forcedDashboardPath;

  if (!store.ready) {
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

  const content = (() => {
    if (forcedDashboardPath) return <RedirectTo href={forcedDashboardPath} />;
    if (segments[0] === "seller") return renderSellerRoutes();
    if (segments[0] === "admin") return renderAdminRoutes();
    if (segments[0] === "supporter") return renderSupporterRoutes();
    return renderMarketplaceRoutes();
  })();

  return (
    <div className="min-h-screen">
      {publicChrome ? <MarketplaceHeader /> : null}
      {content}
      {publicChrome ? <MarketplaceFooter /> : null}
      <Toast message={toast?.message} tone={toast?.tone} />
    </div>
  );

  function MarketplaceHeader() {
    const [query, setQuery] = useState("");
    const suggestions = searchSuggestions(query, store.state.products, store.state.shops, store.state.categories);
    const selectedCount = store.cartRows.reduce((sum, row) => sum + row.item.quantity, 0);
    const currentRoles = store.currentUser?.roles ?? [];
    const canSwitchBuyerSeller = currentRoles.includes("CUSTOMER") && currentRoles.includes("SELLER");

    return (
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex shrink-0 items-center gap-2" aria-label="Shepoo trang chủ">
              <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-primary text-lg font-black text-white">
                S
              </span>
              <span className="hidden text-xl font-black text-ink sm:inline">{brandName}</span>
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
              <a className={linkClass} href="/products">
                <Search className="h-4 w-4" aria-hidden="true" />
                Sản phẩm
              </a>
              <a className={linkClass} href="/chat">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Chat
              </a>
              <a className={linkClass} href="/cart">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Giỏ hàng
                <span className="rounded-[6px] bg-coral px-1.5 py-0.5 text-xs text-white">{selectedCount}</span>
              </a>
              {store.currentUser ? (
                <>
                  <a className={linkClass} href="/account">
                    <User className="h-4 w-4" aria-hidden="true" />
                    {store.currentUser.fullName.split(" ").slice(-1)}
                  </a>
                  {canSwitchBuyerSeller ? (
                    <Button
                      variant="secondary"
                      className="px-3"
                      onClick={() => {
                        store.switchRole("SELLER");
                        window.location.href = "/seller";
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
                  <a className={linkClass} href="/login">
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
                    window.location.href = "/seller";
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

  function renderMarketplaceRoutes() {
    const root = segments[0] ?? "";
    if (root === "") return <HomePage />;
    if (root === "products") return <ProductListingPage title="Tất cả sản phẩm" />;
    if (root === "search") return <ProductListingPage title="Tìm kiếm sản phẩm" />;
    if (root === "categories") return <ProductListingPage title={`Danh mục ${categoryBySlug(segments[1])?.name ?? ""}`} categorySlug={segments[1]} />;
    if (root === "shops" && segments[2] === "products") return <ProductDetailPage shopSlug={segments[1]} productSlug={segments[3]} />;
    if (root === "shops") return <ShopPage shopSlug={segments[1]} />;
    if (root === "login") return <AuthPage mode="login" />;
    if (root === "register") return <AuthPage mode="register" />;
    if (root === "verify-email") return <VerificationPage type="email" />;
    if (root === "verify-phone") return <VerificationPage type="phone" />;
    if (root === "forgot-password") return <PasswordPage mode="forgot" />;
    if (root === "reset-password") return <PasswordPage mode="reset" />;
    if (root === "cart") return <CartPage />;
    if (root === "checkout" && segments[1] === "success") return <CheckoutSuccessPage />;
    if (root === "checkout") return <CheckoutPage />;
    if (root === "payment") return <PaymentPage paymentCode={segments[1]} />;
    if (root === "account") return <AccountPage section={segments[1]} detailId={segments[2]} />;
    if (root === "chat") return <ChatPage />;
    return <NotFoundPage />;
  }

  function HomePage() {
    const [bestSellers, setBestSellers] = useState<Product[]>([]);
    const [newest, setNewest] = useState<Product[]>([]);
    const [localVariants, setLocalVariants] = useState<ProductVariant[]>([]);
    const [localShops, setLocalShops] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let isMounted = true;
      const loadHomeData = async () => {
        setLoading(true);
        const [recommendRes, newestRes] = await Promise.all([
          fetchRecommendedProducts(8),
          fetchPublicProducts({ sort_by: "newest", size: 8 })
        ]);
        if (isMounted) {
          if (recommendRes.ok && recommendRes.products) {
            setBestSellers(recommendRes.products);
            setLocalVariants(prev => [...prev, ...recommendRes.variants!]);
            setLocalShops(prev => [...prev, ...recommendRes.shops!]);
          }
          if (newestRes.ok && newestRes.products) {
            setNewest(newestRes.products);
            setLocalVariants(prev => [...prev, ...newestRes.variants!]);
            setLocalShops(prev => [...prev, ...newestRes.shops!]);
          }
          setLoading(false);
        }
      };
      loadHomeData();
      return () => { isMounted = false; };
    }, []);

    const approvedShops = store.state.shops.filter((shop) => shop.status === "APPROVED");
    const heroProduct = bestSellers[0];
    const heroShop = heroProduct ? localShops.find((shop) => shop.id === heroProduct.sellerId) : undefined;

    return (
      <main className="mx-auto max-w-7xl px-4 py-5">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-panel border border-line bg-white">
            <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
              <div className="p-5 sm:p-7">
                <StatusBadge status="APPROVED" label="Shepoo Marketplace" />
                <h1 className="mt-4 text-3xl font-black tracking-normal text-ink sm:text-5xl">{brandName}</h1>
                <div className="mt-5 flex flex-wrap gap-2">
                  {hotKeywords.map((keyword) => (
                    <a
                      key={keyword}
                      href={`/search?q=${encodeURIComponent(keyword)}`}
                      className="rounded-panel border border-line bg-canvas px-3 py-1.5 text-sm font-semibold text-muted hover:border-primary/40 hover:text-primary"
                    >
                      {keyword}
                    </a>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => (window.location.href = "/products")}>Mua ngay</Button>
                  <Button variant="secondary" onClick={() => (window.location.href = store.currentUser ? "/seller/register" : "/login")}>
                    Đăng ký trở thành người bán
                  </Button>
                </div>
              </div>
              {heroProduct ? (
                <a href={`/shops/${heroShop?.shopSlug}/products/${heroProduct.slug}`} className="relative min-h-72 bg-canvas">
                  <img src={heroProduct.thumbnailUrl} alt={heroProduct.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-4 bottom-4 rounded-panel border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
                    <p className="inline-flex rounded-[6px] bg-amber/20 px-2 py-1 text-xs font-bold uppercase text-primary">Đang bán chạy</p>
                    <h2 className="mt-1 text-lg font-black text-ink">{heroProduct.name}</h2>
                    <p className="text-sm text-muted">{heroShop?.shopName}</p>
                  </div>
                </a>
              ) : (
                <div className="relative min-h-72 bg-canvas flex items-center justify-center">
                  {loading ? <p className="text-muted text-sm font-semibold">Đang tải...</p> : null}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-4">
            <Panel>
              <div className="flex items-center gap-3">
                <WalletCards className="h-9 w-9 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm text-muted">Thanh toán</p>
                  <p className="font-bold">Chuyển khoản, MoMo, thẻ tín dụng</p>
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="flex items-center gap-3">
                <Truck className="h-9 w-9 text-coral" aria-hidden="true" />
                <div>
                  <p className="text-sm text-muted">Giao hàng</p>
                  <p className="font-bold">Theo dõi trạng thái đơn hàng</p>
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="flex items-center gap-3">
                <Bot className="h-9 w-9 text-sky" aria-hidden="true" />
                <div>
                  <p className="text-sm text-muted">Hỗ trợ</p>
                  <p className="font-bold">Chat với Shepoo khi cần hỗ trợ</p>
                </div>
              </div>
            </Panel>
          </div>
        </section>

        <Section title="Danh mục một cấp">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {store.state.categories.map((category) => (
              <a key={category.id} href={`/categories/${category.slug}`} className="rounded-panel border border-line bg-white p-4 font-bold hover:border-primary/40 hover:text-primary">
                {category.name}
              </a>
            ))}
          </div>
        </Section>

        <Section title="Sản phẩm gợi ý" action={<a className={linkClass} href="/products">Xem tất cả</a>}>
          {loading ? (
            <div className="py-12 text-center text-muted">Đang tải sản phẩm...</div>
          ) : bestSellers.length > 0 ? (
            <ProductGrid products={bestSellers} variants={localVariants} shops={localShops} />
          ) : (
            <EmptyState title="Không có sản phẩm" />
          )}
        </Section>

        <Section title="Sản phẩm mới">
          {loading ? (
            <div className="py-12 text-center text-muted">Đang tải sản phẩm...</div>
          ) : newest.length > 0 ? (
            <ProductGrid products={newest} variants={localVariants} shops={localShops} />
          ) : (
            <EmptyState title="Không có sản phẩm" />
          )}
        </Section>

        <Section title="Shop nổi bật">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {approvedShops.slice(0, 6).map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        </Section>
      </main>
    );
  }

  function ProductGrid({ products, variants, shops }: { products: Product[]; variants: ProductVariant[]; shops: Shop[] }) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            variants={variants}
            shop={shops.find(s => s.id === product.sellerId)}
            categories={store.state.categories}
            onAdd={async (variantId) => {
              const result = await store.addToCart(variantId, 1);
              showToast(result.message, result.ok ? "success" : "danger");
            }}
          />
        ))}
      </div>
    );
  }

  function ProductListingPage({
    title,
    categorySlug,
    shopSlug
  }: {
    title: string;
    categorySlug?: string;
    shopSlug?: string;
  }) {
    const [keyword, setKeyword] = useState(() => {
      if (typeof window !== "undefined") {
        return new URLSearchParams(window.location.search).get("q") || "";
      }
      return "";
    });
    const [sort, setSort] = useState<"newest" | "price-asc" | "price-desc" | "sold" | "rating">("newest");
    const [sellerId, setSellerId] = useState("");
    const [rating, setRating] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    
    const [products, setProducts] = useState<Product[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [shops, setShops] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    useEffect(() => {
      let isMounted = true;
      const loadProducts = async () => {
        setLoading(true);
        const res = await fetchPublicProducts({
          keyword: keyword || undefined,
          category: categorySlug || undefined,
          sort_by: sort,
          page,
          size: 20
          // MVP doesn't have backend filter by seller, rating, price yet. 
          // We can just rely on keyword and sort, or we could pass them if added later.
        });
        if (isMounted) {
          if (res.ok && res.products) {
            setProducts(prev => page === 1 ? res.products! : [...prev, ...res.products!]);
            setVariants(prev => page === 1 ? res.variants! : [...prev, ...res.variants!]);
            setShops(prev => {
              const newShops = res.shops!.filter(s => !prev.some(ps => ps.id === s.id));
              return [...prev, ...newShops];
            });
            setHasMore(res.products.length === 20); // If it returned full page, there might be more
          }
          setLoading(false);
        }
      };
      
      const timer = setTimeout(() => {
        loadProducts();
      }, 300); // Debounce fetch

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }, [keyword, sort, categorySlug, page, sellerId, rating, minPrice, maxPrice]);

    // Reset page to 1 when filters change
    useEffect(() => {
      setPage(1);
    }, [keyword, sort, categorySlug, sellerId, rating, minPrice, maxPrice]);

    const filterPanel = (
      <div className="grid gap-3">
        <Field label="Từ khóa">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tên sản phẩm, shop, danh mục" />
        </Field>
        <Field label="Khoảng giá">
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Từ" />
            <Input type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Đến" />
          </div>
        </Field>
        <Field label="Seller">
          <Select value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
            <option value="">Tất cả shop</option>
            {store.state.shops.filter((shop) => shop.status === "APPROVED").map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shopName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rating tối thiểu">
          <Select value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="">Tất cả</option>
            <option value="4">Từ 4 sao</option>
            <option value="4.5">Từ 4.5 sao</option>
          </Select>
        </Field>
        <Button
          variant="secondary"
          onClick={() => {
            setKeyword("");
            setSellerId("");
            setRating("");
            setMinPrice("");
            setMaxPrice("");
          }}
        >
          Reset filter
        </Button>
      </div>
    );
    return (
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Section
          title={title}
          action={
            <div className="flex gap-2">
              <IconButton aria-label="Mở filter" className="lg:hidden" onClick={() => setFiltersOpen((value) => !value)}>
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              </IconButton>
              <Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="w-44">
                <option value="newest">Mới nhất</option>
                <option value="price-asc">Giá tăng</option>
                <option value="price-desc">Giá giảm</option>
                <option value="sold">Bán chạy</option>
                <option value="rating">Rating cao</option>
              </Select>
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="hidden lg:block">
              <Panel>{filterPanel}</Panel>
            </aside>
            {filtersOpen ? <Panel className="lg:hidden">{filterPanel}</Panel> : null}
            <div>
              {loading && page === 1 ? (
                <div className="py-12 text-center text-muted">Đang tải sản phẩm...</div>
              ) : products.length > 0 ? (
                <>
                  <p className="mb-3 text-sm text-muted">Hiển thị {products.length} sản phẩm</p>
                  <ProductGrid products={products} variants={variants} shops={shops} />
                  {hasMore && (
                    <div className="mt-8 flex justify-center">
                      <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={loading}>
                        {loading ? "Đang tải..." : "Tải thêm"}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState title="Không có kết quả" description="Hãy đổi từ khóa hoặc reset bộ lọc để xem thêm sản phẩm." />
              )}
            </div>
          </div>
        </Section>
      </main>
    );
  }

  function ShopPage({ shopSlug }: { shopSlug?: string }) {
    const shop = store.state.shops.find((item) => item.shopSlug === shopSlug);
    if (!shop) return <NotFoundPage />;
    const products = store.state.products.filter((product) => product.sellerId === shop.id);
    return (
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img src={shop.logoUrl} alt={shop.shopName} className="h-24 w-24 rounded-panel object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black text-ink">{shop.shopName}</h1>
                <StatusBadge status={shop.status} label={sellerStatusLabel[shop.status]} />
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{shop.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
                <span>Đã bán {shop.totalSold.toLocaleString("vi-VN")}</span>
                <span>Phí ship {formatVnd(shop.shippingFee)}</span>
                <span>{shop.shippingProviderName}</span>
              </div>
            </div>
          </div>
        </Panel>
        <ProductListingPage title={`Sản phẩm của ${shop.shopName}`} shopSlug={shop.shopSlug} />
      </main>
    );
  }

  function ProductDetailPage({ shopSlug, productSlug }: { shopSlug?: string; productSlug?: string }) {
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [showReport, setShowReport] = useState(false);
    
    const [product, setProduct] = useState<Product | undefined>(undefined);
    const [shop, setShop] = useState<Shop | undefined>(undefined);
    const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let isMounted = true;
      const loadDetail = async () => {
        if (!shopSlug || !productSlug) return;
        setLoading(true);
        const res = await fetchProductDetail(shopSlug, productSlug);
        if (isMounted) {
          if (res.ok && res.product) {
            setProduct(res.product);
            setProductVariants(res.variants!);
            setShop(res.shop);
            setSelectedVariantId(res.variants![0]?.id ?? "");
          }
          setLoading(false);
        }
      };
      loadDetail();
      return () => { isMounted = false; };
    }, [shopSlug, productSlug]);

    if (loading) {
      return (
        <main className="mx-auto max-w-7xl px-4 py-12 text-center text-muted">
          Đang tải chi tiết sản phẩm...
        </main>
      );
    }

    if (!shop || !product) return <NotFoundPage />;
    
    const selectedVariant = productVariants.find((variant) => variant.id === selectedVariantId) ?? productVariants[0];
    return (
      <main className="mx-auto max-w-7xl px-4 py-5">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel>
            <img src={selectedVariant?.imageUrl ?? product.thumbnailUrl} alt={product.name} className="aspect-square w-full rounded-panel object-cover" />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {product.imageUrls.map((image) => (
                <img key={image} src={image} alt={product.name} className="aspect-square rounded-panel border border-line object-cover" />
              ))}
            </div>
          </Panel>
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={product.status} label={productStatusLabel[product.status]} />
              <a href={`/shops/${shop.shopSlug}`} className="rounded-panel border border-line px-2 py-1 text-xs font-semibold text-primary">
                {shop.shopName}
              </a>
            </div>
            <h1 className="mt-3 text-3xl font-black text-ink">{product.name}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
              <RatingStars rating={product.averageRating} count={product.reviewCount} />
              <span>Đã bán {product.soldCount}</span>
              <span>{product.viewCount.toLocaleString("vi-VN")} lượt xem</span>
            </div>
            <div className="mt-4 rounded-panel bg-canvas p-4">
              <PriceDisplay price={selectedVariant?.price ?? 0} salePrice={selectedVariant?.salePrice} />
              {selectedVariant?.salePrice ? <p className="mt-1 text-xs text-muted">Sale đến {formatDate(selectedVariant.saleEndAt)}</p> : null}
            </div>
            <div className="mt-5 space-y-4">
              <Field label="Biến thể">
                <div className="flex flex-wrap gap-2">
                  {productVariants.map((variant) => (
                    <Button
                      key={variant.id}
                      variant={selectedVariant.id === variant.id ? "primary" : "secondary"}
                      disabled={variant.status !== "ACTIVE"}
                      onClick={() => setSelectedVariantId(variant.id)}
                    >
                      {variant.variantName}
                    </Button>
                  ))}
                </div>
              </Field>
              <Field label="Số lượng">
                <QuantityStepper value={quantity} onChange={setQuantity} max={selectedVariant?.inventory.quantity ?? 1} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!selectedVariant || product.status !== "ACTIVE" || selectedVariant.status !== "ACTIVE"}
                  onClick={async () => {
                    const result = await store.addToCart(selectedVariant.id, quantity);
                    showToast(result.message, result.ok ? "success" : "danger");
                  }}
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Thêm vào giỏ hàng
                </Button>
                <Button variant="secondary" onClick={() => setShowReport((value) => !value)}>
                  Báo cáo sản phẩm
                </Button>
              </div>
            </div>
            <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
              <InfoRow label="Thương hiệu" value={product.brand ?? "Không khai báo"} />
              <InfoRow label="Xuất xứ" value={product.origin} />
              <InfoRow label="Bảo hành" value={product.warranty ?? "Không áp dụng"} />
              <InfoRow label="Danh mục" value={getCategoryNames(store.state.categories, product) || "Chưa phân loại"} />
            </div>
          </Panel>
        </div>
        {showReport ? <ReportProductPanel product={product} /> : null}
        <Section title="Mô tả sản phẩm">
          <Panel>
            <p className="text-sm leading-7 text-muted">{product.shortDescription}</p>
            <p className="mt-3 text-sm leading-7 text-muted">{product.description}</p>
          </Panel>
        </Section>
        <Section title="Đánh giá sản phẩm">
          <ReviewsModule product={product} />
        </Section>
      </main>
    );
  }

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-panel border border-line bg-white p-3">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-semibold text-ink">{value}</p>
      </div>
    );
  }

  function ReportProductPanel({ product }: { product: Product }) {
    return (
      <Section title="Báo cáo sản phẩm">
        <Panel>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Lý do">
              <Select>
                <option>Hàng giả</option>
                <option>Lừa đảo</option>
                <option>Nội dung không phù hợp</option>
                <option>Mô tả sai</option>
                <option>Spam</option>
                <option>Khác</option>
              </Select>
            </Field>
            <Field label="Ảnh bằng chứng">
              <Input type="file" />
            </Field>
            <div className="flex items-end">
              <Button onClick={() => showToast(`Đã gửi báo cáo cho ${product.name}`, "success")}>Gửi báo cáo</Button>
            </div>
            <div className="md:col-span-3">
              <Field label="Mô tả chi tiết">
                <Textarea placeholder="Mô tả vấn đề bạn gặp phải" />
              </Field>
            </div>
          </div>
        </Panel>
      </Section>
    );
  }

  function ReviewsModule({ product }: { product?: Product }) {
    const relatedItems = store.state.orders
      .filter((order) => order.orderStatus === "COMPLETED")
      .flatMap((order) => order.items)
      .filter((item) => !product || item.productId === product.id);
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel>
          {relatedItems.length ? (
            <div className="space-y-4">
              {relatedItems.slice(0, 5).map((item, index) => (
                <div key={item.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <RatingStars rating={4.2 + (index % 4) * 0.2} />
                    <span className="text-sm font-semibold text-ink">Đánh giá đã mua hàng</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Sản phẩm {item.productNameSnapshot} đúng mô tả, đóng gói cẩn thận.
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có đánh giá" />
          )}
        </Panel>
        <Panel>
          <h3 className="font-bold text-ink">Viết đánh giá</h3>
          <div className="mt-4 grid gap-3">
            <Field label="Rating">
              <Select>
                <option>5 sao</option>
                <option>4 sao</option>
                <option>3 sao</option>
                <option>2 sao</option>
                <option>1 sao</option>
              </Select>
            </Field>
            <Field label="Nội dung">
              <Textarea placeholder="Chia sẻ trải nghiệm của bạn" />
            </Field>
            <Field label="Ảnh đánh giá">
              <Input type="file" multiple />
            </Field>
            <Button onClick={() => showToast("Đã lưu đánh giá.", "success")}>Gửi đánh giá</Button>
          </div>
        </Panel>
      </div>
    );
  }

  function AuthPage({ mode }: { mode: "login" | "register" }) {
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [formErrors, setFormErrors] = useState<AuthFormErrors>({});
    const [submitting, setSubmitting] = useState(false);

    const validateAuthForm = () => {
      const nextErrors: AuthFormErrors = {};
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPhone = normalizeAuthPhoneInput(phone);
      const normalizedLoginPhone = normalizeAuthPhoneInput(email);
      const isLoginIdentifierValid =
        authEmailPattern.test(normalizedEmail) || authPhonePattern.test(normalizedLoginPhone);

      if (mode === "register" && fullName.trim().length < 2) {
        nextErrors.fullName = "Họ tên phải có ít nhất 2 ký tự.";
      }
      if (mode === "login" ? !isLoginIdentifierValid : !authEmailPattern.test(normalizedEmail)) {
        nextErrors.email = mode === "login" ? "Nhập email hoặc số điện thoại hợp lệ." : "Email không hợp lệ.";
      }
      if (mode === "register" && !authPhonePattern.test(normalizedPhone)) {
        nextErrors.phone = "Số điện thoại không hợp lệ.";
      }
      if (password.length < (mode === "register" ? 8 : 1)) {
        nextErrors.password = mode === "register" ? "Mật khẩu phải có ít nhất 8 ký tự." : "Vui lòng nhập mật khẩu.";
      }

      if (mode === "register" && password !== confirmPassword) {
        nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
      }

      setFormErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };

    return (
      <main className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-5 px-4 py-8 lg:grid-cols-[1fr_420px]">
        <div>
          <StatusBadge status="ACTIVE" label="Tài khoản Shepoo" />
          <h1 className="mt-4 text-4xl font-black text-ink">{mode === "login" ? "Đăng nhập Shepoo" : "Tạo tài khoản khách hàng"}</h1>
        </div>
        <Panel>
          <div className="grid gap-4">
            {mode === "register" ? (
              <>
                <Field label="Họ tên" hint={formErrors.fullName ? <span className="text-coral">{formErrors.fullName}</span> : null}>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Nguyễn Văn A"
                    autoComplete="name"
                    className={formErrors.fullName ? "border-coral" : undefined}
                  />
                </Field>
                <Field label="Số điện thoại" hint={formErrors.phone ? <span className="text-coral">{formErrors.phone}</span> : null}>
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="0901234567"
                    autoComplete="tel"
                    inputMode="tel"
                    className={formErrors.phone ? "border-coral" : undefined}
                  />
                </Field>
              </>
            ) : null}
            <Field
              label={mode === "login" ? "Email hoặc số điện thoại" : "Email"}
              hint={formErrors.email ? <span className="text-coral">{formErrors.email}</span> : null}
            >
              <Input
                type={mode === "login" ? "text" : "email"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={mode === "login" ? "email@example.com hoặc 0901234567" : "email@example.com"}
                autoComplete={mode === "login" ? "username" : "email"}
                inputMode={mode === "login" ? "text" : "email"}
                className={formErrors.email ? "border-coral" : undefined}
              />
            </Field>
            <Field label="Mật khẩu" hint={formErrors.password ? <span className="text-coral">{formErrors.password}</span> : null}>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "login" ? "Mật khẩu" : "Tối thiểu 8 ký tự"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={formErrors.password ? "border-coral" : undefined}
              />
            </Field>
            {mode === "register" ? (
              <Field label="Nhập lại mật khẩu" hint={formErrors.confirmPassword ? <span className="text-coral">{formErrors.confirmPassword}</span> : null}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                  className={formErrors.confirmPassword ? "border-coral" : undefined}
                />
              </Field>
            ) : null}
            <Button
              disabled={submitting}
              onClick={async () => {
                if (!validateAuthForm()) return;
                setSubmitting(true);
                const normalizedPhone = normalizeAuthPhoneInput(phone);
                const result =
                  mode === "login"
                    ? await store.login(email, password)
                    : await store.register({
                        fullName: fullName.trim(),
                        email: email.trim().toLowerCase(),
                        phone: normalizedPhone,
                        password,
                        confirmPassword
                      });
                setSubmitting(false);
                showToast(result.message, result.ok ? "success" : "danger");
                if (result.ok) window.location.href = result.redirectTo ?? "/";
              }}
            >
              {submitting ? "Đang xử lý" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </Button>
            <div className="flex flex-wrap gap-2 text-sm text-muted">
              <a href="/forgot-password" className="font-semibold text-primary">Quên mật khẩu</a>
              <a href={mode === "login" ? "/register" : "/login"} className="font-semibold text-primary">
                {mode === "login" ? "Tạo tài khoản" : "Đã có tài khoản"}
              </a>
            </div>
          </div>
        </Panel>
      </main>
    );
  }

  function VerificationPage({ type }: { type: "email" | "phone" }) {
    const [code, setCode] = useState(type === "email" ? searchParams?.get("token") ?? "" : "");
    const [phone, setPhone] = useState(store.verificationContext?.phone ?? store.currentUser?.phone ?? "");
    const [submitting, setSubmitting] = useState(false);
    const [fieldError, setFieldError] = useState("");

    useEffect(() => {
      if (type === "phone" && !phone && store.verificationContext?.phone) {
        setPhone(store.verificationContext.phone);
      }
    }, [phone, type, store.verificationContext?.phone]);

    const submitVerification = async () => {
      setFieldError("");
      const normalizedPhone = normalizeAuthPhoneInput(phone || store.verificationContext?.phone || store.currentUser?.phone || "");
      if (type === "phone" && !authPhonePattern.test(normalizedPhone)) {
        setFieldError("Số điện thoại không hợp lệ.");
        return;
      }
      if (type === "phone" && !/^\d{6}$/.test(code.trim())) {
        setFieldError("OTP phải gồm 6 chữ số.");
        return;
      }
      if (type === "email" && !code.trim()) {
        setFieldError("Vui lòng nhập mã xác thực email.");
        return;
      }

      setSubmitting(true);
      const result =
        type === "email"
          ? await store.verifyEmail(code)
          : await store.verifyPhone(normalizedPhone, code);
      setSubmitting(false);
      showToast(result.message, result.ok ? "success" : "danger");
      if (result.ok) window.location.href = result.redirectTo ?? "/";
    };

    const resendVerification = async () => {
      const result =
        type === "email"
          ? await store.resendEmailVerification()
          : await store.resendPhoneVerification(normalizeAuthPhoneInput(phone || store.verificationContext?.phone || store.currentUser?.phone || ""));
      showToast(result.message, result.ok ? "success" : "danger");
    };

    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <Panel>
          <ShieldCheck className="h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-black text-ink">{type === "email" ? "Xác thực email" : "Xác thực số điện thoại"}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {type === "email" ? store.verificationContext?.email ?? store.currentUser?.email : store.verificationContext?.phone ?? store.currentUser?.phone}
          </p>
          <div className="mt-4 grid gap-3">
            {type === "phone" ? (
              <Field label="Số điện thoại">
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0901234567"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
            ) : null}
            <Field label={type === "email" ? "Mã xác thực email" : "OTP điện thoại"}>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={type === "email" ? "Nhập mã xác thực" : "Nhập 6 chữ số"}
                inputMode={type === "phone" ? "numeric" : "text"}
                autoComplete="one-time-code"
                className={fieldError ? "border-coral" : undefined}
              />
            </Field>
            {fieldError ? <p className="text-xs font-semibold text-coral">{fieldError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={submitting} onClick={submitVerification}>
                {submitting ? "Đang xác thực" : "Xác thực"}
              </Button>
              <Button type="button" variant="secondary" onClick={resendVerification}>
                Gửi lại mã
              </Button>
            </div>
          </div>
        </Panel>
      </main>
    );
  }

  function PasswordPage({ mode }: { mode: "forgot" | "reset" }) {
    const [email, setEmail] = useState("");
    const [token, setToken] = useState(searchParams?.get("token") ?? "");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [formErrors, setFormErrors] = useState<PasswordFormErrors>({});
    const [submitting, setSubmitting] = useState(false);

    const validatePasswordForm = () => {
      const nextErrors: PasswordFormErrors = {};
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "forgot" && !authEmailPattern.test(normalizedEmail)) {
        nextErrors.email = "Email không hợp lệ.";
      }

      if (mode === "reset") {
        if (!token.trim()) {
          nextErrors.token = "Vui lòng nhập token reset.";
        }
        if (newPassword.trim().length < 8) {
          nextErrors.newPassword = "Mật khẩu mới phải có ít nhất 8 ký tự.";
        }
        if (newPassword.trim() !== confirmPassword.trim()) {
          nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
        }
      }

      setFormErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };

    const submitPasswordForm = async () => {
      if (!validatePasswordForm()) return;

      setSubmitting(true);
      const result =
        mode === "forgot"
          ? await store.requestPasswordReset(email)
          : await store.resetPassword(token, newPassword, confirmPassword);
      setSubmitting(false);
      showToast(result.message, result.ok ? "success" : "danger");

      const redirectTo = result.ok && "redirectTo" in result && typeof result.redirectTo === "string"
        ? result.redirectTo
        : "";
      if (redirectTo) {
        window.location.href = redirectTo;
      }
    };

    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <Panel>
          <Lock className="h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-black text-ink">{mode === "forgot" ? "Quên mật khẩu" : "Đặt lại mật khẩu"}</h1>
          <div className="mt-4 grid gap-3">
            {mode === "forgot" ? (
              <Field label="Email" hint={formErrors.email ? <span className="text-coral">{formErrors.email}</span> : null}>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                  autoComplete="email"
                  className={formErrors.email ? "border-coral" : undefined}
                />
              </Field>
            ) : (
              <>
                <Field label="Token reset" hint={formErrors.token ? <span className="text-coral">{formErrors.token}</span> : null}>
                  <Input
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    autoComplete="one-time-code"
                    className={formErrors.token ? "border-coral" : undefined}
                  />
                </Field>
                <Field label="Mật khẩu mới" hint={formErrors.newPassword ? <span className="text-coral">{formErrors.newPassword}</span> : null}>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    autoComplete="new-password"
                    className={formErrors.newPassword ? "border-coral" : undefined}
                  />
                </Field>
                <Field label="Nhập lại mật khẩu" hint={formErrors.confirmPassword ? <span className="text-coral">{formErrors.confirmPassword}</span> : null}>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    autoComplete="new-password"
                    className={formErrors.confirmPassword ? "border-coral" : undefined}
                  />
                </Field>
              </>
            )}
            <Button disabled={submitting} onClick={submitPasswordForm}>
              {submitting ? "Đang xử lý" : mode === "forgot" ? "Gửi link reset" : "Đổi mật khẩu"}
            </Button>
            {mode === "reset" ? (
              <a href="/forgot-password" className="text-sm font-semibold text-primary">Gửi lại link reset</a>
            ) : (
              <a href="/login" className="text-sm font-semibold text-primary">Quay lại đăng nhập</a>
            )}
          </div>
        </Panel>
      </main>
    );
  }

  function CartPage() {
    if (!store.currentUser) {
      return <Unauthorized title="Giỏ hàng cần đăng nhập" description="Vui lòng đăng nhập để xem giỏ hàng." />;
    }
    const groups = Object.values(groupCartByShop(store.cartRows));
    const selectedTotal = store.cartRows.filter((row) => row.item.isSelected && !row.unavailable).reduce((sum, row) => sum + row.subtotal, 0);
    return (
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Section title="Giỏ hàng">
          {groups.length ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <Panel className="flex items-center justify-between gap-3">
                  <Checkbox label="Chọn tất cả" checked={store.cartRows.every((row) => row.item.isSelected)} onChange={(event) => store.selectAllCart(event.target.checked)} />
                  <Button variant="secondary" onClick={() => showToast("Đã cập nhật giá hiện tại.", "success")}>
                    Cập nhật giá
                  </Button>
                </Panel>
                {groups.map((group) => (
                  <Panel key={group.shop.id}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <a href={`/shops/${group.shop.shopSlug}`} className="font-bold text-ink">{group.shop.shopName}</a>
                      <span className="text-sm text-muted">Phí ship {formatVnd(group.shop.shippingFee)}</span>
                    </div>
                    <div className="space-y-3">
                      {group.rows.map((row) => (
                        <div key={row.item.id} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[24px_76px_1fr_auto] sm:items-center">
                          <Checkbox checked={row.item.isSelected} onChange={(event) => store.updateCartItem(row.item.id, { isSelected: event.target.checked })} aria-label={`Chọn ${row.product.name}`} />
                          <img src={row.product.thumbnailUrl} alt={row.product.name} className="h-20 w-20 rounded-panel object-cover" />
                          <div>
                            <p className="font-bold text-ink">{row.product.name}</p>
                            <p className="text-sm text-muted">Biến thể: {row.variant.variantName}</p>
                            {row.unavailable ? <p className="mt-1 text-sm font-semibold text-coral">{row.reason}</p> : null}
                            <PriceDisplay price={row.variant.price} salePrice={row.variant.salePrice} compact />
                          </div>
                          <div className="flex items-center gap-2">
                            <QuantityStepper value={row.item.quantity} onChange={(value) => store.updateCartItem(row.item.id, { quantity: value })} max={row.variant.inventory.quantity || 1} />
                            <Button variant="ghost" onClick={() => store.removeCartItem(row.item.id)}>Xóa</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                ))}
              </div>
              <Panel className="h-fit">
                <h2 className="text-lg font-bold">Tóm tắt</h2>
                <InfoRow label="Tiền hàng đã chọn" value={formatVnd(selectedTotal)} />
                <InfoRow label="Số shop" value={`${selectedCheckoutGroups(store.cartRows).length}`} />
                <Button className="mt-4 w-full" disabled={!selectedTotal} onClick={() => (window.location.href = "/checkout")}>
                  Checkout
                </Button>
              </Panel>
            </div>
          ) : (
            <EmptyState title="Giỏ hàng trống" description="Bạn chưa có sản phẩm nào trong giỏ hàng." action={<Button onClick={() => (window.location.href = "/products")}>Mua sắm</Button>} />
          )}
        </Section>
      </main>
    );
  }

  function CheckoutPage() {
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [addressId, setAddressId] = useState(store.state.addresses.find((item) => item.userId === store.currentUser?.id && item.isDefault)?.id ?? "");
    const [method, setMethod] = useState<PaymentMethod>("MOCK");
    const [note, setNote] = useState("");
    const [coupon, setCoupon] = useState("");
    const [shipCoupon, setShipCoupon] = useState("");
    if (!store.currentUser) return <Unauthorized title="Checkout cần đăng nhập" description="Vui lòng đăng nhập để đặt hàng." />;
    const rows = store.cartRows;
    const groups = selectedCheckoutGroups(rows);
    const total = groups.reduce((sum, group) => sum + group.total, 0);
    const addresses = store.state.addresses.filter((address) => address.userId === store.currentUser?.id);
    
    // Auto-select address if none selected and addresses exist
    useEffect(() => {
      if (!addressId && addresses.length > 0) {
        setAddressId(addresses[0].id);
      }
    }, [addresses, addressId]);
    
    return (
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Section title="Checkout">
          {groups.length ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <Panel>
                  <h2 className="font-bold">Địa chỉ giao hàng</h2>
                  <div className="mt-3 grid gap-2">
                    {addresses.map((address) => (
                      <Radio
                        key={address.id}
                        name="address"
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                        label={`${address.receiverName} - ${address.phone} - ${address.detailAddress}, ${address.ward}, ${address.district}, ${address.province}`}
                      />
                    ))}
                    {!showAddressForm ? (
                      <Button variant="secondary" onClick={() => setShowAddressForm(true)}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Thêm địa chỉ
                      </Button>
                    ) : (
                      <div className="mt-4 rounded-panel bg-neutral-50 p-4 dark:bg-neutral-800/50">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-bold">Địa chỉ mới</h4>
                          <Button variant="ghost" className="h-auto p-1 text-sm" onClick={() => setShowAddressForm(false)}>Hủy</Button>
                        </div>
                        <AddressForm onSuccess={() => setShowAddressForm(false)} />
                      </div>
                    )}
                  </div>
                </Panel>
                {groups.map((group) => (
                  <Panel key={group.shop.id}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold">{group.shop.shopName}</h3>
                      <span className="text-sm text-muted">Đơn hàng của shop này</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {group.rows.map((row) => (
                        <div key={row.item.id} className="flex gap-3 border-t border-line pt-3">
                          <img src={row.product.thumbnailUrl} alt={row.product.name} className="h-16 w-16 rounded-panel object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-ink">{row.product.name}</p>
                            <p className="text-sm text-muted">{row.variant.variantName} x {row.item.quantity}</p>
                          </div>
                          <p className="font-bold">{formatVnd(row.subtotal)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <InfoRow label="Subtotal" value={formatVnd(group.subtotal)} />
                      <InfoRow label="Phí ship" value={formatVnd(group.shippingFee)} />
                      <InfoRow label="Tổng order" value={formatVnd(group.total)} />
                    </div>
                  </Panel>
                ))}
              </div>
              <Panel className="h-fit">
                <h2 className="font-bold">Thanh toán</h2>
                <div className="mt-3 grid gap-3">
                  <Field label="Ghi chú khách hàng">
                    <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú giao hàng" />
                  </Field>
                  <Field label="Mã giảm tiền">
                    <Input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="Tối đa 1 mã" />
                  </Field>
                  <Field label="Mã giảm ship">
                    <Input value={shipCoupon} onChange={(event) => setShipCoupon(event.target.value)} placeholder="Tối đa 1 mã" />
                  </Field>
                  <Field label="Phương thức thanh toán">
                    <Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                      {Object.entries(paymentMethodLabel).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </Select>
                  </Field>
                  <InfoRow label="Số đơn hàng" value={`${groups.length}`} />
                  <InfoRow label="Tổng thanh toán" value={formatVnd(total)} />
                  <Button
                    onClick={() => {
                      const result = store.checkout(addressId, method, note);
                      showToast(result.message, result.ok ? "success" : "danger");
                      if (result.ok) window.location.href = "/checkout/success";
                    }}
                  >
                    Đặt hàng
                  </Button>
                </div>
              </Panel>
            </div>
          ) : (
            <EmptyState title="Chưa có item để checkout" description="Chọn ít nhất một item hợp lệ trong giỏ hàng." action={<Button onClick={() => (window.location.href = "/cart")}>Về giỏ hàng</Button>} />
          )}
        </Section>
      </main>
    );
  }

  function CheckoutSuccessPage() {
    const payment = store.state.payments.find((item) => item.paymentCode === store.state.lastCheckoutPaymentCode) ?? store.state.payments[0];
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Panel className="text-center">
          <PackageCheck className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-3xl font-black text-ink">Đặt hàng thành công</h1>
          <p className="mt-2 text-sm text-muted">Bạn có thể tiếp tục thanh toán hoặc xem đơn hàng.</p>
          {payment ? (
            <div className="mt-5 grid gap-2 text-left">
              <InfoRow label="Mã thanh toán" value={payment.paymentCode} />
              <InfoRow label="Mã đơn hàng" value={payment.orderCodes.join(", ")} />
              <InfoRow label="Tổng tiền" value={formatVnd(payment.amount)} />
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button disabled={!payment} onClick={() => (window.location.href = `/payment/${payment?.paymentCode}`)}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Thanh toán
            </Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/account/orders")}>Xem đơn hàng</Button>
          </div>
        </Panel>
      </main>
    );
  }

  function PaymentPage({ paymentCode }: { paymentCode?: string }) {
    const payment = store.state.payments.find((item) => item.paymentCode === paymentCode) ?? store.state.payments[0];
    if (!payment) return <NotFoundPage />;
    const linkedOrders = store.state.orders.filter((order) => payment.orderCodes.includes(order.orderCode));
    const canPayPayment = payment.paymentStatus === "PENDING" || payment.paymentStatus === "FAILED";
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Section title={`Thanh toán ${payment.paymentCode}`}>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Panel>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Trạng thái" value={paymentStatusLabel[payment.paymentStatus]} />
                <InfoRow label="Số tiền" value={formatVnd(payment.amount)} />
                <InfoRow label="Phương thức" value={paymentMethodLabel[payment.paymentMethod]} />
                <InfoRow label="Hạn thanh toán" value={formatDate(payment.expiresAt)} />
                <InfoRow label="Mã giao dịch" value={payment.transactionCode ?? "Chưa có"} />
                <InfoRow label="Cổng thanh toán" value={payment.paymentGateway ?? "Chưa có"} />
              </div>
              <h3 className="mt-5 font-bold">Đơn hàng</h3>
              <div className="mt-3 space-y-2">
                {linkedOrders.map((order) => (
                  <a key={order.id} href={`/account/orders/${order.orderCode}`} className="flex items-center justify-between rounded-panel border border-line p-3 hover:border-primary/40">
                    <span className="font-bold">{order.orderCode}</span>
                    <StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />
                  </a>
                ))}
              </div>
            </Panel>
            <Panel className="h-fit">
              <h3 className="font-bold">Hành động</h3>
              <div className="mt-3 grid gap-2">
                <Button disabled={!canPayPayment} onClick={() => { store.updatePaymentStatus(payment.paymentCode, "PAID"); showToast("Đã thanh toán đơn hàng.", "success"); }}>
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  {payment.paymentStatus === "PAID" ? "Đã thanh toán" : "Thanh toán ngay"}
                </Button>
                <Button variant="danger" onClick={() => { store.updatePaymentStatus(payment.paymentCode, "FAILED"); showToast("Đã đánh dấu thanh toán lỗi.", "danger"); }}>Đánh dấu lỗi</Button>
                <Button variant="secondary" onClick={() => { store.retryPayment(payment.paymentCode); showToast("Đã thử lại thanh toán.", "success"); }}>
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  Thử lại
                </Button>
                <Button variant="ghost" onClick={() => { store.updatePaymentStatus(payment.paymentCode, "CANCELLED"); showToast("Đã hủy thanh toán.", "info"); }}>Hủy</Button>
                <div className="my-1 border-t border-line" />
                <Button variant="secondary" onClick={() => (window.location.href = "/")}>
                  <Home className="h-4 w-4" aria-hidden="true" />
                  Về màn hình chính
                </Button>
                <Button variant="secondary" onClick={() => (window.location.href = "/account/orders")}>Xem đơn hàng</Button>
              </div>
            </Panel>
          </div>
        </Section>
      </main>
    );
  }

  function AccountPage({ section, detailId }: { section?: string; detailId?: string }) {
    if (!store.currentUser) return <Unauthorized title="Tài khoản cần đăng nhập" description="Vui lòng đăng nhập để xem thông tin cá nhân." />;
    const currentSection = section ?? "overview";
    const nav = [
      ["overview", "/account", "Tổng quan"],
      ["profile", "/account/profile", "Hồ sơ"],
      ["security", "/account/security", "Bảo mật"],
      ["addresses", "/account/addresses", "Địa chỉ"],
      ["orders", "/account/orders", "Đơn hàng"],
      ["notifications", "/account/notifications", "Thông báo"],
      ["reviews", "/account/reviews", "Đánh giá"]
    ];
    return (
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[240px_1fr]">
        <Panel className="h-fit">
          <div className="flex items-center gap-3">
            <img src={store.currentUser.avatarUrl} alt={store.currentUser.fullName} className="h-12 w-12 rounded-panel object-cover" />
            <div className="min-w-0">
              <p className="truncate font-bold">{store.currentUser.fullName}</p>
              <p className="text-xs text-muted">{roleLabel[store.state.activeRole]}</p>
            </div>
          </div>
          <nav className="mt-4 grid gap-1">
            {nav.map(([key, href, label]) => (
              <a key={key} href={href} className={cn(linkClass, currentSection === key && activeLinkClass)}>
                {label}
              </a>
            ))}
          </nav>
        </Panel>
        <div>
          {currentSection === "overview" ? <AccountOverview /> : null}
          {currentSection === "profile" ? <AccountProfile /> : null}
          {currentSection === "security" ? <AccountSecurity /> : null}
          {currentSection === "addresses" ? <AddressBook /> : null}
          {currentSection === "orders" && detailId ? <OrderDetailPage orderCode={detailId} audience="customer" /> : null}
          {currentSection === "orders" && !detailId ? <OrdersList audience="customer" /> : null}
          {currentSection === "notifications" ? <NotificationsPage /> : null}
          {currentSection === "reviews" ? <ReviewsModule /> : null}
        </div>
      </main>
    );
  }

  function AccountOverview() {
    const userOrders = store.state.orders.filter((order) => order.userId === store.currentUser?.id);
    return (
      <Section title="Tổng quan tài khoản">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Đơn hàng" value={`${userOrders.length}`} />
          <MetricCard label="Địa chỉ" value={`${store.state.addresses.filter((item) => item.userId === store.currentUser?.id).length}`} />
          <MetricCard label="Email" value={store.currentUser?.emailVerified ? "Đã xác thực" : "Chưa xác thực"} />
          <MetricCard label="Số điện thoại" value={store.currentUser?.phoneVerified ? "Đã xác thực" : "Chưa xác thực"} />
        </div>
      </Section>
    );
  }

  function AccountProfile() {
    const user = store.currentUser!;
    return (
      <Section title="Hồ sơ cá nhân">
        <Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Họ tên"><Input defaultValue={user.fullName} /></Field>
            <Field label="Email"><Input defaultValue={user.email} /></Field>
            <Field label="Số điện thoại"><Input defaultValue={user.phone} /></Field>
            <Field label="Giới tính">
              <Select defaultValue={user.gender ?? "OTHER"}>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </Select>
            </Field>
            <Field label="Ngày sinh"><Input type="date" defaultValue={user.birthday} /></Field>
            <Field label="Avatar"><Input type="file" /></Field>
          </div>
          <Button className="mt-4" onClick={() => showToast("Đã lưu hồ sơ.", "success")}>Lưu hồ sơ</Button>
        </Panel>
      </Section>
    );
  }

  function AccountSecurity() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [formErrors, setFormErrors] = useState<PasswordFormErrors>({});
    const [submitting, setSubmitting] = useState(false);

    const validateChangePasswordForm = () => {
      const nextErrors: PasswordFormErrors = {};

      if (currentPassword.trim().length < 8) {
        nextErrors.currentPassword = "Mật khẩu hiện tại phải có ít nhất 8 ký tự.";
      }
      if (newPassword.trim().length < 8) {
        nextErrors.newPassword = "Mật khẩu mới phải có ít nhất 8 ký tự.";
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
      }

      setFormErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };

    const submitChangePassword = async () => {
      if (!validateChangePasswordForm()) return;

      setSubmitting(true);
      const result = await store.changePassword(currentPassword, newPassword, confirmPassword);
      setSubmitting(false);
      showToast(result.message, result.ok ? "success" : "danger");

      if (result.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setFormErrors({});
      }
    };

    const submitLogoutAll = async () => {
      const result = await store.logoutAll();
      showToast(result.message, result.ok ? "success" : "danger");
    };

    return (
      <Section title="Bảo mật">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <h3 className="font-bold">Đổi mật khẩu</h3>
            <div className="mt-3 grid gap-3">
              <Field label="Mật khẩu hiện tại" hint={formErrors.currentPassword ? <span className="text-coral">{formErrors.currentPassword}</span> : null}>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Mật khẩu hiện tại"
                  autoComplete="current-password"
                  className={formErrors.currentPassword ? "border-coral" : undefined}
                />
              </Field>
              <Field label="Mật khẩu mới" hint={formErrors.newPassword ? <span className="text-coral">{formErrors.newPassword}</span> : null}>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  autoComplete="new-password"
                  className={formErrors.newPassword ? "border-coral" : undefined}
                />
              </Field>
              <Field label="Nhập lại mật khẩu" hint={formErrors.confirmPassword ? <span className="text-coral">{formErrors.confirmPassword}</span> : null}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  className={formErrors.confirmPassword ? "border-coral" : undefined}
                />
              </Field>
              <Button disabled={submitting} onClick={submitChangePassword}>
                {submitting ? "Đang xử lý" : "Đổi mật khẩu"}
              </Button>
            </div>
          </Panel>
          <Panel>
            <h3 className="font-bold">Phiên đăng nhập</h3>
            <p className="mt-2 text-sm text-muted">Quản lý các phiên đăng nhập của tài khoản.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={store.logout}>Đăng xuất thiết bị này</Button>
              <Button variant="danger" onClick={submitLogoutAll}>Đăng xuất tất cả</Button>
            </div>
          </Panel>
        </div>
      </Section>
    );
  }

  function AddressForm({ onSuccess }: { onSuccess?: () => void }) {
    const [receiverName, setReceiverName] = useState("");
    const [phone, setPhone] = useState("");
    const [province, setProvince] = useState("");
    const [district, setDistrict] = useState("");
    const [ward, setWard] = useState("");
    const [detailAddress, setDetailAddress] = useState("");
    const [addressType, setAddressType] = useState<AddressType>("HOME");

    const handleSubmit = async () => {
      if (!receiverName || !phone || !province || !district || !ward || !detailAddress) {
        showToast("Vui lòng điền đầy đủ thông tin", "danger");
        return;
      }
      const success = await store.addAddress({
        receiverName, phone, province, district, ward, detailAddress, addressType, isDefault: false
      });
      if (success) {
        showToast("Đã thêm địa chỉ", "success");
        setReceiverName(""); setPhone(""); setProvince(""); setDistrict(""); setWard(""); setDetailAddress("");
        onSuccess?.();
      } else {
        showToast("Thêm địa chỉ thất bại", "danger");
      }
    };

    return (
      <div className="mt-3 grid gap-3">
        <Input placeholder="Người nhận" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
        <Input placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input placeholder="Tỉnh/thành" value={province} onChange={(e) => setProvince(e.target.value)} />
        <Input placeholder="Quận/huyện" value={district} onChange={(e) => setDistrict(e.target.value)} />
        <Input placeholder="Phường/xã" value={ward} onChange={(e) => setWard(e.target.value)} />
        <Textarea placeholder="Địa chỉ chi tiết" value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} />
        <Select value={addressType} onChange={(e) => setAddressType(e.target.value as AddressType)}>
          <option value="HOME">HOME</option>
          <option value="OFFICE">OFFICE</option>
        </Select>
        <Button onClick={handleSubmit}>Thêm</Button>
      </div>
    );
  }

  function AddressBook() {
    const addresses = store.state.addresses.filter((address) => address.userId === store.currentUser?.id);
    return (
      <Section title="Địa chỉ giao hàng">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-3">
            {addresses.map((address) => (
              <Panel key={address.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{address.receiverName} - {address.phone}</p>
                    <p className="mt-1 text-sm text-muted">{address.detailAddress}, {address.ward}, {address.district}, {address.province}</p>
                  </div>
                  <StatusBadge status={address.isDefault ? "ACTIVE" : "HIDDEN"} label={address.isDefault ? "Mặc định" : address.addressType} />
                </div>
              </Panel>
            ))}
          </div>
          <Panel>
            <h3 className="font-bold">Thêm địa chỉ</h3>
            <AddressForm />
          </Panel>
        </div>
      </Section>
    );
  }

  function OrdersList({ audience }: { audience: "customer" | "seller" }) {
    const [status, setStatus] = useState("");
    
    useEffect(() => {
      if (audience === "seller") {
        store.fetchSellerOrders(status as OrderStatus | "");
      }
    }, [audience, status, store.fetchSellerOrders]);


    const orders = store.state.orders.filter((order) => {
      const belongs = audience === "customer" ? order.userId === store.currentUser?.id : order.sellerId === store.currentShop?.id;
      return belongs && (!status || order.orderStatus === status);
    });
    const renderOrderAction = (order: Order) => {
      if (audience !== "customer") return <span className="text-muted">Theo dõi</span>;

      const showPayment = canContinuePayment(order);
      const showCancel = canCustomerCancel(order);
      if (!showPayment && !showCancel) return <span className="text-muted">Theo dõi</span>;

      return (
        <div className="flex flex-wrap gap-2">
          {showPayment ? (
            <Button onClick={() => goToPaymentForOrder(order)}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Thanh toán
            </Button>
          ) : null}
          {showCancel ? <Button variant="danger" onClick={() => store.cancelCustomerOrder(order.orderCode)}>Hủy</Button> : null}
        </div>
      );
    };
    return (
      <Section
        title={audience === "customer" ? "Đơn hàng của tôi" : "Đơn hàng shop"}
        action={
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-48">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(orderStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        }
      >
        <DataTable
          columns={["Mã đơn", "Shop", "Trạng thái", "Thanh toán", "Tổng", "Hành động"]}
          rows={orders.map((order) => [
            <a key="code" className="font-bold text-primary" href={audience === "customer" ? `/account/orders/${order.orderCode}` : `/seller/orders/${order.orderCode}`}>{order.orderCode}</a>,
            shopById(order.sellerId)?.shopName ?? "-",
            <StatusBadge key="st" status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />,
            <StatusBadge key="pay" status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />,
            formatVnd(order.totalAmount),
            renderOrderAction(order)
          ])}
        />
      </Section>
    );
  }

  function OrderDetailPage({ orderCode, audience }: { orderCode?: string; audience: "customer" | "seller" }) {
    const order = store.state.orders.find((item) => item.orderCode === orderCode);
    if (!order) return <NotFoundPage />;
    const shop = shopById(order.sellerId);
    return (
      <Section title={`Chi tiết đơn ${order.orderCode}`}>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />
                <StatusBadge status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />
                <span className="text-sm text-muted">{shop?.shopName}</span>
              </div>
              <div className="mt-4 space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-3 border-t border-line pt-3">
                    <img src={item.productImageSnapshot} alt={item.productNameSnapshot} className="h-16 w-16 rounded-panel object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{item.productNameSnapshot}</p>
                      <p className="text-sm text-muted">{item.variantNameSnapshot} - SKU {item.skuSnapshot}</p>
                    </div>
                    <p className="font-bold">{formatVnd(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel>
              <h3 className="font-bold">Timeline</h3>
              <div className="mt-3">
                <OrderTimeline order={order} />
              </div>
            </Panel>
          </div>
          <Panel className="h-fit">
            <h3 className="font-bold">Shipment snapshot</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              {order.shipment.receiverName} - {order.shipment.receiverPhone}
              <br />
              {order.shipment.detailAddress}, {order.shipment.ward}, {order.shipment.district}, {order.shipment.province}
            </p>
            <div className="mt-4 grid gap-2">
              <InfoRow label="Subtotal" value={formatVnd(order.subtotalAmount)} />
              <InfoRow label="Phí ship" value={formatVnd(order.shippingFee)} />
              <InfoRow label="Tổng" value={formatVnd(order.totalAmount)} />
            </div>
            {audience === "customer" && canContinuePayment(order) ? (
              <div className="mt-4 grid gap-2">
                <Button onClick={() => goToPaymentForOrder(order)}>
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Thanh toán
                </Button>
                {canCustomerCancel(order) ? <Button variant="danger" onClick={() => store.cancelCustomerOrder(order.orderCode)}>Hủy đơn</Button> : null}
              </div>
            ) : null}
            {audience === "seller" ? (
              <div className="mt-4 grid gap-2">
                <Button disabled={order.paymentStatus !== "PAID" || order.orderStatus !== "PLACED"} onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Xác nhận đơn</Button>
                <Button variant="secondary" disabled={order.paymentStatus !== "PAID" || !order.sellerConfirmed || order.orderStatus !== "READY_TO_SHIP"} onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã chuyển shipping.", "success"); else showToast(res.message || "Lỗi chuyển shipping", "danger"); })}>Chuyển shipping</Button>
                <Button variant="secondary" onClick={() => store.updateSellerOrder(order.orderCode, "COMPLETED")}>Hoàn thành (Mock)</Button>
                <Button variant="danger" onClick={() => store.updateSellerOrder(order.orderCode, "DELIVERY_FAILED")}>Giao thất bại (Mock)</Button>
              </div>
            ) : null}
          </Panel>
        </div>
      </Section>
    );
  }

  function NotificationsPage() {
    const notifications = store.state.notifications.filter((item) => item.userId === store.currentUser?.id);
    return (
      <Section title="Thông báo">
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Panel key={notification.id}>
              <div className="flex items-start gap-3">
                <Bell className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-bold">{notification.title}</p>
                  <p className="mt-1 text-sm text-muted">{notification.content}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(notification.createdAt)}</p>
                </div>
              </div>
            </Panel>
          ))}
          {!notifications.length ? <EmptyState title="Chưa có thông báo" description="Bạn chưa có thông báo mới." /> : null}
        </div>
      </Section>
    );
  }

  function ChatPage() {
    const [mode, setMode] = useState<"AI" | "SUPPORTER">("AI");
    const conversation = store.state.conversations[0];
    return (
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Section title="Chat hỗ trợ">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Panel>
              <div className="grid gap-2">
                <Button variant={mode === "AI" ? "primary" : "secondary"} onClick={() => setMode("AI")}><Bot className="h-4 w-4" />Chat AI</Button>
                <Button variant={mode === "SUPPORTER" ? "primary" : "secondary"} onClick={() => setMode("SUPPORTER")}><MessageSquare className="h-4 w-4" />Gặp supporter</Button>
              </div>
              <div className="mt-4 space-y-2">
                {store.state.conversations.map((item) => (
                  <a key={item.id} href={`/supporter/conversations/${item.id}`} className="block rounded-panel border border-line p-3 hover:border-primary/40">
                    <p className="font-bold">{item.title}</p>
                    <p className="text-xs text-muted">{item.mode} - {item.status}</p>
                  </a>
                ))}
              </div>
            </Panel>
            <ChatWindow conversationId={conversation.id} mode={mode} />
          </div>
        </Section>
      </main>
    );
  }

  function ChatWindow({ conversationId, mode }: { conversationId: string; mode?: "AI" | "SUPPORTER" }) {
    const conversation = store.state.conversations.find((item) => item.id === conversationId) ?? store.state.conversations[0];
    return (
      <Panel className="min-h-[560px]">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h3 className="font-bold">{conversation.title}</h3>
            <p className="text-sm text-muted">{mode ?? conversation.mode} - {conversation.status}</p>
          </div>
          <Button variant="secondary" onClick={() => showToast("Đã gửi yêu cầu hỗ trợ.", "success")}>Chuyển hỗ trợ</Button>
        </div>
        <div className="mt-4 space-y-3">
          {conversation.messages.map((message) => (
            <div key={message.id} className={cn("flex", message.sender === "CUSTOMER" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[78%] rounded-panel border p-3 text-sm", message.sender === "CUSTOMER" ? "border-primary bg-primary text-white" : "border-line bg-canvas text-ink")}>
                <p className="font-bold">{message.sender}</p>
                <p className="mt-1 leading-6">{message.text}</p>
                <p className="mt-1 text-xs opacity-75">{formatDate(message.createdAt)} - {message.isRead ? "Đã đọc" : "Chưa đọc"}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto_auto]">
          <Input placeholder="Nhập tin nhắn" />
          <Input type="file" aria-label="Đính kèm ảnh hoặc file" />
          <Button onClick={() => showToast("Đã gửi tin nhắn.", "success")}>Gửi</Button>
        </div>
      </Panel>
    );
  }

  function renderSellerRoutes() {
    if (!store.currentUser) {
      return (
        <Unauthorized
          title="Cần đăng nhập"
          description="Bạn cần đăng nhập trước khi gửi hoặc theo dõi hồ sơ mở shop."
        />
      );
    }

    if (segments[1] === "register") return <SellerRegisterPage />;
    if (segments[1] === "pending") return <SellerStatusPage status="PENDING" />;
    if (segments[1] === "rejected") return <SellerStatusPage status="REJECTED" />;
    if (segments[1] === "suspended") return <SellerStatusPage status="SUSPENDED" />;
    return (
      <DashboardFrame kind="seller">
        {segments.length === 1 ? <SellerDashboard /> : null}
        {segments[1] === "profile" ? <SellerProfilePage /> : null}
        {segments[1] === "products" && segments[2] === "new" ? <ProductFormPage /> : null}
        {segments[1] === "products" && segments[3] === "edit" ? <ProductFormPage productId={segments[2]} /> : null}
        {segments[1] === "products" && !segments[2] ? <SellerProductsPage /> : null}
        {segments[1] === "inventory" ? <SellerInventoryPage /> : null}
        {segments[1] === "orders" && segments[2] ? <OrderDetailPage orderCode={segments[2]} audience="seller" /> : null}
        {segments[1] === "orders" && !segments[2] ? <OrdersList audience="seller" /> : null}
        {segments[1] === "revenue" ? <SellerRevenuePage /> : null}
        {segments[1] === "category-suggestions" ? <CategorySuggestionsPage /> : null}
      </DashboardFrame>
    );
  }

  function DashboardFrame({ kind, children }: { kind: "seller" | "admin" | "supporter"; children: ReactNode }) {
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
    const homeHref = roleHomePath(kind.toUpperCase());
    const canSwitchToBuyer = Boolean(store.currentUser);

    return (
      <div className="min-h-screen bg-canvas">
        <div className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <a href={homeHref} className="flex items-center gap-2 font-black text-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-panel bg-primary text-white">S</span>
              {brandName} {kind}
            </a>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">{store.currentUser?.fullName ?? "Khách"}</span>
              {canSwitchToBuyer ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    store.switchRole("CUSTOMER");
                    window.location.href = "/";
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
                  window.location.href = "/login";
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
                <a key={href as string} href={href as string} className={cn(linkClass, pathname === href && activeLinkClass)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label as string}
                </a>
              ))}
            </nav>
          </aside>
          <main>{children ?? <NotFoundPage />}</main>
        </div>
      </div>
    );
  }

  function SellerRegisterPage() {
    const [form, setForm] = useState<SellerApplication>({
      shopName: "",
      phone: store.currentUser?.phone ?? "",
      email: store.currentUser?.email ?? "",
      pickupAddress: "",
      taxCode: "",
      bankName: "",
      bankAccountNumber: "",
      bankAccountName: store.currentUser?.fullName ?? ""
    });
    const [mode, setMode] = useState<"create" | "update">("create");
    const [applicationStatus, setApplicationStatus] = useState<SellerStatus | undefined>();
    const [loadingApplication, setLoadingApplication] = useState(true);
    const [savingApplication, setSavingApplication] = useState(false);
    const [formError, setFormError] = useState("");

    useEffect(() => {
      let cancelled = false;

      if (!store.currentUser) {
        setLoadingApplication(false);
        return () => {
          cancelled = true;
        };
      }

      setForm((prev) => ({
        ...prev,
        phone: prev.phone || store.currentUser?.phone || "",
        email: prev.email || store.currentUser?.email || "",
        bankAccountName: prev.bankAccountName || store.currentUser?.fullName || ""
      }));

      store.getSellerApplication()
        .then((result) => {
          if (cancelled) return;

          if (!result.ok) {
            setFormError(result.message);
            return;
          }

          const application = result.application;
          const status = application?.status ?? result.sellerMe.status ?? undefined;
          setApplicationStatus(status);

          if (application) {
            setMode("update");
            setForm({
              shopName: application.shopName,
              phone: application.phone,
              email: application.email,
              pickupAddress: application.pickupAddress,
              taxCode: application.taxCode,
              bankName: application.bankName,
              bankAccountNumber: application.bankAccountNumber,
              bankAccountName: application.bankAccountName,
              shopSlug: application.shopSlug,
              status
            });
          } else {
            setMode("create");
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingApplication(false);
        });

      return () => {
        cancelled = true;
      };
    }, [store.currentUser?.id, store.currentUser?.email, store.currentUser?.phone, store.currentUser?.fullName, store.getSellerApplication]);

    const updateField = (field: keyof SellerApplication) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSavingApplication(true);
      setFormError("");

      const result = await store.saveSellerApplication(form, mode);
      setSavingApplication(false);

      if (!result.ok) {
        setFormError(result.message);
        showToast(result.message, "danger");
        return;
      }

      showToast(result.message, "success");
      window.location.href = result.redirectTo;
    };

    if (!store.currentUser) {
      return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi gửi hồ sơ mở shop." />;
    }

    if (loadingApplication) {
      return (
        <main className="mx-auto max-w-4xl px-4 py-8">
          <Panel>
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold text-muted">Đang tải hồ sơ shop...</p>
            </div>
          </Panel>
        </main>
      );
    }

    if (applicationStatus === "APPROVED") {
      return (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <Panel>
            <StatusBadge status="APPROVED" label={sellerStatusLabel.APPROVED} />
            <h1 className="mt-3 text-2xl font-black text-ink">Shop đã được duyệt</h1>
            <p className="mt-2 text-sm leading-6 text-muted">Hồ sơ đã được duyệt.</p>
            <Button className="mt-4" onClick={() => (window.location.href = "/seller")}>
              Vào kênh người bán
            </Button>
          </Panel>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Section title={mode === "update" ? "Cập nhật hồ sơ mở shop" : "Đăng ký trở thành người bán"}>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Panel>
              {formError ? (
                <div className="mb-4">
                  <ErrorState title="Chưa gửi được hồ sơ" description={formError} />
                </div>
              ) : null}
              <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                <Field label="Tên shop" hint="4-100 ký tự">
                  <Input value={form.shopName} onChange={updateField("shopName")} placeholder="Shepoo Store" />
                </Field>
                <Field label="Email shop">
                  <Input value={form.email} onChange={updateField("email")} placeholder="shop@example.com" />
                </Field>
                <Field label="Số điện thoại shop">
                  <Input value={form.phone} onChange={updateField("phone")} placeholder="0901234567" />
                </Field>
                <Field label="Mã số thuế" hint="10-14 ký tự">
                  <Input value={form.taxCode} onChange={updateField("taxCode")} placeholder="0312345678" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Địa chỉ lấy hàng" hint="10-200 ký tự">
                    <Input value={form.pickupAddress} onChange={updateField("pickupAddress")} placeholder="Số nhà, phường/xã, quận/huyện, tỉnh/thành" />
                  </Field>
                </div>
                <Field label="Ngân hàng">
                  <Input value={form.bankName} onChange={updateField("bankName")} placeholder="VCB, ACB, BIDV..." />
                </Field>
                <Field label="Số tài khoản">
                  <Input value={form.bankAccountNumber} onChange={updateField("bankAccountNumber")} placeholder="0123456789" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Tên chủ tài khoản">
                    <Input value={form.bankAccountName} onChange={updateField("bankAccountName")} placeholder={store.currentUser.fullName} />
                  </Field>
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Button type="submit" disabled={savingApplication}>
                    {savingApplication ? "Đang gửi..." : mode === "update" ? "Cập nhật và gửi duyệt lại" : "Gửi yêu cầu"}
                  </Button>
                  {applicationStatus === "REJECTED" ? (
                    <Button type="button" variant="secondary" onClick={() => (window.location.href = "/seller/rejected")}>
                      Xem trạng thái từ chối
                    </Button>
                  ) : null}
                </div>
              </form>
            </Panel>
            <Panel className="h-fit">
              <div className="flex items-center gap-3">
                <Store className="h-9 w-9 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm text-muted">Trạng thái hồ sơ</p>
                  <div className="mt-1">
                    <StatusBadge status={applicationStatus ?? "PENDING"} label={applicationStatus ? sellerStatusLabel[applicationStatus] : "Chưa gửi"} />
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
                {applicationStatus === "PENDING" ? <p>Hồ sơ đang chờ admin duyệt.</p> : null}
                {applicationStatus === "REJECTED" ? <p>Hồ sơ bị từ chối có thể sửa và gửi duyệt lại.</p> : null}
              </div>
            </Panel>
          </div>
        </Section>
      </main>
    );
  }

  function SellerRegisterPageLegacy() {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Section title="Đăng ký trở thành người bán">
          <Panel>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tên shop"><Input placeholder="Shepoo Store" /></Field>
              <Field label="Slug"><Input placeholder="shepoo-store" /></Field>
              <Field label="Logo"><Input type="file" /></Field>
              <Field label="Email shop"><Input placeholder="shop@example.com" /></Field>
              <Field label="Phone shop"><Input placeholder="090..." /></Field>
              <Field label="Phí ship cố định"><Input type="number" placeholder="30000" /></Field>
              <Field label="Đơn vị vận chuyển"><Input placeholder="Tự giao / GHN" /></Field>
              <Field label="Địa chỉ kho"><Input placeholder="Địa chỉ lấy hàng" /></Field>
              <div className="md:col-span-2"><Field label="Mô tả shop"><Textarea /></Field></div>
            </div>
            <Button className="mt-4" onClick={() => { showToast("Đã gửi hồ sơ shop, chuyển sang pending.", "success"); window.location.href = "/seller/pending"; }}>Gửi yêu cầu</Button>
          </Panel>
        </Section>
      </main>
    );
  }

  function SellerStatusPage({ status }: { status: SellerStatus }) {
    const [application, setApplication] = useState<SellerApplication | undefined>();
    const [actualStatus, setActualStatus] = useState<SellerStatus>(status);
    const [hasProfile, setHasProfile] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [statusError, setStatusError] = useState("");

    useEffect(() => {
      let cancelled = false;

      store.getSellerApplication()
        .then((result) => {
          if (cancelled) return;

          if (!result.ok) {
            setStatusError(result.message);
            return;
          }

          setHasProfile(result.sellerMe.has_seller_profile);
          const nextStatus = result.application?.status ?? result.sellerMe.status ?? status;
          setActualStatus(nextStatus);
          setApplication(result.application);
        })
        .finally(() => {
          if (!cancelled) setLoadingStatus(false);
        });

      return () => {
        cancelled = true;
      };
    }, [status, store.getSellerApplication]);

    if (loadingStatus) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <Panel>
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold text-muted">Đang kiểm tra trạng thái hồ sơ...</p>
            </div>
          </Panel>
        </main>
      );
    }

    if (statusError) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <ErrorState title="Không tải được trạng thái seller" description={statusError} />
        </main>
      );
    }

    if (!hasProfile) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <EmptyState
            title="Chưa có hồ sơ mở shop"
            description="Bạn cần gửi hồ sơ seller trước khi theo dõi trạng thái xét duyệt."
            action={<Button onClick={() => (window.location.href = "/seller/register")}>Gửi hồ sơ</Button>}
          />
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Panel>
          <StatusBadge status={actualStatus} label={sellerStatusLabel[actualStatus]} />
          <h1 className="mt-3 text-3xl font-black text-ink">Trạng thái shop: {sellerStatusLabel[actualStatus]}</h1>
          {application?.shopName ? <p className="mt-1 text-sm font-semibold text-muted">{application.shopName}</p> : null}
          <p className="mt-2 text-sm leading-6 text-muted">
            {actualStatus === "PENDING" && "Hồ sơ đang chờ admin duyệt."}
            {actualStatus === "REJECTED" && `Hồ sơ bị từ chối.${application?.rejectedReason ? ` Lý do: ${application.rejectedReason}.` : ""}`}
            {actualStatus === "SUSPENDED" && "Shop bị tạm ngưng, không được truy cập dashboard bán hàng."}
            {actualStatus === "APPROVED" && "Shop đã được duyệt. Bạn có thể vào kênh người bán."}
            {actualStatus === "CLOSED" && "Shop đã đóng."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {actualStatus === "APPROVED" ? <Button onClick={() => (window.location.href = "/seller")}>Vào kênh người bán</Button> : null}
            {actualStatus === "REJECTED" ? <Button onClick={() => (window.location.href = "/seller/register")}>Sửa hồ sơ</Button> : null}
            <Button variant="secondary" onClick={() => (window.location.href = "/")}>Về marketplace</Button>
          </div>
        </Panel>
      </main>
    );
  }

  function SellerStatusPageLegacy({ status }: { status: SellerStatus }) {
    const shop = store.currentShop ?? store.state.shops.find((item) => item.status === status);
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Panel>
          <StatusBadge status={status} label={sellerStatusLabel[status]} />
          <h1 className="mt-3 text-3xl font-black text-ink">Trạng thái shop: {sellerStatusLabel[status]}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {status === "PENDING" && "Hồ sơ đang chờ admin duyệt."}
            {status === "REJECTED" && `Hồ sơ bị từ chối. Lý do: ${shop?.rejectedReason ?? "Chưa rõ"}.`}
            {status === "SUSPENDED" && "Shop bị tạm ngưng, không được truy cập dashboard bán hàng."}
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => (window.location.href = "/")}>Về marketplace</Button>
        </Panel>
      </main>
    );
  }

  function SellerDashboard() {
    const shop = store.currentShop;
    
    useEffect(() => {
      if (shop?.status === "APPROVED") {
        store.fetchSellerOrders();
        store.fetchSellerProducts();
      }
    }, [shop?.status, store.fetchSellerOrders, store.fetchSellerProducts]);

    if (!shop) {
      return (
        <Section title="Kênh người bán">
          <EmptyState
            title="Chưa có hồ sơ shop"
            description="Bạn cần gửi hồ sơ mở shop trước khi truy cập dashboard người bán."
            action={<Button onClick={() => (window.location.href = "/seller/register")}>Gửi hồ sơ</Button>}
          />
        </Section>
      );
    }

    if (shop.status !== "APPROVED") {
      return (
        <Section title="Trạng thái shop">
          <Panel>
            <StatusBadge status={shop.status} label={sellerStatusLabel[shop.status]} />
            <p className="mt-2 text-sm leading-6 text-muted">Shop hiện chưa ở trạng thái được duyệt.</p>
            <Button className="mt-4" variant="secondary" onClick={() => (window.location.href = `/seller/${shop.status.toLowerCase()}`)}>
              Xem trạng thái
            </Button>
          </Panel>
        </Section>
      );
    }

    const sellerOrders = store.state.orders.filter((order) => order.sellerId === shop?.id);
    const revenue = sellerOrders.filter((order) => order.orderStatus === "COMPLETED").reduce((sum, order) => sum + order.totalAmount, 0);
    const waiting = sellerOrders.filter((order) => !order.sellerConfirmed && order.orderStatus === "PLACED").length;
    return (
      <Section title="Seller dashboard">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Doanh thu hoàn thành" value={formatVnd(revenue)} />
          <MetricCard label="Tổng đã bán" value={`${shop?.totalSold ?? 0}`} />
          <MetricCard label="Đơn cần xác nhận" value={`${waiting}`} detail="Deadline xác nhận 2 ngày" />
          <MetricCard label="Sản phẩm" value={`${store.state.products.filter((product) => product.sellerId === shop?.id).length}`} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel>
            <h3 className="font-bold">Shortcut</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => (window.location.href = "/seller/products/new")}>Tạo sản phẩm</Button>
              <Button variant="secondary" onClick={() => (window.location.href = "/seller/orders")}>Xem đơn hàng</Button>
            </div>
          </Panel>
          <Panel>
            <h3 className="font-bold">Nhắc hạn xác nhận</h3>
            <p className="mt-2 text-sm text-muted">{waiting} đơn đang chờ xác nhận.</p>
          </Panel>
        </div>
      </Section>
    );
  }

  function SellerProfilePage() {
    const shop = store.currentShop;
    if (!shop) return <SellerRegisterPage />;
    return (
      <Section title="Hồ sơ shop">
        <Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên shop"><Input defaultValue={shop.shopName} /></Field>
            <Field label="Slug"><Input defaultValue={shop.shopSlug} /></Field>
            <Field label="Email"><Input defaultValue={shop.email} /></Field>
            <Field label="Phone"><Input defaultValue={shop.phone} /></Field>
            <Field label="Phí ship"><Input type="number" defaultValue={shop.shippingFee} /></Field>
            <Field label="Đơn vị vận chuyển"><Input defaultValue={shop.shippingProviderName} /></Field>
            <div className="md:col-span-2"><Field label="Địa chỉ kho"><Input defaultValue={shop.pickupAddress} /></Field></div>
            <div className="md:col-span-2"><Field label="Mô tả"><Textarea defaultValue={shop.description} /></Field></div>
          </div>
          <Button className="mt-4" onClick={() => showToast("Đã lưu hồ sơ shop.", "success")}>Lưu</Button>
        </Panel>
      </Section>
    );
  }

  function SellerProductsPage() {
    const shop = store.currentShop;
    
    useEffect(() => {
      if (shop) store.fetchSellerProducts();
    }, [shop, store.fetchSellerProducts]);

    const products = store.state.products.filter((product) => product.sellerId === shop?.id);
    return (
      <Section title="Quản lý sản phẩm" action={<Button onClick={() => (window.location.href = "/seller/products/new")}><Plus className="h-4 w-4" />Tạo sản phẩm</Button>}>
        <DataTable
          columns={["Sản phẩm", "Categories", "Variants", "Kho", "Đã bán", "Rating", "Status", "Action"]}
          rows={products.map((product) => {
            const productVariants = store.state.variants.filter((variant) => variant.productId === product.id);
            const stock = productVariants.reduce((sum, variant) => sum + variant.inventory.quantity, 0);
            return [
              <span key="name" className="font-bold">{product.name}</span>,
              getCategoryNames(store.state.categories, product) || "Bỏ trống",
              `${productVariants.length}`,
              `${stock}`,
              `${product.soldCount}`,
              product.averageRating.toFixed(1),
              <StatusBadge key="st" status={product.status} label={productStatusLabel[product.status]} />,
              <div key="actions" className="flex gap-3 text-sm">
                <a className="font-bold text-primary" href={`/seller/products/${product.id}/edit`}>Sửa</a>
                {product.status !== "HIDDEN" && (
                  <button className="text-muted hover:text-primary" onClick={() => store.hideSellerProduct(product.id).then((r) => { if(!r.ok) showToast(r.message||"", "danger") })}>Ẩn</button>
                )}
                <button className="text-danger hover:text-danger/80" onClick={() => { if(confirm("Xóa sản phẩm?")) store.deleteSellerProduct(product.id).then((r) => { if(!r.ok) showToast(r.message||"", "danger") }) }}>Xóa</button>
              </div>
            ];
          })}
        />
      </Section>
    );
  }

  function ProductFormPage({ productId }: { productId?: string }) {
    const editing = store.state.products.find((product) => product.id === productId);
    const shop = store.currentShop;
    const editingVariants = editing ? store.state.variants.filter((v) => v.productId === editing.id) : [];

    const [name, setName] = useState(editing?.name ?? "");
    const [shortDescription, setShortDescription] = useState(editing?.shortDescription ?? "");
    const [description, setDescription] = useState(editing?.description ?? "");
    const [brand, setBrand] = useState(editing?.brand ?? "");
    const [origin, setOrigin] = useState(editing?.origin ?? "Việt Nam");
    const [warranty, setWarranty] = useState(editing?.warranty ?? "");
    const [status, setStatus] = useState<Product["status"]>(editing?.status ?? "ACTIVE");
    const [categoryIds, setCategoryIds] = useState<string[]>(editing?.categoryIds ?? []);
    const [imageUrl, setImageUrl] = useState(editing?.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80");
    const slug = slugify(name || "san-pham-moi");

    const [hasVariants, setHasVariants] = useState(editing && editing.variantOptions && editing.variantOptions.length > 0 ? true : false);
    const [options, setOptions] = useState<{name: string, values: string[], rawValue?: string}[]>(
      editing?.variantOptions ? editing.variantOptions : []
    );
    const [variantMatrix, setVariantMatrix] = useState<{
      tierIndex: number[];
      sku: string;
      price: string;
      quantity: string;
      imageUrl: string;
      publicId?: string;
    }[]>([{ tierIndex: [], sku: "", price: "199000", quantity: "20", imageUrl: imageUrl }]);

    const [bulkPrice, setBulkPrice] = useState("");
    const [bulkQuantity, setBulkQuantity] = useState("");

    useEffect(() => {
      if (editing) {
        setName(editing.name ?? "");
        setShortDescription(editing.shortDescription ?? "");
        setDescription(editing.description ?? "");
        setBrand(editing.brand ?? "");
        setOrigin(editing.origin ?? "Việt Nam");
        setWarranty(editing.warranty ?? "");
        setStatus(editing.status ?? "ACTIVE");
        setCategoryIds(editing.categoryIds ?? []);
        setImageUrl(editing.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80");
        
        if (editing.variantOptions && editing.variantOptions.length > 0) {
          setHasVariants(true);
          setOptions(editing.variantOptions);
        } else {
          setHasVariants(false);
          setOptions([]);
        }

        const newMatrix = editingVariants.map(v => ({
            tierIndex: v.tierIndex ?? [],
            sku: v.sku,
            price: v.price.toString(),
            quantity: v.inventory?.quantity.toString() ?? "0",
            imageUrl: v.imageUrl ?? (editing.thumbnailUrl || ""),
            publicId: v.id
        }));
        
        if (!editing.variantOptions || editing.variantOptions.length === 0) {
            if (editingVariants.length > 0) {
                setVariantMatrix([{
                    tierIndex: [],
                    sku: editingVariants[0].sku,
                    price: editingVariants[0].price.toString(),
                    quantity: editingVariants[0].inventory?.quantity.toString() ?? "0",
                    imageUrl: editingVariants[0].imageUrl ?? (editing.thumbnailUrl || ""),
                    publicId: editingVariants[0].id
                }]);
            }
        } else {
            setVariantMatrix(newMatrix);
        }
      }
    }, [editing, store.state.variants]);

    // Generate Cartesian Product of options
    useEffect(() => {
        if (!hasVariants || options.length === 0) return;
        
        const generateCartesian = (opts: {name: string, values: string[]}[]): number[][] => {
            if (opts.length === 0) return [[]];
            const first = opts[0];
            const rest = generateCartesian(opts.slice(1));
            const result: number[][] = [];
            for (let i = 0; i < first.values.length; i++) {
                for (const r of rest) {
                    result.push([i, ...r]);
                }
            }
            return result;
        };

        const allCombinations = generateCartesian(options.filter(o => o.values.length > 0));
        
        // Preserve existing data in matrix if tierIndex matches
        setVariantMatrix(prev => {
            return allCombinations.map(combo => {
                const existing = prev.find(p => p.tierIndex && p.tierIndex.length === combo.length && p.tierIndex.every((val, idx) => val === combo[idx]));
                if (existing) return existing;
                return {
                    tierIndex: combo,
                    sku: `${shop?.shopSlug}-${slug}-${combo.join("")}`,
                    price: "0",
                    quantity: "0",
                    imageUrl: imageUrl
                };
            });
        });

    }, [options, hasVariants]);

    const handleApplyBulk = () => {
        setVariantMatrix(prev => prev.map(row => ({
            ...row,
            price: bulkPrice ? bulkPrice : row.price,
            quantity: bulkQuantity ? bulkQuantity : row.quantity
        })));
    };

    const handleAddOption = () => {
        if (options.length >= 2) return;
        setOptions([...options, { name: `Nhóm phân loại ${options.length + 1}`, values: [] }]);
    };

    return (
      <Section title={editing ? "Sửa sản phẩm" : "Tạo sản phẩm"}>
        <Panel>
          <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
            <div className="grid gap-4">
              <Field label="Tên sản phẩm"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
              <InfoRow label="Slug preview" value={slug} />
              <Field label="Mô tả ngắn"><Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} /></Field>
              <Field label="Mô tả dài"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Brand"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
                <Field label="Xuất xứ"><Input value={origin} onChange={(e) => setOrigin(e.target.value)} /></Field>
                <Field label="Bảo hành"><Input value={warranty} onChange={(e) => setWarranty(e.target.value)} /></Field>
              </div>
              <Field label="URL ảnh sản phẩm chính">
                <Input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Nhập URL ảnh" />
              </Field>
              <Field label="Danh mục sản phẩm">
                <div className="grid gap-2 sm:grid-cols-2">
                  {store.state.categories.map((category) => (
                    <Checkbox
                      key={category.id}
                      label={category.name}
                      checked={categoryIds.includes(category.id)}
                      onChange={(event) => {
                        setCategoryIds((prev) => event.target.checked ? [...prev, category.id] : prev.filter((id) => id !== category.id));
                      }}
                    />
                  ))}
                </div>
              </Field>
            </div>
            
            <div className="grid gap-4">
              <Panel className="shadow-none flex flex-col gap-4">
                <h3 className="font-bold border-b pb-2">Phân loại hàng (Variant Options)</h3>
                <Checkbox 
                    label="Sản phẩm có nhiều phân loại?" 
                    checked={hasVariants} 
                    onChange={e => {
                        setHasVariants(e.target.checked);
                        if (!e.target.checked) {
                            setOptions([]);
                            setVariantMatrix([{ tierIndex: [], sku: `${shop?.shopSlug}-${slug}-1`, price: "0", quantity: "0", imageUrl: imageUrl }]);
                        } else if (options.length === 0) {
                            setOptions([{ name: "Màu sắc", values: ["Đỏ", "Xanh"] }]);
                        }
                    }} 
                />

                {hasVariants && (
                    <div className="space-y-4">
                        {options.map((opt, oIdx) => (
                            <div key={oIdx} className="bg-slate-50 dark:bg-slate-800 p-3 rounded border space-y-2">
                                <div className="flex justify-between items-center">
                                    <Input value={opt.name} onChange={e => {
                                        const newOpts = [...options];
                                        newOpts[oIdx].name = e.target.value;
                                        setOptions(newOpts);
                                    }} className="w-1/2" />
                                    <Button variant="danger" onClick={() => {
                                        setOptions(options.filter((_, i) => i !== oIdx));
                                    }}>Xóa</Button>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Các giá trị (Cách nhau bởi dấu phẩy)</label>
                                    <Input 
                                        value={opt.rawValue ?? opt.values.join(", ")} 
                                        onChange={e => {
                                            const newOpts = [...options];
                                            newOpts[oIdx].rawValue = e.target.value;
                                            newOpts[oIdx].values = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                                            setOptions(newOpts);
                                        }} 
                                        placeholder="Ví dụ: Đỏ, Xanh, Vàng" 
                                    />
                                </div>
                            </div>
                        ))}
                        {options.length < 2 && (
                            <Button variant="secondary" onClick={handleAddOption} className="w-full text-sm">
                                + Thêm nhóm phân loại
                            </Button>
                        )}
                    </div>
                )}
              </Panel>
              
              <Field label="Status">
                <Select value={status} onChange={(event) => setStatus(event.target.value as Product["status"])}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
                  <option value="DELETED">DELETED</option>
                </Select>
              </Field>
            </div>
          </div>

          <div className="mt-8 border-t pt-8">
            <h3 className="font-bold text-lg mb-4">Ma trận phân loại hàng</h3>
            {hasVariants && (
                <div className="flex items-center gap-3 mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded border">
                    <span className="font-semibold text-sm">Áp dụng cho tất cả:</span>
                    <Input placeholder="Giá bán..." value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} type="number" className="w-32" />
                    <Input placeholder="Tồn kho..." value={bulkQuantity} onChange={e => setBulkQuantity(e.target.value)} type="number" className="w-32" />
                    <Button variant="secondary" onClick={handleApplyBulk}>Áp dụng</Button>
                </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b">
                        {hasVariants && options.map((o, i) => (
                            <th key={i} className="p-3 text-left font-medium">{o.name}</th>
                        ))}
                        <th className="p-3 text-left font-medium">Giá bán *</th>
                        <th className="p-3 text-left font-medium">Tồn kho *</th>
                        <th className="p-3 text-left font-medium">SKU</th>
                    </tr>
                </thead>
                <tbody>
                    {variantMatrix.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            {hasVariants && row.tierIndex.map((optIdx, i) => (
                                <td key={i} className="p-3">{options[i]?.values[optIdx]}</td>
                            ))}
                            <td className="p-3">
                                <Input type="number" value={row.price} onChange={e => {
                                    const newM = [...variantMatrix];
                                    newM[rIdx].price = e.target.value;
                                    setVariantMatrix(newM);
                                }} />
                            </td>
                            <td className="p-3">
                                <Input type="number" value={row.quantity} onChange={e => {
                                    const newM = [...variantMatrix];
                                    newM[rIdx].quantity = e.target.value;
                                    setVariantMatrix(newM);
                                }} />
                            </td>
                            <td className="p-3">
                                <Input value={row.sku} onChange={e => {
                                    const newM = [...variantMatrix];
                                    newM[rIdx].sku = e.target.value;
                                    setVariantMatrix(newM);
                                }} />
                            </td>
                        </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button
                onClick={async () => {
                  if (!shop) {
                    showToast("Shop của bạn chưa sẵn sàng để tạo sản phẩm.", "danger");
                    return;
                  }

                  const payload = {
                    name: name || "Sản phẩm mới",
                    slug,
                    short_description: shortDescription,
                    description: description,
                    brand: brand,
                    origin: origin,
                    warranty_info: warranty,
                    category_ids: categoryIds.map(Number),
                    variant_options: hasVariants ? options : [],
                    images: [
                      { image_url: imageUrl, is_thumbnail: true, sort_order: 1 }
                    ],
                    variants: variantMatrix.map(row => ({
                      public_id: row.publicId,
                      sku: row.sku || `${shop.shopSlug}-${slug}-${row.tierIndex.join("") || "1"}`,
                      variant_name: hasVariants && options.length > 0 
                        ? row.tierIndex.map((tIdx, i) => options[i].values[tIdx]).join(" - ")
                        : "Default",
                      price: Number(row.price) || 0,
                      quantity: Number(row.quantity) || 0,
                      image_url: imageUrl,
                      tier_index: hasVariants ? row.tierIndex : []
                    }))
                  };

                  let res;
                  if (editing) {
                    res = await store.updateSellerProduct(editing.id, payload);
                  } else {
                    res = await store.createSellerProduct(payload);
                  }

                  if (res.ok) {
                    showToast("Đã lưu sản phẩm.", "success");
                    window.location.href = "/seller/products";
                  } else {
                    showToast(res.message || "Lỗi lưu sản phẩm", "danger");
                  }
                }}
              >
                Lưu sản phẩm
              </Button>
          </div>
        </Panel>
      </Section>
    );
  }

  function InventoryAdjuster({ variant }: { variant: ProductVariant }) {
    const product = store.state.products.find((item) => item.id === variant.productId);
    const [quantity, setQuantity] = useState(variant.inventory.quantity.toString());
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
      if (!product) return;
      setLoading(true);
      const allProductVariants = store.state.variants.filter(v => v.productId === product.id);
      const payload = {
          variants: allProductVariants.map(v => ({
              public_id: v.id,
              sku: v.sku,
              variant_name: v.variantName,
              price: v.price,
              quantity: v.id === variant.id ? Number(quantity) : v.inventory.quantity,
              image_url: v.imageUrl,
              tier_index: v.tierIndex
          }))
      };
      const res = await store.updateSellerProduct(product.id, payload);
      setLoading(false);
      if (res.ok) {
          showToast("Đã điều chỉnh tồn kho.", "success");
      } else {
          showToast(res.message || "Lỗi cập nhật tồn kho", "danger");
      }
    };

    return (
      <div className="flex items-center gap-2">
        <Input className="w-24" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
        <Button variant="secondary" onClick={handleSave} disabled={loading}>Lưu</Button>
      </div>
    );
  }

  function SellerInventoryPage() {
    const shop = store.currentShop;
    const products = store.state.products.filter((product) => product.sellerId === shop?.id);
    const productIds = new Set(products.map((product) => product.id));
    const variants = store.state.variants.filter((variant) => productIds.has(variant.productId));
    return (
      <Section title="Tồn kho theo variant">
        <DataTable
          columns={["Variant", "SKU", "Sản phẩm", "Quantity", "Reserved", "Status", "Điều chỉnh"]}
          rows={variants.map((variant) => {
            const product = store.state.products.find((item) => item.id === variant.productId);
            return [
              variant.variantName,
              variant.sku,
              product?.name ?? "-",
              `${variant.inventory.quantity}`,
              `${variant.inventory.reservedQuantity}`,
              <StatusBadge key="st" status={variant.status} label={variant.status} />,
              <InventoryAdjuster key={`adj-${variant.id}`} variant={variant} />
            ];
          })}
        />
      </Section>
    );
  }

  function SellerRevenuePage() {
    const shop = store.currentShop;
    const completed = store.state.orders.filter((order) => order.sellerId === shop?.id && order.orderStatus === "COMPLETED");
    const revenue = completed.reduce((sum, order) => sum + order.totalAmount, 0);
    return (
      <Section title="Doanh thu">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Panel>
            <Field label="Khoảng thời gian">
              <Select><option>Ngày</option><option>Tháng</option><option>Năm</option></Select>
            </Field>
            <Field label="Từ ngày"><Input type="date" /></Field>
            <Field label="Đến ngày"><Input type="date" /></Field>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Doanh thu" value={formatVnd(revenue)} />
            <MetricCard label="Đơn hoàn thành" value={`${completed.length}`} />
            <MetricCard label="Đơn đã hủy" value={`${store.state.orders.filter((order) => order.sellerId === shop?.id && order.orderStatus === "CANCELLED").length}`} />
          </div>
        </div>
      </Section>
    );
  }

  function CategorySuggestionsPage() {
    return (
      <Section title="Đề xuất category">
        <Panel>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Field label="Tên category đề xuất"><Input /></Field>
            <Field label="Lý do"><Input /></Field>
            <div className="flex items-end"><Button onClick={() => showToast("Đã gửi đề xuất category.", "success")}>Gửi</Button></div>
          </div>
        </Panel>
      </Section>
    );
  }

  function renderAdminRoutes() {
    return (
      <DashboardFrame kind="admin">
        {segments.length === 1 ? <AdminDashboard /> : null}
        {segments[1] === "users" && segments[2] ? <AdminUserDetail userId={segments[2]} /> : null}
        {segments[1] === "users" && !segments[2] ? <AdminUsersPage /> : null}
        {segments[1] === "sellers" && segments[2] ? <AdminSellerDetail sellerId={segments[2]} /> : null}
        {segments[1] === "sellers" && !segments[2] ? <AdminSellersPage /> : null}
        {segments[1] === "categories" ? <AdminCategoriesPage /> : null}
        {segments[1] === "products" && segments[2] ? <AdminProductDetail productId={segments[2]} /> : null}
        {segments[1] === "products" && !segments[2] ? <AdminProductsPage /> : null}
        {segments[1] === "statistics" ? <AdminStatisticsPage /> : null}
        {segments[1] === "violation-reports" ? <ViolationReportsPage /> : null}
        {segments[1] === "supporters" ? <SupportersAdminPage /> : null}
        {segments[1] === "chats" ? <AdminChatsPage /> : null}
        {segments[1] === "system-reports" ? <SystemReportsPage /> : null}
        {segments[1] === "ai" && segments[2] === "knowledge" ? <AiKnowledgePage /> : null}
      </DashboardFrame>
    );
  }

  function AdminDashboard() {
    const completed = store.state.orders.filter((order) => order.orderStatus === "COMPLETED");
    return (
      <Section title="Admin dashboard">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Doanh thu toàn sàn" value={formatVnd(completed.reduce((sum, order) => sum + order.totalAmount, 0))} />
          <MetricCard label="Người dùng" value={`${store.state.users.length}`} />
          <MetricCard label="Người bán" value={`${store.state.shops.length}`} />
          <MetricCard label="Hồ sơ chờ duyệt" value={`${store.state.shops.filter((shop) => shop.status === "PENDING").length}`} />
        </div>
      </Section>
    );
  }

  function AdminUsersPage() {
    return (
      <Section title="Quản lý users">
        <DataTable
          columns={["User", "Email", "Roles", "Status", "Action"]}
          rows={store.state.users.map((user) => [
            <a key="name" href={`/admin/users/${user.id}`} className="font-bold text-primary">{user.fullName}</a>,
            user.email,
            user.roles.join(", "),
            <StatusBadge key="st" status={user.status} label={user.status} />,
            <Button key="lock" variant={user.status === "LOCKED" ? "secondary" : "danger"} onClick={() => store.toggleUserLock(user.id)}>{user.status === "LOCKED" ? "Unlock" : "Lock"}</Button>
          ])}
        />
      </Section>
    );
  }

  function AdminUserDetail({ userId }: { userId?: string }) {
    const user = store.state.users.find((item) => item.id === userId);
    if (!user) return <NotFoundPage />;
    return (
      <Section title={`User ${user.fullName}`}>
        <Panel>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Phone" value={user.phone} />
            <InfoRow label="Roles" value={user.roles.join(", ")} />
            <InfoRow label="Status" value={user.status} />
            <InfoRow label="Lock reason" value={user.lockReason ?? "Không có"} />
          </div>
          <Button className="mt-4" variant={user.status === "LOCKED" ? "secondary" : "danger"} onClick={() => store.toggleUserLock(user.id)}>{user.status === "LOCKED" ? "Unlock user" : "Lock user"}</Button>
        </Panel>
      </Section>
    );
  }

  function AdminSellersPage() {
    const [status, setStatus] = useState<SellerStatus | "">("");
    const [applications, setApplications] = useState<SellerApplication[]>([]);
    const [loadingApplications, setLoadingApplications] = useState(true);
    const [applicationsError, setApplicationsError] = useState("");
    const [busyApplicationId, setBusyApplicationId] = useState("");

    useEffect(() => {
      let cancelled = false;
      setLoadingApplications(true);
      setApplicationsError("");

      store.listSellerApplications(status)
        .then((result) => {
          if (cancelled) return;

          if (!result.ok) {
            setApplicationsError(result.message);
            setApplications([]);
            return;
          }

          setApplications(result.applications);
        })
        .finally(() => {
          if (!cancelled) setLoadingApplications(false);
        });

      return () => {
        cancelled = true;
      };
    }, [status, store.listSellerApplications]);

    const reviewApplication = async (application: SellerApplication, action: "approve" | "reject") => {
      if (!application.publicId) return;

      setBusyApplicationId(application.publicId);
      const result = await store.reviewSellerApplication(
        application.publicId,
        action,
        action === "reject" ? "Hồ sơ thiếu thông tin." : undefined
      );
      setBusyApplicationId("");

      if (!result.ok) {
        showToast(result.message, "danger");
        return;
      }

      showToast(result.message, "success");
      setApplications((prev) =>
        prev.map((item) =>
          item.publicId === application.publicId
            ? {
                ...item,
                status: result.application.status,
                rejectedReason: result.application.rejectedReason,
                approvedAt: result.application.approvedAt
              }
            : item
        )
      );
    };

    return (
      <Section
        title="Duyệt seller"
        action={
          <Select value={status} onChange={(event) => setStatus(event.target.value as SellerStatus | "")} className="w-44">
            <option value="">Tất cả</option>
            {Object.entries(sellerStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        }
      >
        {loadingApplications ? (
          <Panel>
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold text-muted">Đang tải hồ sơ seller...</p>
            </div>
          </Panel>
        ) : applicationsError ? (
          <ErrorState title="Không tải được hồ sơ seller" description={applicationsError} />
        ) : (
          <DataTable
            columns={["Shop", "Slug", "Status", "Tax", "Bank", "Action"]}
            rows={applications.map((application) => {
              const applicationStatus = application.status ?? "PENDING";
              const busy = busyApplicationId === application.publicId;
              return [
                <a key="shop" className="font-bold text-primary" href={`/admin/sellers/${application.publicId}`}>{application.shopName}</a>,
                application.shopSlug ?? "-",
                <StatusBadge key="st" status={applicationStatus} label={sellerStatusLabel[applicationStatus]} />,
                application.taxCode,
                application.bankName,
                <div key="act" className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy || applicationStatus !== "PENDING"}
                    onClick={() => reviewApplication(application, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy || applicationStatus !== "PENDING"}
                    onClick={() => reviewApplication(application, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              ];
            })}
          />
        )}
      </Section>
    );
  }

  function AdminSellersPageLegacy() {
    const [status, setStatus] = useState("");
    const sellers = store.state.shops.filter((shop) => !status || shop.status === status);
    return (
      <Section title="Duyệt seller" action={<Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-44"><option value="">Tất cả</option>{Object.entries(sellerStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>}>
        <DataTable
          columns={["Shop", "Owner", "Status", "Sold", "Revenue", "Action"]}
          rows={sellers.map((shop) => [
            <a key="shop" className="font-bold text-primary" href={`/admin/sellers/${shop.id}`}>{shop.shopName}</a>,
            store.state.users.find((user) => user.id === shop.userId)?.fullName ?? "-",
            <StatusBadge key="st" status={shop.status} label={sellerStatusLabel[shop.status]} />,
            `${shop.totalSold}`,
            formatVnd(shop.totalRevenue),
            <div key="act" className="flex gap-2"><Button variant="secondary" onClick={() => store.updateSellerStatus(shop.id, "APPROVED")}>Approve</Button><Button variant="danger" onClick={() => store.updateSellerStatus(shop.id, "REJECTED", "Hồ sơ thiếu thông tin.")}>Reject</Button></div>
          ])}
        />
      </Section>
    );
  }

  function AdminSellerDetail({ sellerId }: { sellerId?: string }) {
    const [detail, setDetail] = useState<{ user: typeof store.currentUser; application: SellerApplication } | undefined>();
    const [loadingDetail, setLoadingDetail] = useState(true);
    const [detailError, setDetailError] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [reviewing, setReviewing] = useState(false);

    useEffect(() => {
      let cancelled = false;

      if (!sellerId) {
        setLoadingDetail(false);
        return () => {
          cancelled = true;
        };
      }

      setLoadingDetail(true);
      setDetailError("");

      store.getSellerApplicationDetail(sellerId)
        .then((result) => {
          if (cancelled) return;

          if (!result.ok) {
            setDetailError(result.message);
            return;
          }

          setDetail(result.detail);
          setRejectReason(result.detail.application.rejectedReason ?? "");
        })
        .finally(() => {
          if (!cancelled) setLoadingDetail(false);
        });

      return () => {
        cancelled = true;
      };
    }, [sellerId, store.getSellerApplicationDetail]);

    const reviewApplication = async (action: "approve" | "reject") => {
      if (!sellerId) return;

      setReviewing(true);
      const result = await store.reviewSellerApplication(
        sellerId,
        action,
        action === "reject" ? rejectReason : undefined
      );
      setReviewing(false);

      if (!result.ok) {
        showToast(result.message, "danger");
        return;
      }

      showToast(result.message, "success");
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              application: {
                ...prev.application,
                status: result.application.status,
                rejectedReason: result.application.rejectedReason,
                approvedAt: result.application.approvedAt
              }
            }
          : prev
      );
    };

    if (loadingDetail) {
      return (
        <Section title="Seller detail">
          <Panel>
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold text-muted">Đang tải chi tiết seller...</p>
            </div>
          </Panel>
        </Section>
      );
    }

    if (detailError) {
      return (
        <Section title="Seller detail">
          <ErrorState title="Không tải được chi tiết seller" description={detailError} />
        </Section>
      );
    }

    if (!detail) return <NotFoundPage />;

    const application = detail.application;
    const applicationStatus = application.status ?? "PENDING";

    return (
      <Section title={`Seller ${application.shopName}`}>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel>
            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow label="Status" value={sellerStatusLabel[applicationStatus]} />
              <InfoRow label="Owner" value={detail.user?.fullName ?? "-"} />
              <InfoRow label="Email owner" value={detail.user?.email ?? "-"} />
              <InfoRow label="Phone owner" value={detail.user?.phone ?? "-"} />
              <InfoRow label="Shop email" value={application.email} />
              <InfoRow label="Shop phone" value={application.phone} />
              <InfoRow label="Slug" value={application.shopSlug ?? "-"} />
              <InfoRow label="Tax code" value={application.taxCode} />
              <InfoRow label="Bank" value={application.bankName} />
              <InfoRow label="Bank account" value={application.bankAccountNumber} />
              <InfoRow label="Account name" value={application.bankAccountName} />
              <InfoRow label="Pickup" value={application.pickupAddress} />
              <InfoRow label="Rejected reason" value={application.rejectedReason ?? "Không có"} />
            </div>
          </Panel>
          <Panel className="h-fit">
            <h3 className="font-bold">Review</h3>
            <div className="mt-3 grid gap-3">
              <Field label="Lý do từ chối">
                <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
              </Field>
              <Button disabled={reviewing || applicationStatus !== "PENDING"} onClick={() => reviewApplication("approve")}>
                Approve
              </Button>
              <Button variant="danger" disabled={reviewing || applicationStatus !== "PENDING"} onClick={() => reviewApplication("reject")}>
                Reject
              </Button>
            </div>
          </Panel>
        </div>
      </Section>
    );
  }

  function AdminSellerDetailLegacy({ sellerId }: { sellerId?: string }) {
    const shop = store.state.shops.find((item) => item.id === sellerId);
    if (!shop) return <NotFoundPage />;
    return (
      <Section title={`Seller ${shop.shopName}`}>
        <Panel>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow label="Status" value={sellerStatusLabel[shop.status]} />
            <InfoRow label="Owner" value={store.state.users.find((user) => user.id === shop.userId)?.fullName ?? "-"} />
            <InfoRow label="Sold" value={`${shop.totalSold}`} />
            <InfoRow label="Revenue" value={formatVnd(shop.totalRevenue)} />
            <InfoRow label="Pickup" value={shop.pickupAddress} />
            <InfoRow label="Rejected reason" value={shop.rejectedReason ?? "Không có"} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => store.updateSellerStatus(shop.id, "APPROVED")}>Approve</Button>
            <Button variant="danger" onClick={() => store.updateSellerStatus(shop.id, "REJECTED", "Hồ sơ không hợp lệ.")}>Reject</Button>
            <Button variant="secondary" onClick={() => store.updateSellerStatus(shop.id, "SUSPENDED")}>Suspend</Button>
            <Button variant="ghost" onClick={() => store.updateSellerStatus(shop.id, "CLOSED")}>Close</Button>
          </div>
        </Panel>
      </Section>
    );
  }

  function AdminCategoriesPage() {
    return (
      <Section title="Quản lý categories một cấp">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <DataTable
            columns={["Name", "Slug", "Sort", "Default other"]}
            rows={store.state.categories.map((category) => [category.name, category.slug, `${category.sortOrder}`, category.isDefaultOther ? "Yes" : "No"])}
          />
          <Panel>
            <h3 className="font-bold">Category form</h3>
            <div className="mt-3 grid gap-3">
              <Input placeholder="Tên category" />
              <Input placeholder="Slug" />
              <Input type="number" placeholder="Sort order" />
              <Checkbox label="is_default_other" />
              <Button onClick={() => showToast("Đã lưu category.", "success")}>Lưu</Button>
            </div>
          </Panel>
        </div>
      </Section>
    );
  }

  function AdminProductsPage() {
    return (
      <Section title="Sản phẩm toàn sàn">
        <DataTable
          columns={["Product", "Shop", "Category", "Status", "Sold", "Action"]}
          rows={store.state.products.map((product) => [
            <a key="p" className="font-bold text-primary" href={`/admin/products/${product.id}`}>{product.name}</a>,
            shopById(product.sellerId)?.shopName ?? "-",
            getCategoryNames(store.state.categories, product) || "-",
            <StatusBadge key="st" status={product.status} label={productStatusLabel[product.status]} />,
            `${product.soldCount}`,
            <span key="act" className="text-muted">Chỉ xem</span>
          ])}
        />
      </Section>
    );
  }

  function AdminProductDetail({ productId }: { productId?: string }) {
    const product = store.state.products.find((item) => item.id === productId);
    if (!product) return <NotFoundPage />;
    return (
      <Section title={product.name}>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel>
            <img src={product.thumbnailUrl} alt={product.name} className="aspect-[16/9] w-full rounded-panel object-cover" />
            <p className="mt-3 text-sm leading-6 text-muted">{product.description}</p>
          </Panel>
          <Panel>
            <h3 className="font-bold">Thao tác kiểm duyệt</h3>
            <div className="mt-3 grid gap-2">
              <Button variant="secondary" onClick={() => showToast("Đã ẩn sản phẩm.", "success")}>Ẩn sản phẩm</Button>
              <Button variant="danger" onClick={() => showToast("Đã xóa sản phẩm.", "danger")}>Xóa sản phẩm</Button>
              <Button variant="secondary" onClick={() => showToast("Đã khóa người bán.", "success")}>Khóa người bán</Button>
            </div>
          </Panel>
        </div>
      </Section>
    );
  }

  function AdminStatisticsPage() {
    return (
      <Section title="Statistics">
        <div className="grid gap-4 lg:grid-cols-3">
          <MetricCard label="Revenue toàn sàn" value={formatVnd(store.state.orders.filter((order) => order.orderStatus === "COMPLETED").reduce((sum, order) => sum + order.totalAmount, 0))} />
          <MetricCard label="New users" value={`${store.state.users.length}`} />
          <MetricCard label="New sellers" value={`${store.state.shops.length}`} />
        </div>
      </Section>
    );
  }

  function ViolationReportsPage() {
    const reports = [
      ["VR-001", "Tai nghe bluetooth chống ồn", "Hàng giả", "PENDING"],
      ["VR-002", "Pin dự phòng 10000mAh", "Mô tả sai", "REVIEWING"],
      ["VR-003", "Máy khuếch tán tinh dầu", "Nội dung không phù hợp", "RESOLVED"]
    ];
    return (
      <Section title="Violation reports">
        <DataTable
          columns={["Report", "Product", "Reason", "Status", "Actions"]}
          rows={reports.map((report) => [
            report[0],
            report[1],
            report[2],
            <StatusBadge key="st" status={report[3]} label={report[3]} />,
            <div key="actions" className="flex gap-2"><Button variant="secondary" onClick={() => showToast("Đã xử lý báo cáo.", "success")}>Xử lý</Button><Button variant="ghost" onClick={() => showToast("Đã từ chối báo cáo.", "info")}>Từ chối</Button></div>
          ])}
        />
      </Section>
    );
  }

  function SupportersAdminPage() {
    const supporters = store.state.users.filter((user) => user.roles.includes("SUPPORTER"));
    return (
      <Section title="Supporter accounts">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <DataTable columns={["Name", "Email", "Status"]} rows={supporters.map((user) => [user.fullName, user.email, user.status])} />
          <Panel>
            <h3 className="font-bold">Tạo supporter</h3>
            <div className="mt-3 grid gap-3">
              <Input placeholder="Họ tên" />
              <Input placeholder="Email" />
              <Input placeholder="Phone" />
              <Button onClick={() => showToast("Đã tạo supporter.", "success")}>Tạo</Button>
            </div>
          </Panel>
        </div>
      </Section>
    );
  }

  function AdminChatsPage() {
    return (
      <Section title="Admin xem chat">
        <DataTable
          columns={["Conversation", "Customer", "Supporter", "Status", "Mode"]}
          rows={store.state.conversations.map((conv) => [conv.title, conv.customerName, conv.assignedSupporter, conv.status, conv.mode])}
        />
      </Section>
    );
  }

  function SystemReportsPage() {
    return (
      <Section title="System reports">
        <DataTable
          columns={["Code", "Severity", "Module", "Status"]}
          rows={[
            ["SYS-001", "LOW", "payment", "OPEN"],
            ["SYS-002", "MEDIUM", "image upload", "WATCHING"]
          ]}
        />
      </Section>
    );
  }

  function AiKnowledgePage() {
    return (
      <Section title="AI knowledge/RAG">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <DataTable
            columns={["Document", "Type", "Status", "Chunks", "Updated"]}
            rows={[
              ["Chính sách thanh toán online", "POLICY", "ACTIVE", "12", "29/06/2026"],
              ["FAQ mua hàng nhiều shop", "FAQ", "ACTIVE", "8", "29/06/2026"],
              ["Hướng dẫn bảo hành", "POLICY", "PROCESSING", "0", "29/06/2026"]
            ]}
          />
          <Panel>
            <h3 className="font-bold">Upload knowledge</h3>
            <div className="mt-3 grid gap-3">
              <Input placeholder="Tên tài liệu" />
              <Select><option>POLICY</option><option>FAQ</option><option>PRODUCT_GUIDE</option></Select>
              <Input type="file" />
              <Button onClick={() => showToast("Đã upload knowledge.", "success")}>Upload</Button>
            </div>
          </Panel>
        </div>
      </Section>
    );
  }

  function renderSupporterRoutes() {
    return (
      <DashboardFrame kind="supporter">
        {segments.length === 1 ? <SupporterDashboard /> : null}
        {segments[1] === "conversations" && segments[2] ? <ChatWindow conversationId={segments[2]} /> : null}
        {segments[1] === "conversations" && !segments[2] ? <SupporterConversations /> : null}
      </DashboardFrame>
    );
  }

  function SupporterDashboard() {
    return (
      <Section title="Supporter dashboard">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Assigned conversations" value={`${store.state.conversations.length}`} />
          <MetricCard label="Open" value={`${store.state.conversations.filter((conv) => conv.status === "OPEN").length}`} />
          <MetricCard label="Unread" value={`${store.state.conversations.flatMap((conv) => conv.messages).filter((msg) => !msg.isRead).length}`} />
        </div>
      </Section>
    );
  }

  function SupporterConversations() {
    return (
      <Section title="Conversations được phân">
        <DataTable
          columns={["Title", "Customer", "Mode", "Last message", "Action"]}
          rows={store.state.conversations.map((conv) => [
            conv.title,
            conv.customerName,
            conv.mode,
            formatDate(conv.lastMessageAt),
            <a key="open" className="font-bold text-primary" href={`/supporter/conversations/${conv.id}`}>Mở</a>
          ])}
        />
      </Section>
    );
  }

  function Unauthorized({ title, description }: { title: string; description: string }) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <ErrorState title={title} description={description} action={<Button onClick={() => (window.location.href = "/login")}>Đăng nhập</Button>} />
      </main>
    );
  }

  function NotFoundPage() {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <EmptyState title="Không tìm thấy route" description="Đường dẫn không đúng hoặc không còn tồn tại." action={<Button onClick={() => (window.location.href = "/")}>Về trang chủ</Button>} />
      </main>
    );
  }

  function shopById(id?: string) {
    return store.state.shops.find((shop) => shop.id === id);
  }

  function categoryBySlug(slug?: string) {
    return store.state.categories.find((category) => category.slug === slug);
  }
}
