"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bell, CreditCard, LogOut, Plus, Store, Star, Copy, Check, ExternalLink, RotateCcw, Truck, MapPin, MessageSquare, ShieldCheck, FileText, HelpCircle, Loader2, Package, Headset, LayoutDashboard, User as UserIcon, Mail, Smartphone, X, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { createReviewApi, fetchMyReviewsApi, type UserReviewResponse } from "@/services/review-api";
import { uploadImage } from "@/services/upload-api";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import {
  MetricCard,
  OrderTimeline,
  OrderProgressStepper
} from "@/components/shared/cards";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import {
  formatDate,
  formatVnd,
  getCategoryNames,
  orderStatusLabel,
  paymentStatusLabel,
  orderPaymentMethodLabel,
  roleLabel,
  sellerStatusLabel,
  canCustomerCancel,
  canCustomerConfirmReceipt,
  canSellerCancel,
  canSellerConfirm,
  canSellerShip
} from "@/lib/helpers";
import Unauthorized from "@/components/shared/unauthorized-page";
import type { Address, AddressType, Order, OrderItem, OrderStatus, Product, ProductVariant, Shop } from "@/types/models";

const linkClass =
  "group inline-flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted transition-all duration-300 hover:bg-line/30 hover:text-ink";
const activeLinkClass = "bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary shadow-sm ring-1 ring-primary/20";

