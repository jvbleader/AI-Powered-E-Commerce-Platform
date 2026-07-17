"use client";

import { CreditCard, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { formatVnd } from "@/lib/helpers";

export default function CheckoutSuccessPage() {
  const store = useMarketplaceStore();
  const payment = store.state.payments.find((item) => item.paymentCode === store.state.lastCheckoutPaymentCode) ?? store.state.payments[0];

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-panel border border-line bg-white p-3 text-left">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-semibold text-ink">{value}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Panel className="text-center">
        <PackageCheck className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
        <h1 className="mt-3 text-3xl font-black text-ink">Đặt hàng thành công</h1>
        <p className="mt-2 text-sm text-muted">Bạn có thể tiếp tục thanh toán hoặc xem đơn hàng.</p>
        {payment ? (
          <div className="mt-5 grid gap-2">
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
