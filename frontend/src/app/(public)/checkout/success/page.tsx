"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Home, Loader2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/containers";
import { EmptyState } from "@/components/ui/feedback";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { formatVnd, paymentMethodLabel } from "@/lib/helpers";

export default function CheckoutSuccessPage() {
  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;
  const [paying, setPaying] = useState(false);

  const orderCodes = store.state.lastCheckoutOrderCodes ?? [];
  const paymentMethod = store.state.lastCheckoutPaymentMethod ?? "MOCK";

  const orders = useMemo(
    () => store.state.orders.filter((order) => orderCodes.includes(order.orderCode)),
    [store.state.orders, orderCodes]
  );

  const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const viewOrderHref =
    orderCodes.length === 1 ? `/account/orders/${orderCodes[0]}` : "/account/orders";

  async function handlePayNow() {
    if (!orderCodes.length) return;
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
        <PackageCheck className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
        <h1 className="mt-3 text-3xl font-black text-ink">Đặt hàng thành công</h1>
        <p className="mt-2 text-sm text-muted">
          Đơn hàng đã được tạo. Bạn có thể thanh toán ngay hoặc thanh toán sau trong mục đơn hàng.
        </p>

        <div className="mt-5 grid gap-2">
          <InfoRow label="Mã đơn hàng" value={orderCodes.join(", ")} />
          <InfoRow label="Số đơn" value={`${orderCodes.length}`} />
          <InfoRow label="Tổng tiền" value={formatVnd(totalAmount)} />
          <InfoRow label="Phương thức thanh toán" value={paymentMethodLabel[paymentMethod]} />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button disabled={paying} onClick={handlePayNow}>
            {paying ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            )}
            {paying ? "Đang xử lý..." : "Thanh toán ngay"}
          </Button>
          <Button variant="secondary" onClick={() => router.push(viewOrderHref)}>
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
