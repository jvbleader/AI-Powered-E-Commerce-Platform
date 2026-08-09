"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ready = useMarketplaceStore((s) => s.ready);
  const payments = useMarketplaceStore((s) => s.state.payments);
  const fetchPaymentDetail = useMarketplaceStore((s) => s.fetchPaymentDetail);

  const status = searchParams.get("status");
  const paymentCode = searchParams.get("payment_code") ?? "";

  const isSuccess = status === "success";

  const payment = useMemo(
    () => payments.find((item) => item.paymentCode === paymentCode),
    [payments, paymentCode]
  );

  // Đồng bộ payment từ API; cache đơn sẽ bị invalidate trong fetchPaymentDetail.
  useEffect(() => {
    if (!paymentCode || !ready) return;
    void fetchPaymentDetail(paymentCode);
  }, [paymentCode, ready, fetchPaymentDetail]);

  if (!paymentCode) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <Panel className="p-8">
          <XCircle className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold">Không tìm thấy thông tin thanh toán</h1>
          <Button className="mt-6" onClick={() => router.push("/")}>Về trang chủ</Button>
        </Panel>
      </main>
    );
  }

  if (!status) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted">Đang xử lý kết quả thanh toán...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <Panel className="p-8 text-center">
        {isSuccess ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
        )}
        <h1 className="mt-4 text-2xl font-black text-ink">
          {isSuccess ? "Giao dịch tại VNPay thành công" : "Thanh toán không thành công"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isSuccess
            ? "VNPay đã ghi nhận thanh toán. Đơn hàng sẽ chuyển sang đã thanh toán sau khi hệ thống nhận IPN (thường trong vài giây)."
            : "Giao dịch chưa hoàn tất hoặc đã bị hủy. Nếu vẫn còn chờ thanh toán, mở chi tiết thanh toán để tiếp tục VNPay; nếu đã thất bại hãy đặt hàng lại."}
        </p>
        <div className="mt-5 rounded-panel border border-line bg-white p-3 text-left text-sm">
          <p><span className="text-muted">Mã thanh toán:</span> <strong>{paymentCode}</strong></p>
          {payment ? (
            <p className="mt-1"><span className="text-muted">Số tiền:</span> <strong>{payment.amount.toLocaleString("vi-VN")} ₫</strong></p>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => router.push(`/payment/${paymentCode}`)}>Chi tiết thanh toán</Button>
          <Button variant="secondary" onClick={() => router.push("/account/orders")}>Xem đơn hàng</Button>
        </div>
      </Panel>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted">Đang xử lý kết quả thanh toán...</p>
        </main>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