export default function AccountPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[] | undefined;
  const currentSection = slug?.[0] ?? "overview";
  const detailId = slug?.[1];

  const store = useMarketplaceStore();
  const { showToast } = store;
  const user = store.getCurrentUser();

  useEffect(() => {
    if (user?.id) {
      store.fetchCustomerOrders("", true);
    }
  }, [user?.id]);

  if (!store.ready) {
    return (
      <main className="px-6 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium text-muted">Đang tải thông tin tài khoản...</p>
      </main>
    );
  }

  if (!user) {
    return <Unauthorized title="Tài khoản cần đăng nhập" description="Vui lòng đăng nhập để xem thông tin cá nhân." />;
  }

  const nav = [
    { key: "overview", href: "/account", label: "Tổng quan", icon: LayoutDashboard },
    { key: "profile", href: "/account/profile", label: "Hồ sơ", icon: UserIcon },
    { key: "security", href: "/account/security", label: "Bảo mật", icon: ShieldCheck },
    { key: "addresses", href: "/account/addresses", label: "Địa chỉ", icon: MapPin },
    { key: "orders", href: "/account/orders", label: "Đơn hàng", icon: Package },
    { key: "notifications", href: "/account/notifications", label: "Thông báo", icon: Bell },
    { key: "reviews", href: "/account/reviews", label: "Đánh giá", icon: Star }
  ];

  const isViewingOrderDetail = currentSection === "orders" && Boolean(detailId);

  const sidebarCollapsed = store.state.sidebarCollapsed;

  return (
    <main
      className={cn(
        "grid gap-6 px-6 pt-4 pb-8 transition-all duration-300",
        isViewingOrderDetail ? "grid-cols-1" : sidebarCollapsed ? "lg:grid-cols-[80px_1fr]" : "lg:grid-cols-[260px_1fr]"
      )}
    >
      {!isViewingOrderDetail && (
        <Panel className="h-fit sticky top-[calc(var(--marketplace-header-offset)+16px)] shadow-soft border-line rounded-2xl flex flex-col items-center">
          <div className={cn("flex w-full items-center gap-4 relative", sidebarCollapsed ? "justify-center" : "justify-start")}>
            <div className="relative shrink-0">
              <img src={user.avatarUrl} alt={user.fullName} className={cn("rounded-full object-cover ring-2 ring-primary/20 shadow-sm transition-all", sidebarCollapsed ? "h-10 w-10" : "h-14 w-14")} />
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"></div>
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink text-base">{user.fullName}</p>
                <p className="text-[11px] font-bold text-primary bg-primary/10 inline-block px-2 py-0.5 rounded uppercase tracking-wider mt-1.5">{roleLabel[store.state.activeRole as keyof typeof roleLabel]}</p>
              </div>
            )}
            <button
              onClick={() => store.toggleSidebar()}
              className={cn("absolute bg-white border border-line shadow-sm rounded-full p-1 text-muted hover:text-primary hover:bg-slate-50 transition-colors z-10", sidebarCollapsed ? "-right-2 -top-2" : "right-0 top-0")}
              title={sidebarCollapsed ? "Mở rộng" : "Thu gọn"}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="mt-6 grid gap-1.5 border-t border-line pt-5 w-full">
            {nav.map(({ key, href, label, icon: Icon }) => (
              <a key={key} href={href} className={cn(linkClass, currentSection === key && activeLinkClass, sidebarCollapsed ? "justify-center px-0" : "px-4")} title={sidebarCollapsed ? label : undefined}>
                <Icon className={cn("h-5 w-5 transition-colors shrink-0", currentSection === key ? "text-primary" : "text-muted group-hover:text-ink")} />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
              </a>
            ))}
          </nav>
        </Panel>
      )}
      <div className="[&>section]:pt-0">
        {currentSection === "overview" ? <AccountOverview /> : null}
        {currentSection === "profile" ? <AccountProfile store={store} showToast={showToast} /> : null}
        {currentSection === "security" ? <AccountSecurity /> : null}
        {currentSection === "addresses" ? <AddressBook store={store} showToast={showToast} /> : null}
        {currentSection === "orders" && detailId ? <OrderDetailPage orderCode={detailId} audience="customer" /> : null}
        {currentSection === "orders" && !detailId ? <OrdersList audience="customer" /> : null}
        {currentSection === "notifications" ? <NotificationsPage /> : null}
        {currentSection === "reviews" ? <ReviewsModule /> : null}
      </div>
    </main>
  );



  function AccountOverview() {
    const userOrders = store.state.orders.filter((order: any) => order.userId === store.getCurrentUser()?.id);
    return (
      <Section title="Tổng quan tài khoản">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="group rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-line relative overflow-hidden">
            <Package className="h-7 w-7 text-ink mb-4 relative z-10 drop-shadow-sm" />
            <p className="text-sm font-bold text-muted relative z-10">Đơn hàng</p>
            <p className="mt-1 text-2xl font-black text-ink relative z-10">{userOrders.length}</p>
          </div>
          <div className="group rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-sky-500/30 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-sky-500/5 transition-transform duration-500 group-hover:scale-150"></div>
            <MapPin className="h-7 w-7 text-sky-500 mb-4 relative z-10 drop-shadow-sm" />
            <p className="text-sm font-bold text-muted relative z-10">Địa chỉ</p>
            <p className="mt-1 text-2xl font-black text-ink relative z-10">{store.state.addresses.filter((item: any) => item.userId === store.getCurrentUser()?.id).length}</p>
          </div>
          <div className="group rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-amber-500/30 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-amber-500/5 transition-transform duration-500 group-hover:scale-150"></div>
            <Mail className="h-7 w-7 text-amber-500 mb-4 relative z-10 drop-shadow-sm" />
            <p className="text-sm font-bold text-muted relative z-10">Email</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 relative z-10">
              <p className={cn("text-[11px] font-bold px-2 py-1 rounded bg-opacity-10 inline-block uppercase tracking-wider", store.getCurrentUser()?.emailVerified ? "bg-emerald-500 text-emerald-700" : "bg-coral text-coral")}>
                {store.getCurrentUser()?.emailVerified ? "Đã xác thực" : "Chưa xác thực"}
              </p>
              {!store.getCurrentUser()?.emailVerified && (
                <a href="/verify-email" className="text-[11px] font-bold text-white bg-coral hover:bg-coral/90 px-3 py-1 rounded shadow-sm transition-colors uppercase tracking-wider">
                  Xác thực ngay
                </a>
              )}
            </div>
          </div>
          <div className="group rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-line relative overflow-hidden">
            <Smartphone className="h-7 w-7 text-ink mb-4 relative z-10 drop-shadow-sm" />
            <p className="text-sm font-bold text-muted relative z-10">Số điện thoại</p>
            <p className={cn("mt-2 text-[11px] font-bold px-2 py-1 rounded bg-opacity-10 inline-block relative z-10 uppercase tracking-wider", store.getCurrentUser()?.phoneVerified ? "bg-emerald-500 text-emerald-700" : "bg-coral text-coral")}>
              {store.getCurrentUser()?.phoneVerified ? "Đã xác thực" : "Chưa xác thực"}
            </p>
          </div>
        </div>
      </Section>
    );
  }

  function AccountSecurity() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [formErrors, setFormErrors] = useState<any>({});
    const [submitting, setSubmitting] = useState(false);

    const validateChangePasswordForm = () => {
      const nextErrors: any = {};

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
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel className="rounded-2xl border border-line shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-ink text-base">Đổi mật khẩu</h3>
            </div>
            <div className="grid gap-4">
              {/* Fake hidden inputs to stop Chrome autofill */}
              <input type="text" name="fakeusernameremembered" style={{ display: 'none' }} autoComplete="username" />
              <input type="password" name="fakepasswordremembered" style={{ display: 'none' }} autoComplete="current-password" />

              <Field label="Mật khẩu hiện tại" hint={formErrors.currentPassword ? <span className="text-coral text-xs font-semibold">{formErrors.currentPassword}</span> : null}>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  autoComplete="current-password"
                  className={cn("bg-canvas/50 border-line focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all rounded-xl", formErrors.currentPassword && "border-coral focus:border-coral focus:ring-coral/10")}
                />
              </Field>
              <Field label="Mật khẩu mới" hint={formErrors.newPassword ? <span className="text-coral text-xs font-semibold">{formErrors.newPassword}</span> : null}>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  autoComplete="new-password"
                  className={cn("bg-canvas/50 border-line focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all rounded-xl", formErrors.newPassword && "border-coral focus:border-coral focus:ring-coral/10")}
                />
              </Field>
              <Field label="Nhập lại mật khẩu" hint={formErrors.confirmPassword ? <span className="text-coral text-xs font-semibold">{formErrors.confirmPassword}</span> : null}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  className={cn("bg-canvas/50 border-line focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all rounded-xl", formErrors.confirmPassword && "border-coral focus:border-coral focus:ring-coral/10")}
                />
              </Field>
              <Button disabled={submitting} onClick={submitChangePassword} className="mt-2 w-full sm:w-auto h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-sm">
                {submitting ? "Đang xử lý..." : "Đổi mật khẩu"}
              </Button>
            </div>
          </Panel>
          <Panel className="rounded-2xl border border-line shadow-sm p-6 h-fit">
            <div className="flex items-center gap-2 mb-2">
              <LogOut className="h-5 w-5 text-coral" />
              <h3 className="font-bold text-ink text-base">Phiên đăng nhập</h3>
            </div>
            <p className="text-sm text-muted font-medium mb-5">Quản lý và đăng xuất khỏi các thiết bị khác để bảo vệ tài khoản.</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={store.logout} className="rounded-xl font-bold border-line text-ink hover:bg-line/30 h-10">Đăng xuất thiết bị này</Button>
              <Button variant="danger" onClick={submitLogoutAll} className="rounded-xl font-bold bg-coral text-white hover:bg-coral/90 transition-colors h-10 shadow-sm">Đăng xuất tất cả</Button>
            </div>
          </Panel>
        </div>
      </Section>
    );
  }


  function CustomerOrderCard({ order, shopName, actionNode }: { order: Order; shopName: string; actionNode: React.ReactNode }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const firstItem = order.items?.[0];
    const hasMore = (order.items?.length || 0) > 1;

    const handleChat = (e: React.MouseEvent) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('open-chat-widget', {
        detail: {
          shopId: (order as any).shopDbId || (order as any).sellerId || (order as any).shopId,
          shopInfo: { id: (order as any).shopDbId || (order as any).sellerId || (order as any).shopId, name: shopName, avatar: null, shop_slug: (order as any).shopSlug },
          orderDraft: order
        }
      }));
    };

    return (
      <div className="border-b-[8px] border-slate-100 last:border-b-0 p-5 hover:bg-slate-50/50 transition-colors">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-ink text-sm sm:text-base">{shopName}</span>
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary" 
                className="h-7 text-xs px-2.5 rounded-lg border-line text-ink hover:bg-line/30 gap-1.5"
                onClick={() => window.location.href = `/shops/${order.shopSlug || order.sellerId}`}
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xem shop</span>
              </Button>
              <Button 
                variant="secondary"
                className="h-7 text-xs px-2.5 rounded-lg border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 gap-1.5"
                onClick={handleChat}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat ngay</span>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />
          </div>
        </div>

        <div 
          className="cursor-pointer group"
          onClick={() => window.location.href = `/account/orders/${order.orderCode}`}
        >
          {firstItem && (
            <div className="flex items-start gap-4">
            <img src={firstItem.productImageSnapshot || "/images/placeholder.webp"} alt={firstItem.productNameSnapshot} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border border-line" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-ink line-clamp-2 text-sm sm:text-base">{firstItem.productNameSnapshot}</h4>
              <p className="text-sm text-muted mt-1">{firstItem.variantNameSnapshot}</p>
              <div className="text-sm font-medium mt-1">x{firstItem.quantity}</div>
            </div>
            <div className="flex flex-col items-end whitespace-nowrap">
              {firstItem.originalPriceSnapshot && firstItem.originalPriceSnapshot > firstItem.unitPrice && (
                <span className="text-xs sm:text-sm text-muted line-through mb-0.5">
                  {formatVnd(firstItem.originalPriceSnapshot)}
                </span>
              )}
              <span className="font-bold text-ink text-sm sm:text-base">
                {formatVnd(firstItem.unitPrice)}
              </span>
            </div>
          </div>
        )}

        {hasMore && (
          <div className="mt-4">
            {isExpanded ? (
              <div className="space-y-4 border-t border-line/50 pt-4 mt-4">
                {order.items.slice(1).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-4 ml-4 sm:ml-8">
                    <img src={item.productImageSnapshot || "/images/placeholder.webp"} alt={item.productNameSnapshot} className="w-16 h-16 object-cover rounded-lg border border-line opacity-90" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-ink line-clamp-2 text-sm">{item.productNameSnapshot}</h4>
                      <p className="text-xs text-muted mt-0.5">{item.variantNameSnapshot}</p>
                      <div className="text-xs font-medium mt-0.5">x{item.quantity}</div>
                    </div>
                    <div className="flex flex-col items-end whitespace-nowrap">
                      {item.originalPriceSnapshot && item.originalPriceSnapshot > item.unitPrice && (
                        <span className="text-xs text-muted line-through mb-0.5">
                          {formatVnd(item.originalPriceSnapshot)}
                        </span>
                      )}
                      <span className="font-semibold text-ink text-sm">
                        {formatVnd(item.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  className="w-full text-center text-sm font-medium text-muted hover:text-primary transition-colors py-2"
                >
                  Thu gọn
                </button>
              </div>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                className="w-full text-center text-sm font-medium text-muted hover:text-primary transition-colors border-t border-line/50 pt-3 mt-3"
              >
                Xem thêm {order.items.length - 1} sản phẩm khác
              </button>
            )}
          </div>
        )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 border-t border-line pt-4 mt-4">
          <div className="text-sm text-muted hidden sm:block">
            Mã đơn: <a className="font-bold text-primary hover:underline" href={`/account/orders/${order.orderCode}`}>{order.orderCode}</a>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink">Thành tiền:</span>
              <span className="text-lg font-black text-primary">{formatVnd(order.totalAmount)}</span>
            </div>
            {actionNode && (
              <div className="flex items-center gap-2">
                {actionNode}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function OrdersList({ audience }: { audience: "customer" | "seller" }) {
    const [status, setStatus] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [visibleCount, setVisibleCount] = useState(5);
    const ITEMS_PER_PAGE = 20;
    
    useEffect(() => {
      if (audience === "seller") {
        store.fetchSellerOrders(status as OrderStatus | "");
      } else {
        store.fetchCustomerOrders(status as OrderStatus | "");
      }
      setCurrentPage(1);
      setVisibleCount(5);
    }, [audience, status]);

    const orders = store.state.orders.filter((order: any) => {
      const belongs = audience === "customer" ? order.userId === store.getCurrentUser()?.id : order.sellerId === store.getCurrentShop()?.id;
      return belongs && (!status || order.orderStatus === status);
    });

    const findPaymentForOrder = (orderCode: string) =>
      store.state.payments.find((payment) => payment.orderCodes.includes(orderCode));

    const canContinuePayment = (order: Order) =>
      order.orderStatus !== "CANCELLED" && (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED");

    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && visibleCount < orders.length) {
          setVisibleCount(prev => prev + 5);
        }
      });
      if (node) observer.current.observe(node);
    }, [visibleCount, orders.length]);

    const goToPaymentForOrder = async (order: Order) => {
      const payment = findPaymentForOrder(order.orderCode);
      if (payment) {
        window.location.href = `/payment/${payment.paymentCode}`;
        return;
      }
      const method = order.preferredPaymentMethod ?? store.state.lastCheckoutPaymentMethod ?? "MOCK";
      const result = await store.createCheckoutPayment([order.orderCode], method);
      if (!result.ok) {
        showToast(result.message || "Không thể tạo giao dịch thanh toán.", "danger");
        return;
      }
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      window.location.href = `/payment/${result.paymentCode}`;
    };

    const shopById = (id?: string) => {
      return store.state.shops.find((shop) => shop.id === id);
    };

    const getShopName = (order: Order) => {
      return order.shopName || shopById(order.sellerId)?.shopName || order.items?.[0]?.sellerNameSnapshot || "-";
    };

    const renderOrderAction = (order: Order) => {
      if (audience !== "customer") {
        const showConfirm = canSellerConfirm(order);
        const showShip = canSellerShip(order);
        const showCancel = canSellerCancel(order);

        if (!showConfirm && !showShip && !showCancel) return <span className="text-muted font-medium text-sm">Theo dõi</span>;

        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            {showConfirm ? <Button className="text-xs h-8 px-3 rounded-lg font-bold shadow-sm bg-primary text-white hover:bg-primary/90" onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Xác nhận</Button> : null}
            {showShip ? <Button variant="secondary" className="text-xs h-8 px-3 rounded-lg font-bold border-line text-ink hover:bg-line/30" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã chuyển shipping.", "success"); else showToast(res.message || "Lỗi chuyển shipping", "danger"); })}>Giao hàng</Button> : null}
            {showCancel ? <Button variant="danger" className="text-xs h-8 px-3 rounded-lg font-bold bg-coral text-white hover:bg-coral/90 shadow-sm transition-colors" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })}>Từ chối</Button> : null}
          </div>
        );
      }

      const showPayment = canContinuePayment(order);
      const showCancel = canCustomerCancel(order);
      const showReceipt = canCustomerConfirmReceipt(order);
      if (!showPayment && !showCancel && !showReceipt) return <span className="text-muted font-medium text-sm">Theo dõi</span>;

      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          {showCancel ? <Button variant="danger" className="text-xs h-8 px-3 rounded-lg font-bold bg-coral text-white hover:bg-coral/90 shadow-sm transition-colors" onClick={() => store.cancelCustomerOrder(order.orderCode).then((res) => { if (res.ok) showToast("Đã hủy đơn hàng.", "success"); else showToast(res.message || "Lỗi hủy đơn", "danger"); })}>Hủy</Button> : null}
          {showPayment ? (
            <Button className="text-xs h-8 px-3 rounded-lg font-bold shadow-sm bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5" onClick={() => goToPaymentForOrder(order)}>
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              Thanh toán
            </Button>
          ) : null}
          {showReceipt ? <Button variant="secondary" className="text-xs h-8 px-3 rounded-lg font-bold border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={() => store.confirmCustomerReceipt(order.orderCode).then((res) => { if (res.ok) showToast("Đã xác nhận nhận hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Đã nhận hàng</Button> : null}
        </div>
      );
    };

    const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
    const paginatedOrders = orders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
      <Section
        title={audience === "customer" ? "Đơn hàng của tôi" : "Đơn hàng shop"}
        action={
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-48 bg-canvas/50 border-line focus:bg-white rounded-xl h-10 text-sm font-semibold text-ink">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(orderStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        }
      >
        <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden flex flex-col">
          {audience === "customer" ? (
            <div className="flex flex-col">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-muted">Chưa có đơn hàng nào.</div>
              ) : (
                <>
                  {orders.slice(0, visibleCount).map((order) => (
                    <CustomerOrderCard 
                      key={order.id}
                      order={order}
                      shopName={getShopName(order)}
                      actionNode={renderOrderAction(order)}
                    />
                  ))}
                  {visibleCount < orders.length && (
                    <div ref={lastElementRef} className="py-8 flex flex-col justify-center items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-muted" />
                      <span className="text-xs font-medium text-muted">Đang tải thêm...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <DataTable
              columns={["Mã đơn", "Shop", "Trạng thái", "Thanh toán", "Tổng", "Hành động"]}
              rows={paginatedOrders.map((order) => [
                <a key="code" className="font-bold text-primary hover:underline hover:text-primary/80 transition-colors" href={`/seller/orders/${order.orderCode}`}>{order.orderCode}</a>,
                <span key="shop" className="font-medium text-ink">{getShopName(order)}</span>,
                <StatusBadge key="st" status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />,
                <StatusBadge key="pay" status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />,
                <span key="total" className="font-bold text-ink">{formatVnd(order.totalAmount)}</span>,
                renderOrderAction(order)
              ])}
            />
          )}
          {audience === "seller" && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-6 py-4 bg-white mt-auto">
              <span className="text-sm text-muted font-medium">
                Hiển thị {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, orders.length)} trên tổng số {orders.length} đơn hàng
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="secondary" 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="h-9 px-3 rounded-xl border-line hover:bg-line/30 text-ink font-bold disabled:opacity-50"
                >
                  Trước
                </Button>
                <div className="flex items-center gap-1 hidden sm:flex">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "h-9 w-9 rounded-xl text-sm font-bold transition-colors flex items-center justify-center",
                        currentPage === page 
                          ? "bg-primary text-white shadow-sm" 
                          : "text-ink hover:bg-canvas"
                      )}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <Button 
                  variant="secondary" 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="h-9 px-3 rounded-xl border-line hover:bg-line/30 text-ink font-bold disabled:opacity-50"
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      </Section>
    );
  }

  function OrderDetailPage({ orderCode, audience }: { orderCode?: string; audience: "customer" | "seller" }) {
    const order = store.state.orders.find((item) => (audience === "customer" ? item.orderCode === orderCode : item.id === orderCode || item.orderCode === orderCode));
    const [reviewingItem, setReviewingItem] = useState<OrderItem | null>(null);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [reviewedItemIds, setReviewedItemIds] = useState<Record<string, boolean>>({});
    const [submittingReview, setSubmittingReview] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);
    
    useEffect(() => {
      const needsFetch = !order || !order.shipment || order.shipment.receiverName === "-";
      if (orderCode && needsFetch) {
        if (audience === "customer") {
          store.fetchCustomerOrderDetail(orderCode);
        } else {
          store.fetchSellerOrderDetail(orderCode);
        }
      }
    }, [orderCode, audience, order]);

    if (!order) return <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>;

    const shopById = (id?: string) => {
      return store.state.shops.find((shop) => shop.id === id);
    };

    const findPaymentForOrder = (orderCode: string) =>
      store.state.payments.find((payment) => payment.orderCodes.includes(orderCode));

    const canContinuePayment = (order: Order) =>
      order.orderStatus !== "CANCELLED" && (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED");

    const goToPaymentForOrder = async (order: Order) => {
      const payment = findPaymentForOrder(order.orderCode);
      if (payment) {
        window.location.href = `/payment/${payment.paymentCode}`;
        return;
      }
      const method = order.preferredPaymentMethod ?? store.state.lastCheckoutPaymentMethod ?? "MOCK";
      const result = await store.createCheckoutPayment([order.orderCode], method);
      if (!result.ok) {
        showToast(result.message || "Không thể tạo giao dịch thanh toán.", "danger");
        return;
      }
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      window.location.href = `/payment/${result.paymentCode}`;
    };

    const handleCopy = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      showToast(`Đã sao chép ${label}!`, "success");
    };

    const handleReorder = async () => {
      let count = 0;
      for (const item of order.items) {
        if (item.variantId) {
          await store.addToCart(item.variantId, item.quantity);
          count++;
        }
      }
      if (count > 0) {
        showToast(`Đã thêm ${count} sản phẩm vào giỏ hàng!`, "success");
        router.push("/cart");
      } else {
        showToast("Không thể tự động thêm sản phẩm vào giỏ.", "danger");
      }
    };

    const handleReviewSubmit = async () => {
      if (!reviewingItem) return;
      setSubmittingReview(true);
      try {
        await createReviewApi({
          order_item_id: Number(reviewingItem.id),
          rating,
          comment: comment.trim() || undefined,
          images: images
        });
        showToast("Đã gửi đánh giá thành công!", "success");
        reviewingItem.isReviewed = true;
        setReviewedItemIds((prev) => ({ ...prev, [reviewingItem.id]: true }));
        setReviewingItem(null);
        setRating(5);
        setComment("");
        setImages([]);
      } catch (err: any) {
        showToast(err?.message || "Lỗi khi gửi đánh giá.", "danger");
      } finally {
        setSubmittingReview(false);
      }
    };

    const shop = shopById(order.sellerId);
    const shopName = order.shopName || shop?.shopName || order.items?.[0]?.sellerNameSnapshot || "Shop";
    const shopSlug = order.shopSlug || shop?.shopSlug || "shop";
    const trackingCode = order.shipment?.trackingCode || "N/A";

    return (
      <Section title={`Chi tiết đơn hàng`}>
        {audience === "customer" && (
          <div className="mb-4">
            <a
              href="/account/orders"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-muted/70" />
              Quay lại danh sách đơn hàng
            </a>
          </div>
        )}
        <div className="space-y-6">
          {/* HEADER SUMMARY PANEL */}
          <Panel className="rounded-2xl border border-line shadow-sm p-6 bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Package className="h-32 w-32" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-ink">Đơn hàng #{order.orderCode}</h2>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.orderCode, "mã đơn hàng")}
                    className="p-1 text-muted hover:text-primary transition"
                    title="Sao chép mã đơn"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted mt-1.5">
                  Ngày đặt: <span className="font-semibold text-ink">{formatDate(order.createdAt)}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />
                <StatusBadge status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />
                {audience === "customer" && (
                  <Button
                    variant="secondary"
                    className="text-xs py-1.5 px-3 h-auto gap-1 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 font-bold shadow-sm"
                    onClick={handleReorder}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Mua lại đơn này
                  </Button>
                )}
              </div>
            </div>

            {/* VISUAL STEPPER TRACK */}
            <div className="mt-6 border-t border-line pt-6">
              <OrderProgressStepper order={order} />
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* LEFT MAIN COLUMN */}
            <div className="space-y-6 min-w-0">
              {/* SHOP BANNER CARD */}
              <Panel className="rounded-2xl border border-line shadow-sm p-6 overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shadow-sm">
                      <Store className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-ink text-base">{shopName}</h3>
                      <p className="text-xs font-medium text-muted">Người bán chính thức</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/shops/${shopSlug}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-canvas transition-colors shadow-sm"
                    >
                      <Store className="h-4 w-4 text-muted" />
                      Ghé Shop
                    </a>
                  </div>
                </div>

                {order.customerNote && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-ink border border-amber-200/50 shadow-sm">
                    <MessageSquare className="h-5 w-5 mt-0.5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1 break-all">
                      <span className="font-bold text-amber-800">Ghi chú của bạn: </span>
                      {order.customerNote}
                    </div>
                  </div>
                )}

                {/* ITEMS LIST */}
                <div className="mt-4 space-y-4">
                  {(() => {
                    const productReviewState = new Map<string, { hasReviewed: boolean; firstItemId: string }>();
                    order.items.forEach(item => {
                      const pid = item.productId || item.productNameSnapshot;
                      if (!productReviewState.has(pid)) {
                        productReviewState.set(pid, { hasReviewed: false, firstItemId: item.id });
                      }
                      if (item.isReviewed || reviewedItemIds[item.id]) {
                        productReviewState.get(pid)!.hasReviewed = true;
                      }
                    });

                    return order.items.map((item) => {
                      const targetProd = store.state.products.find((p) => p.id === item.productId || p.name === item.productNameSnapshot);
                      const prodSlug = targetProd?.slug || item.productId || "product";
                      const prodUrl = `/shops/${shopSlug}/products/${prodSlug}`;

                      return (
                        <div key={item.id} className="flex flex-col sm:flex-row gap-4 border-b border-line pb-5 last:border-b-0 last:pb-0 sm:items-center">
                          <a href={prodUrl} className="block shrink-0 overflow-hidden rounded-xl border border-line bg-canvas/50">
                            <img src={item.productImageSnapshot} alt={item.productNameSnapshot} className="h-24 w-24 rounded-xl object-cover transition-transform hover:scale-105" />
                          </a>

                          <div className="min-w-0 flex-1">
                            <a href={prodUrl} className="font-bold text-ink text-base hover:text-primary transition-colors line-clamp-2">
                              {item.productNameSnapshot}
                            </a>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span className="rounded bg-canvas px-2 py-0.5 font-bold border border-line">Phân loại: {item.variantNameSnapshot}</span>
                            </div>
                            <p className="mt-2 text-sm text-muted">
                              Số lượng: <span className="font-bold text-ink">x{item.quantity}</span> × {formatVnd(item.unitPrice)}
                            </p>
                          </div>

                          <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                            <p className="font-black text-primary text-lg">{formatVnd(item.subtotal)}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {audience === "customer" && item.variantId && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await store.addToCart(item.variantId!, item.quantity);
                                    showToast("Đã thêm vào giỏ hàng!", "success");
                                  }}
                                  className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
                                >
                                  Mua lại
                                </button>
                              )}
                              {order.orderStatus === "COMPLETED" && audience === "customer" && (() => {
                                const pid = item.productId || item.productNameSnapshot;
                                const pState = productReviewState.get(pid);
                                if (pState?.firstItemId !== item.id) return null;

                                if (pState.hasReviewed) {
                                  return <span className="text-[11px] font-bold text-primary">Đã đánh giá</span>;
                                }
                                return (
                                  <Button
                                    variant="secondary"
                                    className="text-xs py-1 px-2.5 h-auto font-bold text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 shadow-sm"
                                    onClick={() => {
                                      setReviewingItem(item);
                                      setRating(5);
                                      setComment("");
                                    }}
                                  >
                                    <Star className="h-3.5 w-3.5 fill-[#facc15] text-[#facc15]" />
                                    Đánh giá
                                  </Button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Panel>
            </div>

            {/* RIGHT SIDEBAR COLUMN */}
            <div className="space-y-6">
              {/* PAYMENT & FINANCIAL BREAKDOWN */}
              <Panel className="rounded-2xl border border-line shadow-sm p-6 h-fit">
                <div className="flex items-center gap-2 border-b border-line pb-4 mb-4">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-ink text-base">Chi tiết thanh toán</h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between text-muted">
                    <span>Phương thức</span>
                    <span className="font-bold text-ink">
                      {orderPaymentMethodLabel(order, findPaymentForOrder(order.orderCode))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-muted">
                    <span>Trạng thái thanh toán</span>
                    <StatusBadge
                      className="shrink-0"
                      status={order.paymentStatus}
                      label={paymentStatusLabel[order.paymentStatus]}
                    />
                  </div>
                  {(() => {
                    const payment = findPaymentForOrder(order.orderCode);
                    const paymentTime = payment?.paidAt
                      ? formatDate(payment.paidAt)
                      : payment?.createdAt
                      ? formatDate(payment.createdAt)
                      : order.paymentStatus === "PAID"
                      ? formatDate(order.createdAt)
                      : null;
                    return paymentTime ? (
                      <div className="flex items-center justify-between text-muted">
                        <span>Thời gian thanh toán</span>
                        <span className="font-bold text-ink">{paymentTime}</span>
                      </div>
                    ) : null;
                  })()}

                  <div className="border-t border-line pt-3 space-y-2.5">
                    <div className="flex items-center justify-between text-muted">
                      <span>Tổng tiền hàng</span>
                      <span className="font-bold text-ink">{formatVnd(order.subtotalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted">
                      <span>Phí vận chuyển</span>
                      <span className="font-bold text-ink">{formatVnd(order.shippingFee)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted">
                      <span>Giảm giá Shop</span>
                      <span className="font-bold text-primary">-0đ</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-3 mt-1">
                      <span className="font-black text-ink text-base">Tổng thanh toán</span>
                      <span className="font-black text-primary text-lg">{formatVnd(order.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* CUSTOMER ACTION CENTER */}
                {audience === "customer" && (canContinuePayment(order) || canCustomerCancel(order) || canCustomerConfirmReceipt(order)) ? (
                  <div className="mt-5 grid gap-2 border-t border-line pt-5">
                    {canContinuePayment(order) ? (
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-xl shadow-sm" onClick={() => goToPaymentForOrder(order)}>
                        <CreditCard className="h-4 w-4" aria-hidden="true" />
                        Thanh toán ngay
                      </Button>
                    ) : null}
                    {canCustomerConfirmReceipt(order) ? (
                      <Button variant="secondary" className="w-full border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 font-bold h-11 rounded-xl shadow-sm" onClick={() => store.confirmCustomerReceipt(order.orderCode).then((res) => { if (res.ok) showToast("Đã xác nhận nhận hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>
                        <Check className="h-4 w-4" />
                        Đã nhận hàng
                      </Button>
                    ) : null}
                    {canCustomerCancel(order) ? (
                      <Button variant="danger" className="w-full bg-coral hover:bg-coral/90 text-white font-bold h-11 rounded-xl shadow-sm transition-colors" onClick={() => store.cancelCustomerOrder(order.orderCode).then((res) => { if (res.ok) showToast("Đã hủy đơn hàng.", "success"); else showToast(res.message || "Lỗi hủy đơn", "danger"); })}>
                        Hủy đơn hàng
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {/* SELLER ACTION CENTER */}
                {audience === "seller" && (canSellerConfirm(order) || canSellerShip(order) || canSellerCancel(order)) ? (
                  <div className="mt-5 grid gap-2 border-t border-line pt-5">
                    {canSellerConfirm(order) ? (
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-xl shadow-sm" onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Xác nhận đơn</Button>
                    ) : null}
                    {canSellerShip(order) ? (
                      <Button variant="secondary" className="w-full h-11 rounded-xl font-bold border-line hover:bg-line/30" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã chuyển shipping.", "success"); else showToast(res.message || "Lỗi chuyển shipping", "danger"); })}>Chuyển shipping</Button>
                    ) : null}
                    {canSellerCancel(order) ? (
                      <Button variant="danger" className="w-full bg-coral hover:bg-coral/90 text-white font-bold h-11 rounded-xl shadow-sm transition-colors" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })}>Từ chối đơn</Button>
                    ) : null}
                  </div>
                ) : null}
              </Panel>

              {/* RECIPIENT & SHIPMENT INFO */}
              <Panel className="rounded-2xl border border-line shadow-sm p-6">
                <div className="flex items-center gap-2 border-b border-line pb-4 mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-ink text-base">Địa chỉ nhận hàng</h3>
                </div>
                <div className="space-y-2 text-sm leading-relaxed text-muted">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink text-base">{order.shipment.receiverName}</span>
                    <span className="rounded bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary border border-primary/20">
                      {order.shipment.addressType === "OFFICE" ? "VĂN PHÒNG" : "NHÀ RIÊNG"}
                    </span>
                  </div>
                  <p className="font-bold text-ink">{order.shipment.receiverPhone}</p>
                  <p className="text-muted font-medium">
                    {order.shipment.detailAddress}, {order.shipment.ward}, {order.shipment.district}, {order.shipment.province}
                  </p>
                </div>

                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs font-bold text-muted/70 uppercase tracking-wider">Đơn vị vận chuyển</p>
                  <p className="mt-1 text-sm font-bold text-ink">{order.shipment.shippingProviderName || "Standard Express"}</p>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-canvas p-3 border border-line">
                    <span className="font-mono font-bold text-ink text-sm">{trackingCode}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(trackingCode, "mã vận đơn")}
                      className="text-primary hover:text-primary/80 font-bold text-xs"
                    >
                      Sao chép
                    </button>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>

        {/* Review Modal */}
        {reviewingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900">Đánh giá sản phẩm</h3>
              <p className="mt-1 text-xs text-slate-500 line-clamp-1">{reviewingItem.productNameSnapshot}</p>
              
              <div className="mt-4 flex items-center justify-center gap-2 py-2 bg-slate-50 rounded-xl">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 text-yellow-400 transition hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className="h-8 w-8"
                      fill={star <= rating ? "#facc15" : "none"}
                      stroke="#facc15"
                    />
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <Textarea
                  placeholder="Chia sẻ nhận xét chi tiết về chất lượng sản phẩm, dịch vụ giao hàng..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[110px] text-xs"
                />
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Thêm hình ảnh (Tối đa 4 ảnh)</p>
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative h-16 w-16 rounded-md border border-slate-200 overflow-hidden">
                      <img src={img} alt="review image" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                        title="Xóa ảnh"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  
                  {images.length < 4 && (
                    <div className="relative h-16 w-16 border border-dashed border-slate-300 rounded-md flex items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors bg-slate-50 cursor-pointer group" title="Tải ảnh lên">
                       {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                       <input 
                         type="file" 
                         accept="image/*" 
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                         disabled={uploadingImage}
                         onChange={async (e) => {
                           const file = e.target.files?.[0];
                           if (!file) return;
                           setUploadingImage(true);
                           const formData = new FormData();
                           formData.append("file", file);
                           try {
                             const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                             const res = await fetch(`${baseUrl}/api/upload/image`, {
                               method: "POST",
                               body: formData,
                               credentials: "include"
                             });
                             if (res.ok) {
                               const data = await res.json();
                               if (data.url) setImages(prev => [...prev, data.url]);
                             } else {
                               throw new Error("Lỗi tải ảnh");
                             }
                           } catch (err) {
                             console.error(err);
                           } finally {
                             setUploadingImage(false);
                             e.target.value = "";
                           }
                         }}
                       />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={submittingReview}
                  onClick={() => setReviewingItem(null)}
                >
                  Hủy
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  disabled={submittingReview}
                  onClick={handleReviewSubmit}
                >
                  {submittingReview ? "Đang gửi..." : "Gửi đánh giá"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Section>
    );
  }

}

function NotificationsPage() {
  const store = useMarketplaceStore();
  const showToast = store.showToast;
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { apiFetch } = await import("@/services/api");
      const data = await apiFetch<any[]>('/notifications');
      setNotifications(data || []);
    } catch (e) {
      console.error("Lỗi lấy danh sách thông báo:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    let isMounted = true;
    let eventSource: EventSource | null = null;
    
    const initSSE = async () => {
      try {
        const { getApiBaseUrl } = await import("@/services/api");
        const baseUrl = getApiBaseUrl();
        // Cần đảm bảo component còn mounted trước khi mở SSE
        if (!isMounted) return;
        eventSource = new EventSource(`${baseUrl}/notifications/stream`, {
          withCredentials: true,
        });

        eventSource.onmessage = (event) => {
          if (isMounted) {
            try {
              const newNotif = JSON.parse(event.data);
              setNotifications((prev) => {
                if (prev.find(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
              });
            } catch (e) {}
          }
        };

        eventSource.onerror = (error) => {
          eventSource?.close();
        };
      } catch (e) {
        console.error("SSE init error:", e);
      }
    };

    initSSE();

    const handleRead = (e: CustomEvent) => {
      const { id } = e.detail;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    };
    const handleReadAll = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    };

    window.addEventListener('notification-read', handleRead as EventListener);
    window.addEventListener('notification-read-all', handleReadAll);

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      window.removeEventListener('notification-read', handleRead as EventListener);
      window.removeEventListener('notification-read-all', handleReadAll);
    };
  }, []);

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    try {
      const { apiFetch } = await import("@/services/api");
      await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      window.dispatchEvent(new CustomEvent('notification-read', { detail: { id } }));
      window.dispatchEvent(new CustomEvent('chat-unread-decrement')); // Generic decrement if it was chat
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { apiFetch } = await import("@/services/api");
      await apiFetch(`/notifications/read-all`, { method: "PUT" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      window.dispatchEvent(new CustomEvent('notification-read-all'));
      window.dispatchEvent(new CustomEvent('chat-unread-clear'));
      showToast("Đã đánh dấu tất cả là đã đọc", "success");
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Section title="Thông báo">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          Bạn có <span className="font-bold text-primary">{unreadCount}</span> thông báo chưa đọc
        </p>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={markAllAsRead} className="h-8 text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 font-bold rounded-lg shadow-sm">
            <Check className="mr-1.5 h-3.5 w-3.5" /> Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center"><span className="loading loading-spinner text-primary"></span></div>
        ) : notifications.length > 0 ? (
          notifications.map((notif) => {
            const notifType = (notif.action_url?.startsWith('/support') || notif.action_url?.startsWith('/chat')) ? 'support' : notif.type?.toLowerCase();
            return (
            <Panel key={notif.id} className={cn("rounded-2xl border border-line shadow-sm p-5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30", notif.is_read ? "bg-primary/5 border-primary/20" : "bg-white")}>
              <div className="flex items-start gap-4">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm", notifType === 'order' ? 'bg-primary/10 text-primary' : notifType === 'system' ? 'bg-coral/10 text-coral' : notifType === 'support' ? 'bg-sky/10 text-sky' : 'bg-canvas border border-line text-muted')}>
                  {notifType === 'order' ? <Package className="h-6 w-6" /> : notifType === 'system' ? <ShieldCheck className="h-6 w-6" /> : notifType === 'support' ? <Headset className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <a href={notif.action_url || "#"} onClick={(e) => { if (!notif.is_read) markAsRead(notif.id, e); }} className="block w-full">
                      <p className={cn("font-bold text-base hover:text-primary transition-colors", !notif.is_read ? "text-ink" : "text-muted")}>
                        {notif.title}
                      </p>
                      <p className={cn("mt-1.5 text-sm", !notif.is_read ? "text-ink font-medium" : "text-muted")}>
                        {notif.content}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-muted/70">
                        {formatDate(notif.created_at)}
                      </p>
                    </a>
                    {!notif.is_read && (
                      <div className="shrink-0 mt-1">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.5)]"></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
            );
          })
        ) : (
          <EmptyState title="Chưa có thông báo" description="Bạn không có thông báo nào vào lúc này." />
        )}
      </div>
    </Section>
  );
}

function ReviewsModule() {
  const store = useMarketplaceStore();
  const [reviews, setReviews] = useState<UserReviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    let isMounted = true;
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const res = await fetchMyReviewsApi(page, ITEMS_PER_PAGE);
        if (isMounted && res) {
          setReviews(res.items || []);
          setTotal(res.total || 0);
          setTotalPages(Math.ceil((res.total || 0) / ITEMS_PER_PAGE) || 1);
        }
      } catch (err: any) {
        store.showToast(err?.message || "Lỗi tải đánh giá.", "danger");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchReviews();
    return () => { isMounted = false; };
  }, [page]);

  return (
    <Section title="Đánh giá của tôi">
      <Panel className="rounded-2xl border border-line shadow-sm overflow-hidden flex flex-col bg-white">
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4 text-primary">
              <Star className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-ink">Chưa có đánh giá nào</h3>
            <p className="text-sm text-muted mt-2 max-w-sm">Bạn chưa viết đánh giá nào. Hãy mua hàng và để lại đánh giá để giúp những người mua khác nhé.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-line">
              {reviews.map((review) => (
                <div key={review.id} className="p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {review.product && (
                      <a href={`/products/${review.product.slug}`} className="block shrink-0 h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-xl border border-line bg-canvas/50">
                        <img 
                          src={review.product.image_url || "/placeholder-image.webp"} 
                          alt={review.product.name} 
                          className="h-full w-full object-cover transition-transform hover:scale-105" 
                        />
                      </a>
                    )}
                    <div className="min-w-0 flex-1">
                      {review.product && (
                        <a href={`/products/${review.product.slug}`} className="font-bold text-ink text-base hover:text-primary transition-colors line-clamp-2 mb-2">
                          {review.product.name}
                        </a>
                      )}
                      
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={cn("h-4 w-4", i < review.rating ? "fill-[#facc15] text-[#facc15]" : "fill-line/30 text-line/50")} 
                          />
                        ))}
                        <span className="text-xs text-muted font-medium ml-2">{formatDate(review.created_at)}</span>
                      </div>
                      
                      <p className="text-sm text-ink whitespace-pre-line bg-canvas/30 p-3 rounded-xl border border-line/50">
                        {review.comment || "Không có bình luận"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-6 py-4 bg-white mt-auto">
                <span className="text-sm text-muted font-medium">
                  Hiển thị {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, total)} trên tổng số {total} đánh giá
                </span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="secondary" 
                    disabled={page === 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="h-9 px-3 rounded-xl border-line hover:bg-line/30 text-ink font-bold disabled:opacity-50"
                  >
                    Trước
                  </Button>
                  <div className="flex items-center gap-1 hidden sm:flex">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "h-9 w-9 rounded-xl text-sm font-bold transition-colors flex items-center justify-center",
                          page === p 
                            ? "bg-primary text-white shadow-sm" 
                            : "text-ink hover:bg-canvas"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <Button 
                    variant="secondary" 
                    disabled={page === totalPages} 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="h-9 px-3 rounded-xl border-line hover:bg-line/30 text-ink font-bold disabled:opacity-50"
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Panel>
    </Section>
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

function AccountProfile({ store, showToast }: { store: any, showToast: any }) {
  const user = store.getCurrentUser();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [gender, setGender] = useState(user?.gender ?? "OTHER");
  const [birthday, setBirthday] = useState(user?.birthday || "");
  const [submitting, setSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setGender(user.gender ?? "OTHER");
      setBirthday(user.birthday || "");
      setAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

  if (!user) return <Section title="Hồ sơ cá nhân"><p>Vui lòng đăng nhập</p></Section>;

  const handleSave = async () => {
    setSubmitting(true);
    const res = await store.updateProfile({
      fullName,
      gender,
      dateOfBirth: birthday || undefined,
      avatarUrl: avatarUrl || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("Đã lưu hồ sơ.", "success");
    } else {
      showToast(res.message || "Lỗi lưu hồ sơ.", "danger");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const url = await uploadImage(file);
      setAvatarUrl(url);
      showToast("Tải ảnh lên thành công", "success");
    } catch (err: any) {
      showToast(err.message || "Không thể tải ảnh lên", "danger");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <Section title="Hồ sơ cá nhân">
      <Panel className="rounded-2xl border border-line shadow-sm p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-line">
          <div className="relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20 shadow-sm" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UserIcon className="h-8 w-8" />
              </div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg text-ink">Thông tin cá nhân</h3>
            <p className="text-sm font-medium text-muted mt-0.5">Cập nhật thông tin hồ sơ để bảo mật và nhận thông báo.</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Họ tên"><Input value={fullName} onChange={e => setFullName(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11" /></Field>
          <Field label="Email"><Input defaultValue={user.email} disabled className="opacity-70 bg-line/20 rounded-xl h-11 border-line text-muted" /></Field>
          <Field label="Số điện thoại"><Input defaultValue={user.phone} disabled className="opacity-70 bg-line/20 rounded-xl h-11 border-line text-muted" /></Field>
          <Field label="Giới tính">
            <Select value={gender} onChange={e => setGender(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11">
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </Select>
          </Field>
          <Field label="Ngày sinh"><Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11" /></Field>
          <Field label="Ảnh đại diện">
            <div className="flex items-center gap-3">
              {avatarUrl && (
                <img src={avatarUrl} alt="Preview" className="h-11 w-11 rounded-xl object-cover ring-1 ring-line shrink-0" />
              )}
              <div className="flex-1 flex items-center">
                <input 
                  type="file" 
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploadingAvatar}
                  className="hidden" 
                />
                <label 
                  htmlFor="avatar-upload"
                  className={`inline-flex items-center justify-center gap-2 px-5 h-10 rounded-xl font-bold text-sm transition-colors ${uploadingAvatar ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"}`}
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Tải ảnh lên
                    </>
                  )}
                </label>
              </div>
            </div>
          </Field>
        </div>
        <div className="mt-8 flex justify-end pt-6 border-t border-line">
          <Button disabled={submitting} onClick={handleSave} className="h-11 px-8 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-sm transition-transform hover:-translate-y-0.5">
            {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
          </Button>
        </div>
      </Panel>
    </Section>
  );
}

function AddressForm({ store, showToast, onSuccess, editingAddress, onCancel }: { store: any, showToast: any, onSuccess?: () => void, editingAddress?: Address, onCancel?: () => void }) {
  const [receiverName, setReceiverName] = useState(editingAddress?.receiverName || "");
  const [phone, setPhone] = useState(editingAddress?.phone || "");
  const [province, setProvince] = useState(editingAddress?.province || "");
  const [district, setDistrict] = useState(editingAddress?.district || "");
  const [ward, setWard] = useState(editingAddress?.ward || "");
  const [detailAddress, setDetailAddress] = useState(editingAddress?.detailAddress || "");
  const [addressType, setAddressType] = useState<AddressType>(editingAddress?.addressType || "HOME");

  useEffect(() => {
    setReceiverName(editingAddress?.receiverName || "");
    setPhone(editingAddress?.phone || "");
    setProvince(editingAddress?.province || "");
    setDistrict(editingAddress?.district || "");
    setWard(editingAddress?.ward || "");
    setDetailAddress(editingAddress?.detailAddress || "");
    setAddressType(editingAddress?.addressType || "HOME");
  }, [editingAddress]);

  const handleSubmit = async () => {
    if (!receiverName || !phone || !province || !district || !ward || !detailAddress) {
      showToast("Vui lòng điền đầy đủ thông tin", "danger");
      return;
    }
    let success: boolean | string = false;
    if (editingAddress) {
      success = await store.updateAddress(editingAddress.id, {
        receiverName, phone, province, district, ward, detailAddress, addressType, isDefault: editingAddress.isDefault
      });
    } else {
      success = await store.addAddress({
        receiverName, phone, province, district, ward, detailAddress, addressType, isDefault: false
      });
    }
    
    if (success === true) {
      showToast(editingAddress ? "Đã cập nhật địa chỉ" : "Đã thêm địa chỉ", "success");
      if (!editingAddress) {
        setReceiverName(""); setPhone(""); setProvince(""); setDistrict(""); setWard(""); setDetailAddress("");
      }
      onSuccess?.();
    } else {
      const errorMsg = typeof success === "string" ? success : (editingAddress ? "Cập nhật địa chỉ thất bại" : "Thêm địa chỉ thất bại");
      showToast(errorMsg, "danger");
    }
  };

  return (
    <div className="mt-5 grid gap-4">
      <Input placeholder="Người nhận" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11" />
      <Input placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11" />
      <Input placeholder="Tỉnh/thành" value={province} onChange={(e) => setProvince(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11" />
      <Input placeholder="Quận/huyện" value={district} onChange={(e) => setDistrict(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11" />
      <Input placeholder="Phường/xã" value={ward} onChange={(e) => setWard(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11" />
      <Textarea placeholder="Địa chỉ chi tiết" value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} className="bg-canvas/50 border-line focus:bg-white rounded-xl min-h-[80px]" />
      <Select value={addressType} onChange={(e) => setAddressType(e.target.value as AddressType)} className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11">
        <option value="HOME">Nhà riêng</option>
        <option value="OFFICE">Văn phòng</option>
      </Select>
      <div className="flex items-center gap-3 mt-2">
        <Button onClick={handleSubmit} className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-sm transition-transform hover:-translate-y-0.5">{editingAddress ? "Cập nhật" : "Thêm mới"}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel} className="flex-1 h-11 rounded-xl font-bold border-line hover:bg-line/30 text-ink">Hủy</Button>}
      </div>
    </div>
  );
}

function AddressBook({ store, showToast }: { store: any, showToast: any }) {
  const addresses = store.state.addresses.filter((address: Address) => address.userId === store.getCurrentUser()?.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingAddress = addresses.find((a: Address) => a.id === editingId);

  return (
    <Section title="Địa chỉ giao hàng">
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {addresses.map((address: Address) => (
            <Panel key={address.id} className="rounded-2xl border border-line shadow-sm p-5 transition-all hover:border-primary/30 hover:shadow-md">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-ink text-base">{address.receiverName} <span className="text-muted font-normal mx-1">|</span> {address.phone}</p>
                      <p className="mt-1.5 text-sm text-muted font-medium leading-relaxed">{address.detailAddress}, {address.ward}, {address.district}, {address.province}</p>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-2 items-end">
                    {address.isDefault && (
                      <span className="rounded bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary border border-primary/20 whitespace-nowrap">MẶC ĐỊNH</span>
                    )}
                    <span className="rounded bg-line/30 px-2 py-1 text-[11px] font-bold text-muted border border-line whitespace-nowrap">{address.addressType === "OFFICE" ? "VĂN PHÒNG" : "NHÀ RIÊNG"}</span>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-line">
                  {!address.isDefault && (
                    <Button 
                      variant="secondary" 
                      className="text-xs h-8 px-3 rounded-lg font-bold border-line hover:bg-line/30 text-ink"
                      onClick={async () => {
                        const success = await store.updateAddress(address.id, { isDefault: true });
                        if (success === true) {
                          showToast("Đã đặt làm mặc định", "success");
                        } else {
                          showToast(typeof success === "string" ? success : "Cập nhật thất bại", "danger");
                        }
                      }}
                    >
                      Đặt mặc định
                    </Button>
                  )}
                  <Button variant="secondary" className="text-xs h-8 px-3 rounded-lg font-bold border-line hover:bg-line/30 text-ink" onClick={() => setEditingId(address.id)}>Sửa</Button>
                  <Button 
                    variant="danger" 
                    className="text-xs h-8 px-3 rounded-lg font-bold bg-coral text-white hover:bg-coral/90 shadow-sm transition-colors"
                    onClick={async () => {
                      if (window.confirm("Bạn có chắc chắn muốn xoá địa chỉ này?")) {
                        const success = await store.removeAddress(address.id);
                        if (success) {
                          showToast("Đã xoá địa chỉ", "success");
                          if (editingId === address.id) setEditingId(null);
                        } else {
                          showToast("Xoá địa chỉ thất bại", "danger");
                        }
                      }
                    }}
                  >
                    Xoá
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
          {addresses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line/60 bg-canvas/30 p-8 text-center">
              <MapPin className="mx-auto h-8 w-8 text-muted/50 mb-3" />
              <p className="text-sm font-semibold text-muted">Chưa có địa chỉ giao hàng nào</p>
            </div>
          )}
        </div>
        <Panel className="rounded-2xl border border-line shadow-sm p-6 sticky top-24 h-fit">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-ink text-base">{editingAddress ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}</h3>
          </div>
          <AddressForm 
            store={store}
            showToast={showToast}
            editingAddress={editingAddress} 
            onSuccess={() => setEditingId(null)}
            onCancel={editingAddress ? () => setEditingId(null) : undefined}
          />
        </Panel>
      </div>
    </Section>
  );
}
