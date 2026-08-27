"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Home, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { paymentStatusLabel, paymentMethodLabel, orderStatusLabel, formatVnd, formatDate, parseApiDateTime } from "@/lib/helpers";
import { paymentApi } from "@/services/payment-api";
import { walletApi, type WalletInfo } from "@/services/wallet-api";
import { Field, Input } from "@/components/ui/input";
import NotFoundPage from "@/components/shared/not-found-page";
import { PaymentLoading } from "./payment-loading";

type PaymentPageClientProps = {
  paymentCode: string;
};

export default function PaymentPageClient({ paymentCode }: PaymentPageClientProps) {
  const router = useRouter();
  const store = useMarketplaceStore();
  const { showToast } = store;
  const ready = store.ready;
  const fetchPaymentDetail = useMarketplaceStore((s) => s.fetchPaymentDetail);
  const [resuming, setResuming] = useState(false);
  const [walletPaying, setWalletPaying] = useState(false);
  const [walletPin, setWalletPin] = useState("");
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
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

  const isWallet = payment?.paymentMethod === "WALLET";

  useEffect(() => {
    if (isWallet && ready) {
      setLoadingWallet(true);
      walletApi
        .getWallet()
        .then((data) => setWalletInfo({ ...data, balance: Number(data.balance) }))
        .catch(() => {})
        .finally(() => setLoadingWallet(false));
    }
  }, [isWallet, ready]);

  if (!paymentCode || notFound) return <NotFoundPage />;

  if (!ready || loading || !payment) return <PaymentLoading />;

  const linkedOrders = store.state.orders.filter((order) => payment.orderCodes.includes(order.orderCode));
  const isExpired = (parseApiDateTime(payment.expiresAt)?.getTime() || 0) < Date.now();
  const hasCancelledOrder = linkedOrders.some((order) => order.orderStatus === "CANCELLED");
  const canPayPayment = (payment.paymentStatus === "PENDING" || payment.paymentStatus === "FAILED") && !isExpired && !hasCancelledOrder;
  const isVNPay = payment.paymentMethod === "VNPAY";
  const canResumeVNPay = isVNPay && canPayPayment;
  const canWalletPay = isWallet && canPayPayment;

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
              {canWalletPay ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-line bg-slate-50 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted">Số dư ví:</span>
                      <span className="font-bold text-ink text-sm">
                        {loadingWallet ? "..." : formatVnd(walletInfo?.balance ?? 0)}
                      </span>
                    </div>
                    {walletInfo && !walletInfo.has_pin && (
                      <p className="text-coral font-semibold">
                        Bạn chưa tạo mã PIN ví. Vui lòng vào{" "}
                        <Link href="/account/wallet" className="underline font-bold text-primary">
                          Quản lý Ví
                        </Link>{" "}
                        để tạo PIN trước.
                      </p>
                    )}
                    {walletInfo && walletInfo.has_pin && (walletInfo.balance ?? 0) < payment.amount && (
                      <p className="text-coral font-semibold">
                        Số dư không đủ. Vui lòng{" "}
                        <Link href="/account/wallet" className="underline font-bold text-primary">
                          Nạp thêm tiền
                        </Link>{" "}
                        vào ví.
                      </p>
                    )}
                  </div>

                  {walletInfo?.has_pin && (walletInfo.balance ?? 0) >= payment.amount && (
                    <Field label="Nhập mã PIN ví (6 số)">
                      <Input
                        type="password"
                        maxLength={6}
                        inputMode="numeric"
                        placeholder="••••••"
                        value={walletPin}
                        onChange={(e) => setWalletPin(e.target.value.replace(/\D/g, ""))}
                        className="text-center font-mono tracking-widest text-base bg-white"
                      />
                    </Field>
                  )}

                  <Button
                    disabled={
                      walletPaying ||
                      loadingWallet ||
                      !walletInfo?.has_pin ||
                      (walletInfo.balance ?? 0) < payment.amount ||
                      walletPin.length !== 6
                    }
                    onClick={async () => {
                      if (walletPin.length !== 6) {
                        showToast("Vui lòng nhập đúng 6 chữ số mã PIN ví", "danger");
                        return;
                      }
                      setWalletPaying(true);
                      try {
                        await walletApi.payWithWallet(payment.orderCodes, walletPin);
                        store.updatePaymentStatus(payment.paymentCode, "PAID");
                        showToast("Thanh toán đơn hàng bằng ví thành công!", "success");
                        await fetchPaymentDetail(payment.paymentCode);
                      } catch (err: any) {
                        showToast(err?.message || "Thanh toán bằng ví thất bại.", "danger");
                      } finally {
                        setWalletPaying(false);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {walletPaying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Đang trừ ví...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" aria-hidden="true" />
                        <span>Xác nhận thanh toán ví</span>
                      </>
                    )}
                  </Button>
                </div>
              ) : null}
              {payment.paymentStatus === "PAID" ? (
                <Button disabled className="w-full">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Đã thanh toán
                </Button>
              ) : null}
              <div className="my-1 border-t border-line" />
              <Button variant="secondary" onClick={() => router.push("/")}>
                <Home className="h-4 w-4" aria-hidden="true" />
                Về màn hình chính
              </Button>
              <Button variant="secondary" onClick={() => router.push("/account/orders")}>Xem đơn hàng</Button>
            </div>
          </Panel>
        </div>
      </Section>
    </main>
  );
}
