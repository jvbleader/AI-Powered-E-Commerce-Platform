"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bell, CreditCard, LogOut, Plus, Store, Star, Copy, Check, ExternalLink, RotateCcw, Truck, MapPin, MessageSquare, ShieldCheck, FileText, HelpCircle, Loader2, Package, Headset, LayoutDashboard, User as UserIcon, Mail, Smartphone, X, Upload, ChevronLeft, ChevronRight, Wallet as WalletIcon, KeyRound, RefreshCw, AlertCircle, CheckCircle2, Building2, ArrowUpRight } from "lucide-react";
import { createReviewApi, fetchMyReviewsApi, type UserReviewResponse } from "@/services/review-api";
import { uploadImage } from "@/services/upload-api";
import { walletApi, type WalletInfo, type WalletTransaction, type UpdateWalletBankAccountRequest } from "@/services/wallet-api";
import { UserWithdrawalModal } from "@/components/wallet/UserWithdrawalModal";
import { UserBankAccountModal } from "@/components/wallet/UserBankAccountModal";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { Badge, StatusBadge } from "@/components/ui/badge";
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
  canContinuePayment,
  canCustomerCancel,
  canCustomerConfirmReceipt,
  canCustomerReturn,
  canCustomerDispute,
  returnStatusLabel,
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
  const searchParams = useSearchParams();
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
    { key: "wallet", href: "/account/wallet", label: "Ví tiền", icon: WalletIcon },
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
        {currentSection === "wallet" ? <WalletSection /> : null}
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

  function WalletSection() {
    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [loadingWallet, setLoadingWallet] = useState(true);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [totalTxns, setTotalTxns] = useState(0);
    const [loadingTxns, setLoadingTxns] = useState(false);
    const [txnFilter, setTxnFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const LIMIT = 10;

    // PIN state
    const [pinMode, setPinMode] = useState<"idle" | "create" | "change" | "reset">("idle");
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [oldPin, setOldPin] = useState("");
    const [otp, setOtp] = useState("");
    const [pinSubmitting, setPinSubmitting] = useState(false);
    const [pinErrors, setPinErrors] = useState<Record<string, string>>({});

    // Top-up state
    const [topupAmount, setTopupAmount] = useState<string>("" );
    const [topupMethod, setTopupMethod] = useState<"VNPAY">("VNPAY");
    const [topupSubmitting, setTopupSubmitting] = useState(false);
    const [topupError, setTopupError] = useState("");

    // Withdrawal & Bank Modal states
    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [bankModalOpen, setBankModalOpen] = useState(false);
    const [returnToWithdraw, setReturnToWithdraw] = useState(false);

    const fetchWallet = useCallback(async () => {
      try {
        setLoadingWallet(true);
        const data = await walletApi.getWallet();
        setWallet(data);
      } catch (err: any) {
        showToast(err?.message || "Không thể tải thông tin ví.", "danger");
      } finally {
        setLoadingWallet(false);
      }
    }, [showToast]);

    const fetchTransactions = useCallback(async (page: number, typeFilter: string) => {
      try {
        setLoadingTxns(true);
        const offset = (page - 1) * LIMIT;
        const res = await walletApi.getTransactions(LIMIT, offset, typeFilter || undefined);
        setTransactions(res.items);
        setTotalTxns(res.total);
      } catch (err: any) {
        showToast(err?.message || "Không thể tải lịch sử giao dịch.", "danger");
      } finally {
        setLoadingTxns(false);
      }
    }, [showToast]);

    // Initial load
    useEffect(() => {
      fetchWallet();
    }, [fetchWallet]);

    useEffect(() => {
      fetchTransactions(currentPage, txnFilter);
    }, [fetchTransactions, currentPage, txnFilter]);

    // Handle VNPay callback query parameters
    useEffect(() => {
      const topupStatus = searchParams?.get("topup_status");
      const txnCode = searchParams?.get("txn_code");
      if (topupStatus) {
        if (topupStatus === "success") {
          showToast(
            txnCode
              ? `Nạp tiền qua VNPay thành công! (Mã GD: ${txnCode})`
              : "Nạp tiền qua VNPay thành công!",
            "success"
          );
          fetchWallet();
          fetchTransactions(1, txnFilter);
          setCurrentPage(1);
        } else {
          showToast("Nạp tiền qua VNPay thất bại.", "danger");
        }
        router.replace("/account/wallet");
      }
    }, [searchParams, fetchWallet, fetchTransactions, txnFilter, router, showToast]);

    const resetPinForm = () => {
      setPin("");
      setConfirmPin("");
      setOldPin("");
      setOtp("");
      setPinErrors({});
      setPinMode("idle");
    };

    // PIN handlers
    const handleCreatePin = async () => {
      const errs: Record<string, string> = {};
      if (!/^\d{6}$/.test(pin)) {
        errs.pin = "Mã PIN phải gồm đúng 6 chữ số.";
      }
      if (pin !== confirmPin) {
        errs.confirmPin = "Mã PIN xác nhận không khớp.";
      }
      if (Object.keys(errs).length > 0) {
        setPinErrors(errs);
        return;
      }
      setPinErrors({});
      setPinSubmitting(true);
      try {
        const updated = await walletApi.createPin(pin);
        setWallet(updated);
        showToast("Tạo mã PIN thành công!", "success");
        resetPinForm();
      } catch (err: any) {
        showToast(err?.message || "Tạo mã PIN thất bại.", "danger");
      } finally {
        setPinSubmitting(false);
      }
    };

    const handleChangePin = async () => {
      const errs: Record<string, string> = {};
      if (!/^\d{6}$/.test(oldPin)) {
        errs.oldPin = "Mã PIN hiện tại phải gồm đúng 6 chữ số.";
      }
      if (!/^\d{6}$/.test(pin)) {
        errs.pin = "Mã PIN mới phải gồm đúng 6 chữ số.";
      }
      if (pin !== confirmPin) {
        errs.confirmPin = "Mã PIN xác nhận không khớp.";
      }
      if (Object.keys(errs).length > 0) {
        setPinErrors(errs);
        return;
      }
      setPinErrors({});
      setPinSubmitting(true);
      try {
        const updated = await walletApi.changePin(oldPin, pin);
        setWallet(updated);
        showToast("Đổi mã PIN thành công!", "success");
        resetPinForm();
      } catch (err: any) {
        showToast(err?.message || "Đổi mã PIN thất bại.", "danger");
      } finally {
        setPinSubmitting(false);
      }
    };

    const handleForgotPin = async () => {
      setPinSubmitting(true);
      try {
        const res = await walletApi.forgotPin();
        showToast(res.message || "Mã OTP đã được gửi đến email của bạn.", "success");
        setPinMode("reset");
        setPinErrors({});
      } catch (err: any) {
        showToast(err?.message || "Không thể gửi mã OTP khôi phục PIN.", "danger");
      } finally {
        setPinSubmitting(false);
      }
    };

    const handleResetPin = async () => {
      const errs: Record<string, string> = {};
      if (!/^\d{6}$/.test(otp.trim())) {
        errs.otp = "Mã OTP phải gồm đúng 6 chữ số.";
      }
      if (!/^\d{6}$/.test(pin)) {
        errs.pin = "Mã PIN mới phải gồm đúng 6 chữ số.";
      }
      if (confirmPin && pin !== confirmPin) {
        errs.confirmPin = "Mã PIN xác nhận không khớp.";
      }
      if (Object.keys(errs).length > 0) {
        setPinErrors(errs);
        return;
      }
      setPinErrors({});
      setPinSubmitting(true);
      try {
        const updated = await walletApi.resetPin(otp.trim(), pin);
        setWallet(updated);
        showToast("Đặt lại mã PIN thành công!", "success");
        resetPinForm();
      } catch (err: any) {
        showToast(err?.message || "Đặt lại mã PIN thất bại.", "danger");
      } finally {
        setPinSubmitting(false);
      }
    };

    // Top-up handler
    const handleTopup = async () => {
      const amount = Number(topupAmount);
      if (!amount || isNaN(amount) || amount < 10000 || amount > 10000000) {
        setTopupError("Số tiền nạp tối thiểu là 10.000đ và tối đa là 10.000.000đ.");
        return;
      }
      setTopupError("");
      setTopupSubmitting(true);
      try {
        const res = await walletApi.topup(amount, topupMethod);
        if (res.payment_url) {
          window.location.href = res.payment_url;
          return;
        }
        showToast(`Nạp thành công ${formatVnd(amount)} vào ví!`, "success");
        setTopupAmount("");
        fetchWallet();
        fetchTransactions(1, txnFilter);
        setCurrentPage(1);
      } catch (err: any) {
        showToast(err?.message || "Nạp tiền thất bại.", "danger");
      } finally {
        setTopupSubmitting(false);
      }
    };

    const handleWithdrawSubmit = async (amount: number, pin?: string): Promise<boolean> => {
      try {
        const res = await walletApi.withdraw({
          amount,
          pin,
        });
        showToast(
          `Rút tiền thành công! Đã chuyển ${formatVnd(amount)} tới tài khoản ${res.bank_info?.bank_name || ""}. (Mã GD: ${res.transaction_code})`,
          "success"
        );
        fetchWallet();
        fetchTransactions(1, txnFilter);
        setCurrentPage(1);
        return true;
      } catch (err: any) {
        showToast(err?.message || "Rút tiền thất bại.", "danger");
        throw err;
      }
    };

    const handleBankSubmit = async (payload: UpdateWalletBankAccountRequest): Promise<boolean> => {
      try {
        await walletApi.updateBankAccount(payload);
        showToast("Cập nhật thông tin ngân hàng thành công!", "success");
        fetchWallet();
        return true;
      } catch (err: any) {
        showToast(err?.message || "Cập nhật ngân hàng thất bại.", "danger");
        return false;
      }
    };

    const presetAmounts = [50000, 100000, 200000, 500000, 1000000, 2000000];
    const totalPages = Math.ceil(totalTxns / LIMIT);

    const renderTxnTypeBadge = (type: string) => {
      if (type === "TOPUP") {
        return <Badge tone="purple">Nạp tiền</Badge>;
      }
      if (type === "ORDER_PAYMENT" || type === "PAYMENT") {
        return <Badge tone="info">Thanh toán</Badge>;
      }
      if (type === "REFUND_ORDER" || type === "REFUND") {
        return <Badge tone="warning">Hoàn tiền</Badge>;
      }
      if (type === "WITHDRAWAL") {
        return <Badge tone="danger">Rút tiền</Badge>;
      }
      return <Badge tone="neutral">{type}</Badge>;
    };

    const renderTxnStatusBadge = (t: WalletTransaction) => {
      if (t.reference_type === "VNPAY_PENDING") {
        return <Badge tone="warning">Đang chờ</Badge>;
      }
      if (t.reference_type === "VNPAY_FAILED") {
        return <Badge tone="danger">Thất bại</Badge>;
      }
      return <Badge tone="success">Thành công</Badge>;
    };

    return (
      <Section title="Ví tiền">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* BALANCE & TOPUP COLUMN */}
          <div className="space-y-6">
            {/* Balance Card */}
            <Panel className="rounded-2xl border border-line shadow-sm p-6 bg-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <WalletIcon className="h-32 w-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <WalletIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-ink text-base">Số dư ví</h3>
                      <p className="text-xs text-muted">Ví điện tử cá nhân</p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="h-8 px-2.5 text-xs rounded-lg border-line text-muted hover:text-ink gap-1.5"
                    onClick={() => {
                      fetchWallet();
                      fetchTransactions(currentPage, txnFilter);
                    }}
                    disabled={loadingWallet}
                    title="Làm mới số dư"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", loadingWallet && "animate-spin")} />
                    <span>Làm mới</span>
                  </Button>
                </div>

                <div className="mt-4 mb-5 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider block">Số dư khả dụng</span>
                    <div className="text-3xl font-black text-emerald-600 mt-1">
                      {loadingWallet ? "..." : formatVnd(wallet?.balance ?? 0)}
                    </div>
                  </div>
                  <Button
                    onClick={() => setWithdrawModalOpen(true)}
                    disabled={loadingWallet}
                    className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm gap-1.5 flex items-center shrink-0"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Rút tiền</span>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <span>Trạng thái:</span>
                    <Badge tone={wallet?.status === "ACTIVE" ? "success" : "danger"}>
                      {wallet?.status === "ACTIVE" ? "Hoạt động" : (wallet?.status || "Hoạt động")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <span>Mã PIN:</span>
                    <Badge tone={wallet?.has_pin ? "success" : "warning"}>
                      {wallet?.has_pin ? "Đã thiết lập" : "Chưa có"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <span>Ngân hàng:</span>
                    {wallet?.bank_info?.bank_name ? (
                      <button
                        type="button"
                        onClick={() => setBankModalOpen(true)}
                        className="hover:opacity-80 transition-opacity"
                        title="Bấm để thay đổi tài khoản nhận tiền"
                      >
                        <Badge tone="info">
                          {wallet.bank_info.bank_name} - {wallet.bank_info.bank_account_number}
                        </Badge>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBankModalOpen(true)}
                        className="text-primary hover:underline text-xs font-semibold"
                      >
                        + Thêm tài khoản
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Top-up Card */}
            <Panel className="rounded-2xl border border-line shadow-sm p-6 bg-white">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-ink text-base">Nạp tiền vào ví</h3>
              </div>

              <div className="space-y-4">
                <Field
                  label="Số tiền nạp (VND)"
                  hint={topupError ? <span className="text-coral text-xs font-semibold">{topupError}</span> : <span className="text-muted text-xs">Tối thiểu 10.000đ - Tối đa 10.000.000đ</span>}
                >
                  <Input
                    type="number"
                    min={10000}
                    max={10000000}
                    step={10000}
                    value={topupAmount}
                    onChange={(e) => {
                      setTopupAmount(e.target.value);
                      setTopupError("");
                    }}
                    placeholder="Nhập số tiền muốn nạp..."
                    className={cn(
                      "bg-canvas/50 border-line focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all rounded-xl text-base font-semibold",
                      topupError && "border-coral focus:border-coral focus:ring-coral/10"
                    )}
                  />
                </Field>

                {/* Preset quick amounts */}
                <div>
                  <label className="text-xs font-semibold text-muted block mb-2">Chọn nhanh mệnh giá:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {presetAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setTopupAmount(String(amt));
                          setTopupError("");
                        }}
                        className={cn(
                          "py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center",
                          Number(topupAmount) === amt
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-line bg-canvas/30 hover:bg-canvas hover:border-slate-300 text-ink"
                        )}
                      >
                        {formatVnd(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Phương thức nạp">
                  <Select
                    value={topupMethod}
                    onChange={(e) => setTopupMethod(e.target.value as "VNPAY")}
                    className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11 text-sm font-semibold text-ink"
                  >
                    <option value="VNPAY">Cổng thanh toán VNPay (ATM / QR / Visa)</option>
                  </Select>
                </Field>

                <Button
                  disabled={topupSubmitting || !topupAmount || Number(topupAmount) < 10000}
                  onClick={handleTopup}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-sm gap-2"
                >
                  {topupSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang xử lý nạp tiền...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>Nạp tiền ngay</span>
                    </>
                  )}
                </Button>
              </div>
            </Panel>
          </div>

          {/* PIN MANAGEMENT COLUMN */}
          <div>
            <Panel className="rounded-2xl border border-line shadow-sm p-6 bg-white h-fit">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-ink text-base">Quản lý mã PIN ví</h3>
              </div>
              <p className="text-sm text-muted font-medium mb-5">
                Mã PIN gồm 6 chữ số được sử dụng để xác thực an toàn khi bạn thanh toán đơn hàng bằng số dư ví.
              </p>

              {/* Mode: IDLE */}
              {pinMode === "idle" && (
                <div className="space-y-4">
                  {!wallet?.has_pin ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-900">Chưa thiết lập mã PIN</p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            Bạn cần tạo mã PIN 6 số trước khi có thể sử dụng ví để thanh toán đơn hàng.
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          setPinMode("create");
                          setPinErrors({});
                        }}
                        className="w-full sm:w-auto h-10 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm"
                      >
                        Tạo mã PIN ngay
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                        <div className="flex items-start gap-2.5">
                          <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-emerald-900">Mã PIN đã được thiết lập</p>
                            <p className="text-xs text-emerald-700 mt-0.5">
                              Ví của bạn đã được bảo vệ bằng mã PIN. Không chia sẻ mã PIN cho bất kỳ ai.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 pt-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setPinMode("change");
                            setPinErrors({});
                          }}
                          className="rounded-xl font-bold border-line text-ink hover:bg-line/30 h-10 text-xs"
                        >
                          Đổi mã PIN
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleForgotPin}
                          disabled={pinSubmitting}
                          className="rounded-xl font-bold border-line text-coral hover:bg-coral/5 h-10 text-xs"
                        >
                          {pinSubmitting ? "Đang gửi OTP..." : "Quên mã PIN?"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode: CREATE */}
              {pinMode === "create" && (
                <div className="space-y-4 border-t border-line pt-4">
                  <h4 className="font-bold text-sm text-ink">Tạo mã PIN mới</h4>
                  <Field
                    label="Mã PIN (6 chữ số)"
                    hint={pinErrors.pin ? <span className="text-coral text-xs font-semibold">{pinErrors.pin}</span> : null}
                  >
                    <Input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập 6 số PIN..."
                      className={cn("bg-canvas/50 border-line focus:bg-white rounded-xl", pinErrors.pin && "border-coral")}
                    />
                  </Field>
                  <Field
                    label="Xác nhận mã PIN"
                    hint={pinErrors.confirmPin ? <span className="text-coral text-xs font-semibold">{pinErrors.confirmPin}</span> : null}
                  >
                    <Input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập lại 6 số PIN..."
                      className={cn("bg-canvas/50 border-line focus:bg-white rounded-xl", pinErrors.confirmPin && "border-coral")}
                    />
                  </Field>
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      disabled={pinSubmitting}
                      onClick={handleCreatePin}
                      className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs shadow-sm"
                    >
                      {pinSubmitting ? "Đang tạo..." : "Tạo PIN"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={resetPinForm}
                      disabled={pinSubmitting}
                      className="h-10 rounded-xl font-bold border-line text-ink hover:bg-line/30 text-xs"
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              )}

              {/* Mode: CHANGE */}
              {pinMode === "change" && (
                <div className="space-y-4 border-t border-line pt-4">
                  <h4 className="font-bold text-sm text-ink">Đổi mã PIN</h4>
                  <Field
                    label="Mã PIN hiện tại"
                    hint={pinErrors.oldPin ? <span className="text-coral text-xs font-semibold">{pinErrors.oldPin}</span> : null}
                  >
                    <Input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập 6 số PIN cũ..."
                      className={cn("bg-canvas/50 border-line focus:bg-white rounded-xl", pinErrors.oldPin && "border-coral")}
                    />
                  </Field>
                  <Field
                    label="Mã PIN mới"
                    hint={pinErrors.pin ? <span className="text-coral text-xs font-semibold">{pinErrors.pin}</span> : null}
                  >
                    <Input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập 6 số PIN mới..."
                      className={cn("bg-canvas/50 border-line focus:bg-white rounded-xl", pinErrors.pin && "border-coral")}
                    />
                  </Field>
                  <Field
                    label="Xác nhận mã PIN mới"
                    hint={pinErrors.confirmPin ? <span className="text-coral text-xs font-semibold">{pinErrors.confirmPin}</span> : null}
                  >
                    <Input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập lại 6 số PIN mới..."
                      className={cn("bg-canvas/50 border-line focus:bg-white rounded-xl", pinErrors.confirmPin && "border-coral")}
                    />
                  </Field>
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      disabled={pinSubmitting}
                      onClick={handleChangePin}
                      className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs shadow-sm"
                    >
                      {pinSubmitting ? "Đang đổi..." : "Đổi PIN"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={resetPinForm}
                      disabled={pinSubmitting}
                      className="h-10 rounded-xl font-bold border-line text-ink hover:bg-line/30 text-xs"
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              )}

              {/* Mode: RESET */}
              {pinMode === "reset" && (
                <div className="space-y-4 border-t border-line pt-4">
                  <h4 className="font-bold text-sm text-ink">Khôi phục mã PIN qua OTP</h4>
                  <p className="text-xs text-muted">
                    Mã xác thực OTP gồm 6 chữ số đã được gửi đến email tài khoản của bạn.
                  </p>
                  <Field
                    label="Mã xác thực OTP (6 chữ số)"
                    hint={pinErrors.otp ? <span className="text-coral text-xs font-semibold">{pinErrors.otp}</span> : null}
                  >
                    <Input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập 6 số OTP từ email..."
                      className={cn("bg-canvas/50 border-line focus:bg-white rounded-xl font-mono text-center tracking-widest text-base", pinErrors.otp && "border-coral")}
                    />
                  </Field>
                  <Field
                    label="Mã PIN mới"
                    hint={pinErrors.pin ? <span className="text-coral text-xs font-semibold">{pinErrors.pin}</span> : null}
                  >
                    <Input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập 6 số PIN mới..."
                      className={cn("bg-canvas/50 border-line focus:bg-white rounded-xl", pinErrors.pin && "border-coral")}
                    />
                  </Field>
                  <Field
                    label="Xác nhận mã PIN mới"
                    hint={pinErrors.confirmPin ? <span className="text-coral text-xs font-semibold">{pinErrors.confirmPin}</span> : null}
                  >
                    <Input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Nhập lại 6 số PIN mới..."
                      className={cn("bg-canvas/50 border-line focus:bg-white rounded-xl", pinErrors.confirmPin && "border-coral")}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      disabled={pinSubmitting}
                      onClick={handleResetPin}
                      className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs shadow-sm"
                    >
                      {pinSubmitting ? "Đang đặt lại..." : "Đặt lại PIN"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleForgotPin}
                      disabled={pinSubmitting}
                      className="h-10 rounded-xl font-bold border-line text-muted hover:text-ink text-xs"
                    >
                      Gửi lại OTP
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={resetPinForm}
                      disabled={pinSubmitting}
                      className="h-10 rounded-xl font-bold border-line text-ink hover:bg-line/30 text-xs"
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* TRANSACTION HISTORY SECTION */}
        <div className="mt-8">
          <Panel className="rounded-2xl border border-line shadow-sm p-6 bg-white overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4 mb-4">
              <div>
                <h3 className="font-bold text-ink text-base">Lịch sử giao dịch ví</h3>
                <p className="text-xs text-muted mt-0.5">Biến động số dư nạp tiền, thanh toán và hoàn tiền</p>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={txnFilter}
                  onChange={(e) => {
                    setTxnFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-48 bg-canvas/50 border-line focus:bg-white rounded-xl h-10 text-xs font-semibold text-ink"
                >
                  <option value="">Tất cả giao dịch</option>
                  <option value="TOPUP">Nạp tiền</option>
                  <option value="ORDER_PAYMENT">Thanh toán đơn hàng</option>
                  <option value="REFUND_ORDER">Hoàn tiền</option>
                  <option value="WITHDRAWAL">Rút tiền</option>
                </Select>
              </div>
            </div>

            {loadingTxns ? (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                <p className="text-xs font-medium text-muted">Đang tải lịch sử giao dịch...</p>
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                title="Chưa có giao dịch nào"
                description={txnFilter ? "Không tìm thấy giao dịch với bộ lọc đã chọn." : "Chưa có biến động số dư nào trong ví của bạn."}
              />
            ) : (
              <div>
                <DataTable
                  columns={["Mã GD", "Loại", "Trạng thái", "Số tiền", "Số dư sau", "Nội dung", "Thời gian"]}
                  aligns={["left", "left", "left", "right", "right", "left", "right"]}
                  rows={transactions.map((t) => {
                    const amt = Number(t.amount);
                    const isPending = t.reference_type === "VNPAY_PENDING";
                    const isFailed = t.reference_type === "VNPAY_FAILED";
                    const isPositive = amt >= 0;

                    return [
                      <span key="code" className="font-mono text-xs font-bold text-slate-700">
                        {t.transaction_code}
                      </span>,
                      <span key="type">{renderTxnTypeBadge(t.transaction_type)}</span>,
                      <span key="status">{renderTxnStatusBadge(t)}</span>,
                      <span
                        key="amt"
                        className={cn(
                          "font-bold text-sm whitespace-nowrap",
                          isPending
                            ? "text-slate-600 font-semibold"
                            : isFailed
                            ? "text-slate-400 line-through font-normal"
                            : isPositive
                            ? "text-emerald-600"
                            : "text-rose-600"
                        )}
                      >
                        {isPending
                          ? formatVnd(amt)
                          : isFailed
                          ? formatVnd(amt)
                          : isPositive
                          ? `+${formatVnd(amt)}`
                          : `-${formatVnd(Math.abs(amt))}`}
                      </span>,
                      <span key="bal" className="font-medium text-xs text-ink whitespace-nowrap">
                        {isPending || isFailed ? (
                          <span className="text-slate-400 font-normal">—</span>
                        ) : (
                          formatVnd(t.balance_after)
                        )}
                      </span>,
                      <span
                        key="desc"
                        className="text-xs text-muted max-w-[280px] line-clamp-1 block"
                        title={t.description}
                      >
                        {t.description}
                      </span>,
                      <span key="date" className="text-xs text-muted whitespace-nowrap">
                        {formatDate(t.created_at)}
                      </span>,
                    ];
                  })}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-line px-2 pt-4 mt-4">
                    <span className="text-xs text-muted font-medium">
                      Hiển thị {(currentPage - 1) * LIMIT + 1} - {Math.min(currentPage * LIMIT, totalTxns)} trên tổng số {totalTxns} giao dịch
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="h-8 px-3 rounded-xl border-line hover:bg-line/30 text-ink text-xs font-bold disabled:opacity-50"
                      >
                        Trước
                      </Button>
                      <span className="text-xs font-bold text-ink px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="h-8 px-3 rounded-xl border-line hover:bg-line/30 text-ink text-xs font-bold disabled:opacity-50"
                      >
                        Sau
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>

        {/* User Withdrawal & Bank Modals */}
        <UserWithdrawalModal
          open={withdrawModalOpen}
          onOpenChange={setWithdrawModalOpen}
          wallet={wallet}
          onSubmitWithdraw={handleWithdrawSubmit}
          onOpenBankSettings={() => {
            setReturnToWithdraw(true);
            setWithdrawModalOpen(false);
            setBankModalOpen(true);
          }}
        />

        <UserBankAccountModal
          open={bankModalOpen}
          onOpenChange={(open) => {
            setBankModalOpen(open);
            if (!open && returnToWithdraw) {
              setWithdrawModalOpen(true);
              setReturnToWithdraw(false);
            }
          }}
          initialBankInfo={wallet?.bank_info}
          onSubmit={handleBankSubmit}
        />
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
                onClick={() => router.push(`/shops/${order.shopSlug || order.sellerId}`)}
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
          onClick={() => router.push(`/account/orders/${order.orderCode}`)}
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
    const [returnModalOrderCode, setReturnModalOrderCode] = useState<string | null>(null);
    const [disputeModalOrderCode, setDisputeModalOrderCode] = useState<string | null>(null);
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
        router.push(`/payment/${payment.paymentCode}`);
        return;
      }
      const method = order.preferredPaymentMethod ?? store.state.lastCheckoutPaymentMethod ?? "VNPAY";
      const result = await store.createCheckoutPayment([order.orderCode], method);
      if (!result.ok) {
        showToast(result.message || "Không thể tạo giao dịch thanh toán.", "danger");
        return;
      }
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      router.push(`/payment/${result.paymentCode}`);
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
      const showReturn = canCustomerReturn(order);
      const showDispute = canCustomerDispute(order);

      if (!showPayment && !showCancel && !showReceipt && !showReturn && !showDispute)
        return <span className="text-muted font-medium text-sm">Theo dõi</span>;

      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          {showCancel ? <Button variant="danger" className="text-xs h-8 px-3 rounded-lg font-bold bg-coral text-white hover:bg-coral/90 shadow-sm transition-colors" onClick={() => store.cancelCustomerOrder(order.orderCode).then((res) => { if (res.ok) showToast("Đã hủy đơn hàng.", "success"); else showToast(res.message || "Lỗi hủy đơn", "danger"); })}>Hủy</Button> : null}
          {showPayment ? (
            <Button className="text-xs h-8 px-3 rounded-lg font-bold shadow-sm bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5" onClick={() => goToPaymentForOrder(order)}>
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              Thanh toán
            </Button>
          ) : null}
          {showReturn ? (
            <Button
              variant="secondary"
              className="text-xs h-8 px-3 rounded-lg font-bold border-coral/30 text-coral bg-coral/5 hover:bg-coral/10"
              onClick={() => setReturnModalOrderCode(order.orderCode)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Trả hàng / Hoàn tiền
            </Button>
          ) : null}
          {showDispute ? (
            <Button
              className="text-xs h-8 px-3 rounded-lg font-bold bg-coral text-white hover:bg-coral/90 shadow-sm"
              onClick={() => setDisputeModalOrderCode(order.orderCode)}
            >
              <Headset className="h-3.5 w-3.5 mr-1" />
              Khiếu nại lên Sàn
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
        <ReturnRequestModal
          isOpen={Boolean(returnModalOrderCode)}
          onClose={() => setReturnModalOrderCode(null)}
          orderCode={returnModalOrderCode || ""}
          onSuccess={() => store.fetchCustomerOrders(status as OrderStatus | "", true)}
        />
        <DisputeModal
          isOpen={Boolean(disputeModalOrderCode)}
          onClose={() => setDisputeModalOrderCode(null)}
          orderCode={disputeModalOrderCode || ""}
          onSuccess={() => store.fetchCustomerOrders(status as OrderStatus | "", true)}
        />
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
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && reviewingItem && !submittingReview) {
          setReviewingItem(null);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [reviewingItem, submittingReview]);

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

    const goToPaymentForOrder = async (order: Order) => {
      const payment = findPaymentForOrder(order.orderCode);
      if (payment) {
        router.push(`/payment/${payment.paymentCode}`);
        return;
      }
      const method = order.preferredPaymentMethod ?? store.state.lastCheckoutPaymentMethod ?? "VNPAY";
      const result = await store.createCheckoutPayment([order.orderCode], method);
      if (!result.ok) {
        showToast(result.message || "Không thể tạo giao dịch thanh toán.", "danger");
        return;
      }
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      router.push(`/payment/${result.paymentCode}`);
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

          {/* DELIVERED BANNER */}
          {audience === "customer" && order.orderStatus === "DELIVERED" && !order.returnRequest && (
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50 p-4 sm:p-5 shadow-sm text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-base sm:text-lg text-emerald-950">Đơn hàng đã được giao tới bạn</h4>
                  <p className="text-xs sm:text-sm text-emerald-800 mt-0.5 leading-relaxed font-medium">
                    Vui lòng kiểm tra sản phẩm. Đơn sẽ tự động hoàn tất sau 7 ngày nếu không có khiếu nại.
                  </p>
                  {order.autoCompleteAt && (
                    <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 border border-emerald-200 text-xs font-bold text-emerald-900">
                      <span>Tự động hoàn tất vào:</span>
                      <span className="font-black">{formatDate(order.autoCompleteAt)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                <Button
                  variant="secondary"
                  className="text-xs h-10 px-4 font-bold border-coral/30 text-coral bg-white hover:bg-coral/5 shadow-sm rounded-xl"
                  onClick={() => setShowReturnModal(true)}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Yêu cầu Trả hàng / Hoàn tiền
                </Button>
                <Button
                  className="text-xs h-10 px-4 font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm rounded-xl"
                  onClick={() => store.confirmCustomerReceipt(order.orderCode).then((res) => { if (res.ok) showToast("Đã xác nhận nhận hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Đã nhận được hàng
                </Button>
              </div>
            </div>
          )}

          {/* RETURN REQUEST SHOPEE PICK-UP CARD */}
          {order.returnRequest && (
            <Panel className="rounded-2xl border border-line shadow-sm p-5 sm:p-6 bg-white overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 font-bold">
                    <RotateCcw className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-ink text-base">Yêu cầu Trả hàng / Hoàn tiền</h3>
                      <span className="text-xs font-mono text-muted bg-canvas px-2 py-0.5 rounded border border-line">
                        #{order.returnRequest.returnCode}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      Ngày yêu cầu: <span className="font-semibold text-ink">{formatDate(order.returnRequest.createdAt)}</span>
                    </p>
                  </div>
                </div>
                <StatusBadge
                  status={order.returnRequest.returnStatus}
                  label={returnStatusLabel[order.returnRequest.returnStatus] || order.returnRequest.returnStatus}
                />
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm">
                  <span className="text-muted">Lý do hoàn hàng:</span>
                  <span className="font-bold text-ink">{order.returnRequest.reason}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 text-xs sm:text-sm">
                  <span className="text-muted shrink-0">Mô tả chi tiết:</span>
                  <span className="font-medium text-ink max-w-md sm:text-right">{order.returnRequest.description}</span>
                </div>

                {order.returnRequest.evidenceImages && order.returnRequest.evidenceImages.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-muted mb-2">Ảnh minh chứng:</p>
                    <div className="flex flex-wrap gap-2">
                      {order.returnRequest.evidenceImages.map((img, idx) => (
                        <a key={idx} href={img} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-line hover:opacity-90">
                          <img src={img} alt={`Evidence ${idx + 1}`} className="h-16 w-16 object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1. SELLER_APPROVED hoặc RETURNING: Shopee Pick-up Card */}
                {(order.returnRequest.returnStatus === "SELLER_APPROVED" || order.returnRequest.returnStatus === "RETURNING") && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                      <Truck className="h-4 w-4 text-emerald-600" />
                      <span>Vận đơn thu gom sàn (Shopee Pick-up tận nơi)</span>
                    </div>
                    <div className="grid gap-2 text-xs sm:text-sm">
                      <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                        <span className="text-emerald-800">Đơn vị vận chuyển thu gom:</span>
                        <span className="font-bold text-emerald-950">{order.returnRequest.returnShippingProvider || "Shopee Xpress Pick-up"}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                        <span className="text-emerald-800">Mã vận đơn hoàn:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-950">{order.returnRequest.returnTrackingCode || "RET-PENDING"}</span>
                          {order.returnRequest.returnTrackingCode && (
                            <button
                              type="button"
                              onClick={() => handleCopy(order.returnRequest!.returnTrackingCode!, "mã vận đơn hoàn")}
                              className="p-1 text-emerald-700 hover:text-emerald-900"
                              title="Sao chép mã"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-start py-1 border-b border-emerald-100">
                        <span className="text-emerald-800 shrink-0">Địa chỉ lấy hàng hoàn:</span>
                        <span className="font-medium text-emerald-950 text-right max-w-xs">
                          {order.returnRequest.pickupAddress || `${order.shipment.detailAddress}, ${order.shipment.ward}, ${order.shipment.district}, ${order.shipment.province}`}
                        </span>
                      </div>
                      {order.returnRequest.returnAddress && (
                        <div className="flex justify-between items-start py-1 border-b border-emerald-100">
                          <span className="text-emerald-800 shrink-0">Địa chỉ Shop nhận lại:</span>
                          <span className="font-medium text-emerald-950 text-right max-w-xs">
                            {order.returnRequest.returnAddress}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-emerald-800 italic bg-white/70 p-2.5 rounded-lg border border-emerald-200">
                      Shipper sàn sẽ liên hệ tới số điện thoại <strong>{order.shipment.receiverPhone}</strong> để tới thu gom kiện hàng hoàn. Vui lòng đóng gói hàng cẩn thận và ghi rõ mã vận đơn hoàn <strong>{order.returnRequest.returnTrackingCode}</strong> bên ngoài kiện hàng.
                    </p>
                  </div>
                )}

                {/* 2. SELLER_REJECTED: Shop reject reason + Tag Hoàn hàng thất bại + Dispute button */}
                {order.returnRequest.returnStatus === "SELLER_REJECTED" && (
                  <div className="mt-4 rounded-xl border border-coral/30 bg-coral/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-coral font-bold text-sm">
                      <AlertCircle className="h-4 w-4 text-coral" />
                      <span>Hoàn hàng thất bại (Shop từ chối)</span>
                    </div>
                    <div className="text-xs sm:text-sm">
                      <span className="font-semibold text-ink">Lý do từ chối từ Shop: </span>
                      <span className="text-muted font-medium">{order.returnRequest.sellerRejectReason || "Shop không chấp nhận lý do hoàn hàng."}</span>
                    </div>
                    <p className="text-xs text-muted">
                      Nếu bạn không đồng ý với quyết định từ chối của Người bán, bạn có thể yêu cầu Ban quản trị Sàn can thiệp đối soát và bảo vệ quyền lợi.
                    </p>
                    {audience === "customer" && (
                      <div className="pt-1">
                        <Button
                          className="bg-coral hover:bg-coral/90 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm gap-1.5"
                          onClick={() => setShowDisputeModal(true)}
                        >
                          <Headset className="h-3.5 w-3.5" />
                          Yêu cầu Sàn can thiệp (Khiếu nại)
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. DISPUTED: Supporter handling dispute */}
                {order.returnRequest.returnStatus === "DISPUTED" && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                      <Headset className="h-4 w-4 text-amber-600" />
                      <span>Đang khiếu nại lên Sàn (Supporter đang xử lý)</span>
                    </div>
                    <div className="text-xs sm:text-sm">
                      <span className="font-semibold text-amber-950">Lý do khiếu nại của bạn: </span>
                      <span className="text-amber-900">{order.returnRequest.disputeReason}</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      Hồ sơ khiếu nại đang được Supporter tiếp nhận xử lý. Sàn sẽ kiểm tra bằng chứng của cả hai bên và đưa ra phán quyết trong thời gian sớm nhất.
                    </p>
                  </div>
                )}

                {/* 4. SUPPORT_APPROVED / COMPLETED / orderStatus === "RETURNED" */}
                {(order.returnRequest.returnStatus === "SUPPORT_APPROVED" || order.returnRequest.returnStatus === "COMPLETED" || order.orderStatus === "RETURNED") && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Hoàn tiền thành công vào Ví</span>
                    </div>
                    <p className="text-xs sm:text-sm text-emerald-800">
                      Yêu cầu hoàn tiền đã được xử lý hoàn tất. Số tiền <strong className="text-emerald-950">{formatVnd(order.totalAmount)}</strong> đã được hoàn lại thành công vào Ví tiền của bạn.
                    </p>
                    {order.returnRequest.supporterNote && (
                      <p className="text-xs text-emerald-700 bg-white/70 p-2 rounded-lg border border-emerald-200">
                        <strong>Ghi chú từ Supporter:</strong> {order.returnRequest.supporterNote}
                      </p>
                    )}
                  </div>
                )}

                {/* 5. SUPPORT_REJECTED */}
                {order.returnRequest.returnStatus === "SUPPORT_REJECTED" && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <AlertCircle className="h-4 w-4 text-slate-600" />
                      <span>Sàn bác bỏ khiếu nại</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Sau khi xem xét hồ sơ và đối soát bằng chứng từ hai bên, Supporter đã bác bỏ khiếu nại. Đơn hàng được xác nhận hoàn tất.
                    </p>
                    {order.returnRequest.supporterNote && (
                      <p className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                        <strong>Ghi chú từ Supporter:</strong> {order.returnRequest.supporterNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          )}

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
                    const isPaid = order.paymentStatus === "PAID" || payment?.paymentStatus === "PAID";
                    const paymentTime = isPaid
                      ? payment?.paidAt
                        ? formatDate(payment.paidAt)
                        : payment?.createdAt
                        ? formatDate(payment.createdAt)
                        : formatDate(order.createdAt)
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
                {audience === "customer" && (canContinuePayment(order) || canCustomerCancel(order) || canCustomerConfirmReceipt(order) || canCustomerReturn(order) || canCustomerDispute(order)) ? (
                  <div className="mt-5 grid gap-2 border-t border-line pt-5">
                    {canContinuePayment(order) ? (
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-xl shadow-sm" onClick={() => goToPaymentForOrder(order)}>
                        <CreditCard className="h-4 w-4" aria-hidden="true" />
                        Thanh toán ngay
                      </Button>
                    ) : null}
                    {canCustomerConfirmReceipt(order) ? (
                      <Button variant="secondary" className="w-full border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold h-11 rounded-xl shadow-sm" onClick={() => store.confirmCustomerReceipt(order.orderCode).then((res) => { if (res.ok) showToast("Đã xác nhận nhận hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>
                        <Check className="h-4 w-4" />
                        Đã nhận được hàng
                      </Button>
                    ) : null}
                    {canCustomerReturn(order) ? (
                      <Button variant="secondary" className="w-full border-coral/30 text-coral bg-coral/5 hover:bg-coral/10 font-bold h-11 rounded-xl shadow-sm" onClick={() => setShowReturnModal(true)}>
                        <RotateCcw className="h-4 w-4" />
                        Yêu cầu Trả hàng / Hoàn tiền
                      </Button>
                    ) : null}
                    {canCustomerDispute(order) ? (
                      <Button className="w-full bg-coral hover:bg-coral/90 text-white font-bold h-11 rounded-xl shadow-sm transition-colors" onClick={() => setShowDisputeModal(true)}>
                        <Headset className="h-4 w-4" />
                        Yêu cầu Sàn can thiệp (Khiếu nại)
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submittingReview) {
                setReviewingItem(null);
              }
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 id="review-modal-title" className="text-lg font-bold text-slate-900">Đánh giá sản phẩm</h3>
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
                           try {
                             const url = await uploadImage(file);
                             if (url) setImages(prev => [...prev, url]);
                           } catch (err: any) {
                             showToast(err.message || "Lỗi tải ảnh", "danger");
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
        {/* Return & Dispute Modals */}
        <ReturnRequestModal
          isOpen={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          orderCode={order.orderCode}
          onSuccess={() => store.fetchCustomerOrderDetail(order.orderCode)}
        />
        <DisputeModal
          isOpen={showDisputeModal}
          onClose={() => setShowDisputeModal(false)}
          orderCode={order.orderCode}
          onSuccess={() => store.fetchCustomerOrderDetail(order.orderCode)}
        />
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

function ReturnRequestModal({
  isOpen,
  onClose,
  orderCode,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  onSuccess?: () => void;
}) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const RETURN_REASONS = [
    "Sản phẩm bị lỗi / vỡ",
    "Giao sai sản phẩm / thiếu hàng",
    "Hàng giả / hàng nhái",
    "Sản phẩm khác xa mô tả",
    "Khác",
  ];

  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [description, setDescription] = useState("");
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason(RETURN_REASONS[0]);
      setDescription("");
      setEvidenceImages([]);
      setImageUrlInput("");
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (evidenceImages.length >= 5) {
      showToast("Tối đa 5 ảnh minh chứng.", "info");
      return;
    }
    setEvidenceImages((prev) => [...prev, trimmed]);
    setImageUrlInput("");
  };

  const handleRemoveImage = (index: number) => {
    setEvidenceImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showToast("Vui lòng nhập mô tả chi tiết lý do trả hàng.", "danger");
      return;
    }
    setSubmitting(true);
    try {
      const result = await store.requestOrderReturn(orderCode, {
        reason,
        description: description.trim(),
        evidence_images: evidenceImages.length > 0 ? evidenceImages : undefined,
      });
      if (result.ok) {
        showToast("Đã gửi yêu cầu trả hàng / hoàn tiền thành công!", "success");
        onSuccess?.();
        onClose();
      } else {
        showToast(result.message || "Lỗi khi gửi yêu cầu trả hàng.", "danger");
      }
    } catch (err: any) {
      showToast(err?.message || "Lỗi gửi yêu cầu trả hàng.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            <h3 id="return-modal-title" className="text-lg font-bold text-ink">
              Yêu cầu Trả hàng / Hoàn tiền
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-muted hover:text-ink hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-muted">
          Đơn hàng: <span className="font-mono font-bold text-ink">{orderCode}</span>. Vui lòng chọn lý do và cung cấp thông tin minh chứng để Shop và Sàn hỗ trợ xử lý nhanh nhất.
        </p>

        <Field label="Lý do trả hàng">
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="bg-canvas/50 border-line focus:bg-white rounded-xl h-11 text-sm font-semibold text-ink"
          >
            {RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Mô tả chi tiết vấn đề">
          <Textarea
            placeholder="Mô tả chi tiết tình trạng sản phẩm, lỗi gặp phải hoặc lý do bạn muốn trả hàng..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[100px] text-xs sm:text-sm"
          />
        </Field>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-2">
            Ảnh minh chứng (Tối đa 5 ảnh)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {evidenceImages.map((img, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg border border-line overflow-hidden group">
                <img src={img} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow"
                  title="Xóa ảnh"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {evidenceImages.length < 5 && (
              <div className="relative h-16 w-16 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors bg-slate-50 cursor-pointer group" title="Tải ảnh lên">
                {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span className="text-[9px] mt-0.5 font-medium">Tải ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploadingImage}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingImage(true);
                    try {
                      const url = await uploadImage(file);
                      if (url) setEvidenceImages((prev) => [...prev, url]);
                    } catch (err: any) {
                      showToast(err.message || "Lỗi tải ảnh minh chứng", "danger");
                    } finally {
                      setUploadingImage(false);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
            )}
          </div>

          {evidenceImages.length < 5 && (
            <div className="flex gap-2">
              <Input
                placeholder="Hoặc dán URL hình ảnh minh chứng..."
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="text-xs h-9 bg-canvas/50"
              />
              <Button
                variant="secondary"
                className="text-xs h-9 px-3 shrink-0 font-bold"
                onClick={handleAddImageUrl}
              >
                Thêm URL
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            Hủy
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-white font-bold"
            disabled={submitting || !description.trim()}
            onClick={handleSubmit}
          >
            {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DisputeModal({
  isOpen,
  onClose,
  orderCode,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  onSuccess?: () => void;
}) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [disputeReason, setDisputeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisputeReason("");
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!disputeReason.trim()) {
      showToast("Vui lòng nhập lý do khiếu nại gửi Supporter.", "danger");
      return;
    }
    setSubmitting(true);
    try {
      const result = await store.disputeOrderReturn(orderCode, {
        dispute_reason: disputeReason.trim(),
      });
      if (result.ok) {
        showToast("Đã gửi khiếu nại lên Sàn thành công. Supporter sẽ hỗ trợ xử lý!", "success");
        onSuccess?.();
        onClose();
      } else {
        showToast(result.message || "Lỗi khi gửi khiếu nại.", "danger");
      }
    } catch (err: any) {
      showToast(err?.message || "Lỗi gửi khiếu nại.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Headset className="h-5 w-5 text-coral" />
            <h3 id="dispute-modal-title" className="text-lg font-bold text-ink">
              Yêu cầu Sàn can thiệp (Khiếu nại)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-muted hover:text-ink hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-muted">
          Đơn hàng: <span className="font-mono font-bold text-ink">{orderCode}</span>. Nếu Shop từ chối trả hàng không hợp lý, Supporter sàn sẽ đối soát bằng chứng giữa hai bên và đưa ra phán quyết bảo vệ quyền lợi người mua.
        </p>

        <Field label="Lý do khiếu nại gửi Supporter">
          <Textarea
            placeholder="Nêu rõ lý do bạn không đồng ý với quyết định từ chối của Shop và yêu cầu bồi hoàn..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            className="min-h-[120px] text-xs sm:text-sm"
          />
        </Field>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            Hủy
          </Button>
          <Button
            className="bg-coral hover:bg-coral/90 text-white font-bold"
            disabled={submitting || !disputeReason.trim()}
            onClick={handleSubmit}
          >
            {submitting ? "Đang gửi khiếu nại..." : "Gửi khiếu nại"}
          </Button>
        </div>
      </div>
    </div>
  );
}
