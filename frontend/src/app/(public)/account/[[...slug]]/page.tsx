"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bell, CreditCard, LogOut, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import {
  MetricCard,
  OrderTimeline,
  RatingStars
} from "@/components/shared/cards";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import {
  formatDate,
  formatVnd,
  getCategoryNames,
  orderStatusLabel,
  paymentStatusLabel,
  roleLabel,
  sellerStatusLabel,
  canCustomerCancel,
  canCustomerConfirmReceipt,
  canSellerCancel,
  canSellerConfirm,
  canSellerShip
} from "@/lib/helpers";
import Unauthorized from "@/components/shared/unauthorized-page";
import type { Address, AddressType, Order, OrderStatus, Product, ProductVariant, Shop } from "@/types/models";

const linkClass =
  "inline-flex min-h-10 items-center gap-2 rounded-panel px-3 py-2 text-sm font-semibold text-muted transition hover:bg-white hover:text-primary";
const activeLinkClass = "bg-white text-primary shadow-sm";

export default function AccountPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[] | undefined;
  const currentSection = slug?.[0] ?? "overview";
  const detailId = slug?.[1];

  const store = useMarketplaceStore();
  const { showToast } = store;

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Tài khoản cần đăng nhập" description="Vui lòng đăng nhập để xem thông tin cá nhân." />;
  }

  const user = store.getCurrentUser()!;

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
          <img src={user.avatarUrl} alt={user.fullName} className="h-12 w-12 rounded-panel object-cover" />
          <div className="min-w-0">
            <p className="truncate font-bold">{user.fullName}</p>
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
        {currentSection === "profile" ? <AccountProfileWrapper /> : null}
        {currentSection === "security" ? <AccountSecurity /> : null}
        {currentSection === "addresses" ? <AddressBook /> : null}
        {currentSection === "orders" && detailId ? <OrderDetailPage orderCode={detailId} audience="customer" /> : null}
        {currentSection === "orders" && !detailId ? <OrdersList audience="customer" /> : null}
        {currentSection === "notifications" ? <NotificationsPage /> : null}
        {currentSection === "reviews" ? <ReviewsModule /> : null}
      </div>
    </main>
  );

  function AccountProfileWrapper() {
    return <AccountProfile store={store} showToast={showToast} />;
  }

  function AccountOverview() {
    const userOrders = store.state.orders.filter((order) => order.userId === store.getCurrentUser()?.id);
    return (
      <Section title="Tổng quan tài khoản">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Đơn hàng" value={`${userOrders.length}`} />
          <MetricCard label="Địa chỉ" value={`${store.state.addresses.filter((item) => item.userId === store.getCurrentUser()?.id).length}`} />
          <MetricCard label="Email" value={store.getCurrentUser()?.emailVerified ? "Đã xác thực" : "Chưa xác thực"} />
          <MetricCard label="Số điện thoại" value={store.getCurrentUser()?.phoneVerified ? "Đã xác thực" : "Chưa xác thực"} />
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

  function AddressForm({ onSuccess, editingAddress, onCancel }: { onSuccess?: () => void, editingAddress?: Address, onCancel?: () => void }) {
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
      let success = false;
      if (editingAddress) {
        success = await store.updateAddress(editingAddress.id, {
          receiverName, phone, province, district, ward, detailAddress, addressType, isDefault: editingAddress.isDefault
        });
      } else {
        success = await store.addAddress({
          receiverName, phone, province, district, ward, detailAddress, addressType, isDefault: false
        });
      }
      
      if (success) {
        showToast(editingAddress ? "Đã cập nhật địa chỉ" : "Đã thêm địa chỉ", "success");
        if (!editingAddress) {
          setReceiverName(""); setPhone(""); setProvince(""); setDistrict(""); setWard(""); setDetailAddress("");
        }
        onSuccess?.();
      } else {
        showToast(editingAddress ? "Cập nhật địa chỉ thất bại" : "Thêm địa chỉ thất bại", "danger");
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
        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit}>{editingAddress ? "Cập nhật" : "Thêm"}</Button>
          {onCancel && <Button variant="secondary" onClick={onCancel}>Hủy</Button>}
        </div>
      </div>
    );
  }

  function AddressBook() {
    const addresses = store.state.addresses.filter((address) => address.userId === store.getCurrentUser()?.id);
    const [editingId, setEditingId] = useState<string | null>(null);
    const editingAddress = addresses.find(a => a.id === editingId);

    return (
      <Section title="Địa chỉ giao hàng">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-3">
            {addresses.map((address) => (
              <Panel key={address.id}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{address.receiverName} - {address.phone}</p>
                      <p className="mt-1 text-sm text-muted">{address.detailAddress}, {address.ward}, {address.district}, {address.province}</p>
                    </div>
                    <StatusBadge status={address.isDefault ? "ACTIVE" : "HIDDEN"} label={address.isDefault ? "Mặc định" : address.addressType} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setEditingId(address.id)}>Sửa</Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
          <Panel>
            <h3 className="font-bold">{editingAddress ? "Sửa địa chỉ" : "Thêm địa chỉ"}</h3>
            <AddressForm 
              editingAddress={editingAddress} 
              onSuccess={() => setEditingId(null)}
              onCancel={editingAddress ? () => setEditingId(null) : undefined}
            />
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
      } else {
        store.fetchCustomerOrders(status as OrderStatus | "");
      }
    }, [audience, status]);

    const orders = store.state.orders.filter((order) => {
      const belongs = audience === "customer" ? order.userId === store.getCurrentUser()?.id : order.sellerId === store.getCurrentShop()?.id;
      return belongs && (!status || order.orderStatus === status);
    });

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

    const shopById = (id?: string) => {
      return store.state.shops.find((shop) => shop.id === id);
    };

    const renderOrderAction = (order: Order) => {
      if (audience !== "customer") {
        const showConfirm = canSellerConfirm(order);
        const showShip = canSellerShip(order);
        const showCancel = canSellerCancel(order);

        if (!showConfirm && !showShip && !showCancel) return <span className="text-muted">Theo dõi</span>;

        return (
          <div className="flex flex-wrap gap-2">
            {showConfirm ? <Button onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Xác nhận</Button> : null}
            {showShip ? <Button variant="secondary" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã chuyển shipping.", "success"); else showToast(res.message || "Lỗi chuyển shipping", "danger"); })}>Giao hàng</Button> : null}
            {showCancel ? <Button variant="danger" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })}>Từ chối</Button> : null}
          </div>
        );
      }

      const showPayment = canContinuePayment(order);
      const showCancel = canCustomerCancel(order);
      const showReceipt = canCustomerConfirmReceipt(order);
      if (!showPayment && !showCancel && !showReceipt) return <span className="text-muted">Theo dõi</span>;

      return (
        <div className="flex flex-wrap gap-2">
          {showPayment ? (
            <Button onClick={() => goToPaymentForOrder(order)}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Thanh toán
            </Button>
          ) : null}
          {showReceipt ? <Button variant="secondary" onClick={() => store.confirmCustomerReceipt(order.orderCode).then((res) => { if (res.ok) showToast("Đã xác nhận nhận hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Đã nhận hàng</Button> : null}
          {showCancel ? <Button variant="danger" onClick={() => store.cancelCustomerOrder(order.orderCode).then((res) => { if (res.ok) showToast("Đã hủy đơn hàng.", "success"); else showToast(res.message || "Lỗi hủy đơn", "danger"); })}>Hủy</Button> : null}
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
    const order = store.state.orders.find((item) => (audience === "customer" ? item.orderCode === orderCode : item.id === orderCode || item.orderCode === orderCode));
    
    useEffect(() => {
      if (!order && orderCode) {
        if (audience === "customer") {
          store.fetchCustomerOrderDetail(orderCode);
        } else {
          store.fetchSellerOrderDetail(orderCode);
        }
      }
    }, [order, orderCode, audience]);

    if (!order) return <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>;

    const shopById = (id?: string) => {
      return store.state.shops.find((shop) => shop.id === id);
    };

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
            {audience === "customer" && (canContinuePayment(order) || canCustomerCancel(order) || canCustomerConfirmReceipt(order)) ? (
              <div className="mt-4 grid gap-2">
                {canContinuePayment(order) ? (
                  <Button onClick={() => goToPaymentForOrder(order)}>
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    Thanh toán
                  </Button>
                ) : null}
                {canCustomerConfirmReceipt(order) ? (
                  <Button variant="secondary" onClick={() => store.confirmCustomerReceipt(order.orderCode).then((res) => { if (res.ok) showToast("Đã xác nhận nhận hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Đã nhận hàng</Button>
                ) : null}
                {canCustomerCancel(order) ? <Button variant="danger" onClick={() => store.cancelCustomerOrder(order.orderCode).then((res) => { if (res.ok) showToast("Đã hủy đơn hàng.", "success"); else showToast(res.message || "Lỗi hủy đơn", "danger"); })}>Hủy đơn</Button> : null}
              </div>
            ) : null}
            {audience === "seller" && (canSellerConfirm(order) || canSellerShip(order) || canSellerCancel(order)) ? (
              <div className="mt-4 grid gap-2">
                {canSellerConfirm(order) ? (
                  <Button onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Xác nhận đơn</Button>
                ) : null}
                {canSellerShip(order) ? (
                  <Button variant="secondary" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã chuyển shipping.", "success"); else showToast(res.message || "Lỗi chuyển shipping", "danger"); })}>Chuyển shipping</Button>
                ) : null}
                {canSellerCancel(order) ? (
                  <Button variant="danger" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })}>Từ chối đơn</Button>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </div>
      </Section>
    );
  }

  function NotificationsPage() {
    const notifications = store.state.notifications.filter((item) => item.userId === store.getCurrentUser()?.id);
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

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-panel border border-line bg-white p-3">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-semibold text-ink">{value}</p>
      </div>
    );
  }
}

function AccountProfile({ store, showToast }: { store: any, showToast: any }) {
  const user = store.getCurrentUser();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [gender, setGender] = useState(user?.gender ?? "OTHER");
  const [birthday, setBirthday] = useState(user?.birthday || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setGender(user.gender ?? "OTHER");
      setBirthday(user.birthday || "");
    }
  }, [user]);

  if (!user) return <Section title="Hồ sơ cá nhân"><p>Vui lòng đăng nhập</p></Section>;

  const handleSave = async () => {
    setSubmitting(true);
    const res = await store.updateProfile({
      fullName,
      gender,
      dateOfBirth: birthday || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("Đã lưu hồ sơ.", "success");
    } else {
      showToast(res.message || "Lỗi lưu hồ sơ.", "danger");
    }
  };

  return (
    <Section title="Hồ sơ cá nhân">
      <Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Họ tên"><Input value={fullName} onChange={e => setFullName(e.target.value)} /></Field>
          <Field label="Email"><Input defaultValue={user.email} disabled className="opacity-70" /></Field>
          <Field label="Số điện thoại"><Input defaultValue={user.phone} disabled className="opacity-70" /></Field>
          <Field label="Giới tính">
            <Select value={gender} onChange={e => setGender(e.target.value)}>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </Select>
          </Field>
          <Field label="Ngày sinh"><Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} /></Field>
          <Field label="Avatar"><Input type="file" disabled className="opacity-70" /></Field>
        </div>
        <Button className="mt-4" disabled={submitting} onClick={handleSave}>
          {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
        </Button>
      </Panel>
    </Section>
  );
}
