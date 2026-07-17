"use client";

import { useParams } from "next/navigation";
import { CreditCard, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { paymentStatusLabel, paymentMethodLabel, orderStatusLabel, formatVnd, formatDate } from "@/lib/helpers";
import { paymentApi } from "@/services/payment-api";
import NotFoundPage from "@/components/shared/not-found-page";

export default function PaymentPage() {
  const params = useParams();
  const paymentCode = typeof params.paymentCode === "string" ? params.paymentCode : "";
  const store = useMarketplaceStore();
  const { showToast } = store;

  const payment = store.state.payments.find((item) => item.paymentCode === paymentCode) ?? store.state.payments[0];
  if (!payment) return <NotFoundPage />;

  const linkedOrders = store.state.orders.filter((order) => payment.orderCodes.includes(order.orderCode));
  const canPayPayment = payment.paymentStatus === "PENDING" || payment.paymentStatus === "FAILED";

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-panel border border-line bg-white p-3">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-semibold text-ink">{value}</p>
      </div>
    );
  }

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
              <Button 
                disabled={!canPayPayment} 
                onClick={async () => {
                  try {
                    await paymentApi.mockCallback({ payment_code: payment.paymentCode, status: "PAID" });
                    store.updatePaymentStatus(payment.paymentCode, "PAID"); 
                    showToast("Đã thanh toán đơn hàng.", "success"); 
                  } catch (err) {
                    showToast("Lỗi khi thanh toán đơn hàng.", "danger");
                  }
                }}
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                {payment.paymentStatus === "PAID" ? "Đã thanh toán" : "Thanh toán ngay"}
              </Button>
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
