"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Home, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { paymentStatusLabel, paymentMethodLabel, orderStatusLabel, formatVnd, formatDate } from "@/lib/helpers";
import { paymentApi } from "@/services/payment-api";
import NotFoundPage from "@/components/shared/not-found-page";
import { PaymentLoading } from "./payment-loading";

type PaymentPageClientProps = {
  paymentCode: string;
};

export default function PaymentPageClient({ paymentCode }: PaymentPageClientProps) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const ready = store.ready;
  const fetchPaymentDetail = useMarketplaceStore((s) => s.fetchPaymentDetail);
  const [resuming, setResuming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const payment = store.state.payments.find((item) => item.paymentCode === paymentCode);

  useEffect(() => {
    if (!paymentCode) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    if (!ready) return;

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    // Luôn fetch lại từ API — store có thể còn PENDING sau khi IPN đã PAID.
    fetchPaymentDetail(paymentCode).then((result) => {
      if (cancelled) return;
      setLoading(false);
      setNotFound(!result.ok);
    });

    return () => {
      cancelled = true;
    };
  }, [paymentCode, ready, fetchPaymentDetail]);

  if (!paymentCode || notFound) return <NotFoundPage />;

  if (!ready || loading || !payment) return <PaymentLoading />;

  const linkedOrders = store.state.orders.filter((order) => payment.orderCodes.includes(order.orderCode));
  const canPayPayment = payment.paymentStatus === "PENDING" || payment.paymentStatus === "FAILED";
  const isVNPay = payment.paymentMethod === "VNPAY";
  const canMockPay = canPayPayment && !isVNPay && payment.paymentMethod === "MOCK";
  const canResumeVNPay = isVNPay && payment.paymentStatus === "PENDING";

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
                <Link
                  key={order.id}
                  href={`/account/orders/${order.orderCode}`}
                  className="flex items-center justify-between rounded-panel border border-line p-3 hover:border-primary/40"
                >
                  <span className="font-bold">{order.orderCode}</span>
                  <StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />
                </Link>
              ))}
            </div>
          </Panel>
          <Panel className="h-fit">
            <h3 className="font-bold">Hành động</h3>
            <div className="mt-3 grid gap-2">
              {isVNPay && payment.paymentStatus === "PENDING" ? (
                <p className="rounded-panel border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                  Thanh toán VNPay chưa hoàn tất. Bạn có thể tiếp tục thanh toán nếu giao dịch vẫn còn hiệu lực.
                </p>
              ) : null}
              {canResumeVNPay ? (
                <Button
                  disabled={resuming}
                  onClick={async () => {
                    setResuming(true);
                    try {
                      const res = await paymentApi.resumeVNPayPayment(payment.paymentCode);
                      window.location.href = res.payment_url;
                    } catch {
                      showToast("Không thể tạo lại liên kết VNPay. Vui lòng thử lại hoặc đặt hàng mới.", "danger");
                      setResuming(false);
                    }
                  }}
                >
                  {resuming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
                  {resuming ? "Đang chuyển hướng..." : "Tiếp tục thanh toán VNPay"}
                </Button>
              ) : null}
              {canMockPay ? (
                <Button
                  onClick={async () => {
                    try {
                      await paymentApi.mockCallback({ payment_code: payment.paymentCode, status: "PAID" });
                      store.updatePaymentStatus(payment.paymentCode, "PAID");
                      showToast("Đã thanh toán đơn hàng.", "success");
                    } catch {
                      showToast("Lỗi khi thanh toán đơn hàng.", "danger");
                    }
                  }}
                >
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Thanh toán ngay
                </Button>
              ) : null}
              {payment.paymentStatus === "PAID" ? (
                <Button disabled>
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Đã thanh toán
                </Button>
              ) : null}
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
