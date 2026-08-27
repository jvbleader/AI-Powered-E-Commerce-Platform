"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Home, Loader2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/containers";
import { EmptyState } from "@/components/ui/feedback";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { formatVnd, paymentMethodLabel, paymentStatusLabel } from "@/lib/helpers";
import { walletApi } from "@/services/wallet-api";
import type { PaymentStatus } from "@/types/models";

export default function CheckoutSuccessPage() {
  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;
  const [paying, setPaying] = useState(false);
  const [walletPin, setWalletPin] = useState("");

  const orderCodes = store.state.lastCheckoutOrderCodes ?? [];
  const paymentMethod = store.state.lastCheckoutPaymentMethod ?? "VNPAY";

  // Luôn làm mới thông tin đơn hàng khi vào trang để có paymentStatus mới nhất
  useEffect(() => {
    if (!orderCodes.length || !store.ready) return;
    for (const code of orderCodes) {
      store.fetchCustomerOrderDetail(code);
    }
  }, [orderCodes, store.ready]);

  const orders = useMemo(
    () => store.state.orders.filter((order) => orderCodes.includes(order.orderCode)),
    [store.state.orders, orderCodes]
  );

  const isAllPaid = orders.length > 0 && orders.every((order) => order.paymentStatus === "PAID");
  const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const viewOrderHref =
    orderCodes.length === 1 ? `/account/orders/${orderCodes[0]}` : "/account/orders";

  async function handlePayNow() {
    if (!orderCodes.length || isAllPaid) return;

    if (paymentMethod === "WALLET") {
      if (walletPin.length !== 6) {
        showToast("Vui lòng nhập mã PIN gồm 6 chữ số.", "danger");
        return;
      }
      setPaying(true);
      try {
        const raw = await walletApi.payWithWallet(orderCodes, walletPin);
        await store.updatePaymentStatus(raw.payment_code, raw.payment_status as PaymentStatus);
        showToast("Thanh toán bằng ví thành công!", "success");
        router.push(`/payment/${raw.payment_code}`);
      } catch (err: any) {
        showToast(err?.message || "Lỗi khi thanh toán bằng ví.", "danger");
        setPaying(false);
      }
      return;
    }

    setPaying(true);
    try {
      const result = await store.createCheckoutPayment(orderCodes, paymentMethod);
      showToast(result.message, result.ok ? "success" : "danger");
      if (result.ok) {
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        router.push(`/payment/${result.paymentCode}`);
      } else {
        setPaying(false);
      }
    } catch {
      showToast("Lỗi khi tạo thanh toán.", "danger");
      setPaying(false);
    }
  }

  if (!store.ready) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm text-muted">Đang tải...</p>
      </main>
    );
  }

  if (!orderCodes.length) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="Không tìm thấy thông tin đơn hàng"
          description="Vui lòng đặt hàng từ giỏ hàng hoặc xem danh sách đơn hàng của bạn."
          action={<Button onClick={() => router.push("/account/orders")}>Xem đơn hàng</Button>}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Panel className="text-center">
        {isAllPaid ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
        ) : (
          <PackageCheck className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
        )}

        <h1 className="mt-3 text-3xl font-black text-ink">
          {isAllPaid ? "Đặt hàng & Thanh toán thành công" : "Đặt hàng thành công"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {paymentMethod === "COD"
            ? "Đơn hàng của bạn đã được ghi nhận với hình thức Thanh toán khi nhận hàng (COD). Bạn sẽ thanh toán trực tiếp bằng tiền mặt cho nhân viên giao hàng khi nhận kiện hàng."
            : isAllPaid
            ? "Đơn hàng của bạn đã được thanh toán thành công. Người bán sẽ sớm chuẩn bị và giao hàng cho bạn."
            : "Đơn hàng đã được tạo. Bạn có thể thanh toán ngay hoặc thanh toán sau trong mục đơn hàng."}
        </p>

        <div className="mt-5 grid gap-2">
          <InfoRow label="Mã đơn hàng" value={orderCodes.join(", ")} />
          <InfoRow label="Số đơn" value={`${orderCodes.length}`} />
          <InfoRow label="Tổng tiền" value={formatVnd(totalAmount)} />
          <InfoRow label="Phương thức thanh toán" value={paymentMethodLabel[paymentMethod]} />
          <InfoRow
            label="Trạng thái thanh toán"
            value={
              paymentMethod === "COD"
                ? "Chờ thanh toán khi nhận hàng"
                : isAllPaid
                ? "Đã thanh toán thành công"
                : "Chờ thanh toán"
            }
          />
        </div>

        {!isAllPaid && paymentMethod === "WALLET" && (
          <div className="mx-auto mt-6 max-w-xs text-left">
            <Field label="Nhập mã PIN ví (6 chữ số)">
              <Input
                type="password"
                maxLength={6}
                inputMode="numeric"
                value={walletPin}
                onChange={(e) => setWalletPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Nhập 6 chữ số PIN"
                className="text-center tracking-widest text-lg font-mono"
              />
            </Field>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {!isAllPaid && paymentMethod !== "COD" && (
            <Button disabled={paying} onClick={handlePayNow}>
              {paying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              )}
              {paying ? "Đang xử lý..." : "Thanh toán ngay"}
            </Button>
          )}
          <Button
            variant={isAllPaid || paymentMethod === "COD" ? "primary" : "secondary"}
            onClick={() => router.push(viewOrderHref)}
          >
            Xem đơn hàng
          </Button>
          <Button variant="secondary" onClick={() => router.push("/")}>
            <Home className="h-4 w-4" aria-hidden="true" />
            Về trang chủ
          </Button>
        </div>
      </Panel>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3 text-left">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}
