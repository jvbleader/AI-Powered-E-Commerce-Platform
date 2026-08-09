"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Radio, Select, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { EmptyState } from "@/components/ui/feedback";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { selectedCheckoutGroups, paymentMethodLabel, formatVnd } from "@/lib/helpers";
import type { Address, AddressType, PaymentMethod } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function CheckoutPage() {
  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;
  const user = store.getCurrentUser();

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [addressId, setAddressId] = useState(
    store.state.addresses.find((item) => item.userId === user?.id && item.isDefault)?.id ?? ""
  );
  const [method, setMethod] = useState<PaymentMethod>("MOCK");
  const [note, setNote] = useState("");
  const [coupon, setCoupon] = useState("");
  const [shipCoupon, setShipCoupon] = useState("");

  const rows = store.getCartRows();
  const groups = selectedCheckoutGroups(rows);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const addresses = store.state.addresses.filter((address) => address.userId === user?.id);

  const [editingId, setEditingId] = useState<string | null>(null);
  const editingAddress = addresses.find((a) => a.id === editingId);

  useEffect(() => {
    if (!addressId && addresses.length > 0) {
      setAddressId(addresses[0].id);
    }
  }, [addresses, addressId]);

  if (!store.ready) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium text-muted">Đang tải thông tin thanh toán...</p>
      </main>
    );
  }

  if (!user) {
    return <Unauthorized title="Checkout cần đăng nhập" description="Vui lòng đăng nhập để đặt hàng." />;
  }

  if (isOrdering) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center">
        <Panel className="mx-auto max-w-md p-8">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600 mb-4" />
          <h2 className="text-lg font-bold text-ink mb-1">Đang xử lý đơn hàng</h2>
          <p className="text-sm text-muted">Vui lòng chờ trong giây lát, hệ thống đang tạo đơn hàng...</p>
        </Panel>
      </main>
    );
  }

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
                    <div key={address.id} className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Radio
                          name="address"
                          checked={addressId === address.id}
                          onChange={() => setAddressId(address.id)}
                          label={`${address.receiverName} - ${address.phone} - ${address.detailAddress}, ${address.ward}, ${address.district}, ${address.province}`}
                        />
                      </div>
                      <Button variant="ghost" className="h-auto p-1 text-sm text-primary" onClick={() => { setEditingId(address.id); setShowAddressForm(true); }}>
                        Sửa
                      </Button>
                    </div>
                  ))}
                  {!showAddressForm ? (
                    <Button variant="secondary" onClick={() => { setEditingId(null); setShowAddressForm(true); }}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Thêm địa chỉ
                    </Button>
                  ) : (
                    <div className="mt-4 rounded-panel bg-neutral-50 p-4 dark:bg-neutral-800/50">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-bold">{editingAddress ? "Sửa địa chỉ" : "Địa chỉ mới"}</h4>
                        <Button variant="ghost" className="h-auto p-1 text-sm" onClick={() => { setShowAddressForm(false); setEditingId(null); }}>Hủy</Button>
                      </div>
                      <AddressForm 
                        editingAddress={editingAddress} 
                        onSuccess={() => { setShowAddressForm(false); setEditingId(null); }} 
                        onCancel={() => { setShowAddressForm(false); setEditingId(null); }} 
                      />
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
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú giao hàng" maxLength={500} />
                </Field>
                <Field label="Mã giảm tiền">
                  <Input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="Tối đa 1 mã" />
                </Field>
                <Field label="Mã giảm ship">
                  <Input value={shipCoupon} onChange={(event) => setShipCoupon(event.target.value)} placeholder="Tối đa 1 mã" />
                </Field>
                <Field label="Phương thức thanh toán">
                  <Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                    {/* Chỉ liệt kê phương thức đã tích hợp end-to-end (tránh BANK_TRANSFER/MOMO chưa có gateway). */}
                    {(["MOCK", "VNPAY"] as PaymentMethod[]).map((key) => (
                      <option key={key} value={key}>{paymentMethodLabel[key]}</option>
                    ))}
                  </Select>
                </Field>
                <InfoRow label="Số đơn hàng" value={`${groups.length}`} />
                <InfoRow label="Tổng thanh toán" value={formatVnd(total)} />
                <Button
                  disabled={!addressId || isOrdering}
                  onClick={async () => {
                    setIsOrdering(true);
                    try {
                      const result = await store.checkout(addressId, method, note);
                      showToast(result.message, result.ok ? "success" : "danger");
                      if (result.ok) {
                        router.push("/checkout/success");
                      } else {
                        setIsOrdering(false);
                      }
                    } catch (e) {
                      setIsOrdering(false);
                    }
                  }}
                >
                  {isOrdering ? "Đang đặt hàng..." : "Đặt hàng"}
                </Button>
              </div>
            </Panel>
          </div>
        ) : (
          <EmptyState
            title="Chưa có item để checkout"
            description="Chọn ít nhất một item hợp lệ trong giỏ hàng."
            action={<Button onClick={() => router.push("/cart")}>Về giỏ hàng</Button>}
          />
        )}
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

function AddressForm({ onSuccess, editingAddress, onCancel }: { onSuccess?: () => void, editingAddress?: Address, onCancel?: () => void }) {
  const store = useMarketplaceStore();
  const { showToast } = store;

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
      <Field label="Người nhận">
        <Input placeholder="Nhập tên người nhận" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
      </Field>
      <Field label="Số điện thoại">
        <Input placeholder="Nhập số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Tỉnh/Thành phố">
        <Input placeholder="Nhập tỉnh/thành" value={province} onChange={(e) => setProvince(e.target.value)} />
      </Field>
      <Field label="Quận/Huyện">
        <Input placeholder="Nhập quận/huyện" value={district} onChange={(e) => setDistrict(e.target.value)} />
      </Field>
      <Field label="Phường/Xã">
        <Input placeholder="Nhập phường/xã" value={ward} onChange={(e) => setWard(e.target.value)} />
      </Field>
      <Field label="Địa chỉ chi tiết">
        <Textarea placeholder="Số nhà, tên đường..." value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} />
      </Field>
      <Field label="Loại địa chỉ">
        <Select value={addressType} onChange={(e) => setAddressType(e.target.value as AddressType)}>
          <option value="HOME">Nhà riêng</option>
          <option value="OFFICE">Văn phòng</option>
        </Select>
      </Field>
      <div className="flex items-center gap-2">
        <Button onClick={handleSubmit}>{editingAddress ? "Cập nhật" : "Thêm"}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel}>Hủy</Button>}
      </div>
    </div>
  );
}
