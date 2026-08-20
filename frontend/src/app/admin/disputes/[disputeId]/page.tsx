"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Scale,
  ArrowLeft,
  Copy,
  User,
  Store,
  CreditCard,
  Truck,
  PackageCheck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  ShieldCheck,
  Gavel,
  BadgeAlert,
  MapPin,
  Calendar,
  Check
} from "lucide-react";
import { Section, Panel } from "@/components/ui/containers";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import {
  formatDate,
  formatVnd,
  orderStatusLabel,
  paymentStatusLabel,
  paymentMethodLabel,
  orderPaymentMethodLabel,
  returnStatusLabel
} from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { OrderReturn, Order } from "@/types/models";

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const disputeId = params.disputeId as string;
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [dispute, setDispute] = useState<OrderReturn | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Verdict state
  const [supporterNote, setSupporterNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    decision: "APPROVE_REFUND" | "REJECT_DISPUTE" | null;
  }>({ open: false, decision: null });

  // Lightbox modal state for evidence images
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    store.fetchDisputeDetail(disputeId)
      .then((res: any) => {
        if (cancelled) return;
        if (res.ok && res.dispute) {
          setDispute(res.dispute);
          if (res.dispute.supporterNote) {
            setSupporterNote(res.dispute.supporterNote);
          }
        } else {
          setError(res.message || "Không thể tải chi tiết khiếu nại.");
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.message || "Lỗi khi kết nối hệ thống.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [disputeId, store.fetchDisputeDetail]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, "success");
  };

  const handleOpenVerdictConfirm = (decision: "APPROVE_REFUND" | "REJECT_DISPUTE") => {
    if (!supporterNote.trim()) {
      showToast("Vui lòng nhập ghi chú / căn cứ phán quyết trước khi xử lý.", "danger");
      return;
    }
    setConfirmModal({ open: true, decision });
  };

  const handleExecuteVerdict = async () => {
    if (!confirmModal.decision || !dispute) return;

    setIsSubmitting(true);
    try {
      const res = await store.resolveDispute(
        String(dispute.id || dispute.publicId || dispute.returnCode),
        confirmModal.decision,
        supporterNote.trim()
      );

      if (res.ok) {
        showToast(
          confirmModal.decision === "APPROVE_REFUND"
            ? "Đã duyệt hoàn tiền cho Người mua thành công."
            : "Đã bác bỏ khiếu nại, giữ nguyên quyết định của Shop.",
          "success"
        );
        setDispute(res.dispute);
        setConfirmModal({ open: false, decision: null });
      } else {
        showToast(res.message || "Lỗi khi xử lý khiếu nại.", "danger");
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi hệ thống khi xử lý khiếu nại.", "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center space-y-3">
        <div className="flex justify-center">
          <Scale className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Đang tải hồ sơ đối soát khiếu nại...</p>
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div className="py-8 max-w-2xl mx-auto">
        <ErrorState
          title="Không tìm thấy hồ sơ khiếu nại"
          description={error || "Hồ sơ khiếu nại không tồn tại hoặc đã bị xóa."}
          action={
            <Button variant="secondary" onClick={() => router.push("/admin/disputes")}>
              Quay lại danh sách khiếu nại
            </Button>
          }
        />
      </div>
    );
  }

  const order: Order | undefined = dispute.order;
  const isDisputed = dispute.returnStatus === "DISPUTED";
  const isApproved = dispute.returnStatus === "SUPPORT_APPROVED";
  const isRejected = dispute.returnStatus === "SUPPORT_REJECTED";
  const evidenceImages: string[] = dispute.evidenceImages || [];

  return (
    <Section title={null} className="pt-2 pb-12">
      {/* BREADCRUMB & BACK BUTTON */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/admin/disputes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 transition"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
          <span>Quay lại danh sách khiếu nại</span>
        </Link>
      </div>

      {/* HEADER CARD */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Scale className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-black text-slate-900">
                Hồ sơ Khiếu nại #{dispute.returnCode}
              </h1>
              <button
                type="button"
                onClick={() => handleCopy(dispute.returnCode, "mã khiếu nại")}
                className="p-1 text-slate-400 hover:text-emerald-700 transition"
                title="Sao chép mã khiếu nại"
              >
                <Copy className="h-4 w-4" />
              </button>
              <StatusBadge
                status={dispute.returnStatus}
                label={returnStatusLabel[dispute.returnStatus] || dispute.returnStatus}
              />
            </div>
            <p className="text-xs text-slate-500">
              Thời gian gửi khiếu nại:{" "}
              <span className="font-semibold text-slate-700">
                {formatDate(dispute.disputedAt || dispute.createdAt)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-medium">
                Đơn hàng: <strong className="text-slate-900 font-mono">#{order.orderCode}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* PHẦN 1: THÔNG TIN ĐƠN HÀNG & SẢN PHẨM */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
            <FileText className="h-5 w-5 text-emerald-600" />
            <span>Phần 1: Thông tin Đơn hàng & Sản phẩm</span>
          </div>

          {order ? (
            <div className="space-y-5">
              {/* ORDER OVERVIEW METRICS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block mb-0.5">Mã đơn hàng:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-900 font-mono">#{order.orderCode}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.orderCode, "mã đơn hàng")}
                      className="text-slate-400 hover:text-emerald-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-0.5">Ngày đặt hàng:</span>
                  <span className="font-bold text-slate-900">{formatDate(order.createdAt)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-0.5">Tổng giá trị đơn:</span>
                  <span className="font-extrabold text-emerald-700 text-sm">
                    {formatVnd(order.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-0.5">Phương thức thanh toán:</span>
                  <span className="font-bold text-slate-900">
                    {orderPaymentMethodLabel(order)}
                  </span>
                </div>
              </div>

              {/* BUYER & SELLER SUMMARY CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Buyer */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold pb-1 border-b border-slate-200/60">
                    <User className="h-4 w-4 text-slate-600" />
                    <span>Người mua (Khách hàng)</span>
                  </div>
                  <p className="text-slate-700">
                    Họ tên: <strong>{order.receiverName || `Người dùng #${dispute.userId}`}</strong>
                  </p>
                  {order.phone && (
                    <p className="text-slate-700">
                      Số điện thoại: <strong>{order.phone}</strong>
                    </p>
                  )}
                  {order.shippingAddress && (
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Địa chỉ nhận: {order.shippingAddress}
                    </p>
                  )}
                </div>

                {/* Seller */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold pb-1 border-b border-slate-200/60">
                    <Store className="h-4 w-4 text-emerald-600" />
                    <span>Người bán (Shop)</span>
                  </div>
                  <p className="text-slate-700">
                    Tên Shop: <strong>{order.shopName || `Shop #${dispute.sellerId}`}</strong>
                  </p>
                  {dispute.pickupAddress && (
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Kho / Lấy hàng: {dispute.pickupAddress}
                    </p>
                  )}
                </div>
              </div>

              {/* PRODUCT SNAPSHOTS LIST */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">
                  Danh sách sản phẩm trong đơn hàng:
                </p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 bg-white hover:bg-slate-50/50 transition"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.productImageSnapshot || "https://picsum.photos/80/80"}
                            alt={item.productNameSnapshot}
                            className="h-14 w-14 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                              {item.productNameSnapshot}
                            </h4>
                            {item.variantNameSnapshot && (
                              <p className="text-[11px] text-slate-500">
                                Phân loại: <span className="font-medium text-slate-700">{item.variantNameSnapshot}</span>
                              </p>
                            )}
                            {item.skuSnapshot && (
                              <p className="text-[10px] font-mono text-slate-400">
                                SKU: {item.skuSnapshot}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6 text-xs shrink-0">
                          <div className="text-right">
                            <span className="text-slate-500 block text-[11px]">Đơn giá</span>
                            <span className="font-semibold text-slate-800">
                              {formatVnd(item.unitPrice)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block text-[11px]">Số lượng</span>
                            <span className="font-bold text-slate-900">x{item.quantity}</span>
                          </div>
                          <div className="text-right min-w-[5rem]">
                            <span className="text-slate-500 block text-[11px]">Thành tiền</span>
                            <span className="font-extrabold text-emerald-700">
                              {formatVnd(item.subtotal || item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Không có thông tin chi tiết sản phẩm.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-xs text-slate-500 bg-slate-50 rounded-xl">
              Không có dữ liệu đơn hàng kèm theo.
            </div>
          )}
        </div>

        {/* PHẦN 2: TOÀN BỘ TIẾN TRÌNH TIMELINE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
            <Clock className="h-5 w-5 text-indigo-600" />
            <span>Phần 2: Toàn bộ Tiến trình Timeline Đơn hàng & Khiếu nại</span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {/* 1. PLACED */}
            <div className="relative">
              <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">1. Đặt hàng thành công</span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {order?.createdAt ? formatDate(order.createdAt) : "N/A"}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Khách hàng hoàn tất tạo đơn #{order?.orderCode || dispute.orderId}.
                </p>
              </div>
            </div>

            {/* 2. PAYMENT / CONFIRM */}
            <div className="relative">
              <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">
                    2. Thanh toán & Xác nhận Shop
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {(() => {
                      const logTime = order?.timeline?.find(l => l.newStatus === "READY_TO_SHIP" || l.note?.toLowerCase().includes("xác nhận"))?.createdAt;
                      const time = logTime || order?.sellerConfirmedAt || order?.createdAt;
                      return time ? formatDate(time) : "Đã xác nhận";
                    })()}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Phương thức:{" "}
                  <strong>
                    {order ? orderPaymentMethodLabel(order) : "COD"}
                  </strong>{" "}
                  – Shop đã xác nhận chuẩn bị hàng.
                </p>
              </div>
            </div>

            {/* 3. SHIPPING */}
            <div className="relative">
              <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">3. Bàn giao giao hàng</span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {(() => {
                      const logTime = order?.timeline?.find(l => l.newStatus === "SHIPPING")?.createdAt;
                      const time = logTime || order?.shipment?.shippedAt || order?.createdAt;
                      return time ? formatDate(time) : "Đã giao vận chuyển";
                    })()}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Đơn hàng được bàn giao cho đơn vị vận chuyển {order?.shipment?.shippingProviderName ? `(${order.shipment.shippingProviderName})` : ""} để phát hàng đến người mua.
                </p>
              </div>
            </div>

            {/* 4. DELIVERED */}
            <div className="relative">
              <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-emerald-600 ring-4 ring-emerald-100" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">4. Đã giao hàng (DELIVERED)</span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {(() => {
                      const logTime = order?.timeline?.find(l => l.newStatus === "DELIVERED")?.createdAt;
                      const time = order?.deliveredAt || order?.shipment?.deliveredAt || logTime;
                      return time ? formatDate(time) : "Đã giao hàng";
                    })()}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Shipper giao hàng thành công đến tay người mua. Bắt đầu thời hạn 7 ngày bảo vệ đơn hàng.
                </p>
              </div>
            </div>

            {/* 5. RETURN REQUESTED */}
            <div className="relative">
              <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-amber-100" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-amber-900">
                    5. Người mua yêu cầu Trả hàng / Hoàn tiền
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">{formatDate(dispute.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-700">
                  Lý do của khách: <strong>{dispute.reason}</strong>
                </p>
              </div>
            </div>

            {/* 6. SELLER REJECTED */}
            {dispute.sellerRejectReason && (
              <div className="relative">
                <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-rose-500 ring-4 ring-rose-100" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-rose-900">
                      6. Shop từ chối yêu cầu trả hàng
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {dispute.sellerRespondedAt ? formatDate(dispute.sellerRespondedAt) : "Đã từ chối"}
                    </span>
                  </div>
                  <p className="text-xs text-rose-700">
                    Lý do Shop từ chối: "{dispute.sellerRejectReason}"
                  </p>
                </div>
              </div>
            )}

            {/* 7. BUYER DISPUTED */}
            <div className="relative">
              <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-indigo-600 ring-4 ring-indigo-100" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-indigo-950">
                    7. Người mua khiếu nại lên Sàn (DISPUTED)
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {formatDate(dispute.disputedAt || dispute.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-indigo-900">
                  Nội dung khiếu nại: "{dispute.disputeReason || dispute.description}"
                </p>
              </div>
            </div>

            {/* 8. SUPPORTER VERDICT IF RESOLVED */}
            {(isApproved || isRejected) && (
              <div className="relative">
                <div
                  className={`absolute -left-6 top-1 h-3 w-3 rounded-full ${
                    isApproved ? "bg-emerald-600 ring-4 ring-emerald-100" : "bg-rose-600 ring-4 ring-rose-100"
                  }`}
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold ${
                        isApproved ? "text-emerald-900" : "text-rose-900"
                      }`}
                    >
                      8. Phán quyết của Supporter:{" "}
                      {isApproved
                        ? "Duyệt hoàn tiền cho người mua"
                        : "Bác bỏ khiếu nại (giữ quyết định Shop)"}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {dispute.resolvedAt ? formatDate(dispute.resolvedAt) : "Đã xử lý"}
                    </span>
                  </div>
                  {dispute.supporterNote && (
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1">
                      Căn cứ: "{dispute.supporterNote}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PHẦN 3: HỒ SƠ ĐỐI SOÁT 2 BÊN */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <span>Phần 3: Hồ sơ Đối soát 2 Bên (Người mua vs Người bán)</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* DOSSIER 1: BUYER */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-sm">
                  <User className="h-4 w-4 text-sky-700" />
                  <span>Hồ sơ Bên Người Mua (Khách hàng)</span>
                </div>
                <span className="text-[11px] text-sky-800 bg-sky-100 font-semibold px-2 py-0.5 rounded">
                  Khiếu nại sàn
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">Lý do yêu cầu trả hàng ban đầu:</span>
                  <p className="font-bold text-slate-900 mt-0.5">{dispute.reason}</p>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Mô tả chi tiết từ khách hàng:</span>
                  <div className="mt-1 p-2.5 rounded-lg bg-white border border-sky-100 text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {dispute.description || "Không có mô tả chi tiết."}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Lý do khiếu nại lên Sàn:</span>
                  <div className="mt-1 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 font-medium leading-relaxed">
                    {dispute.disputeReason || "Yêu cầu can thiệp đối soát từ Supporter Sàn."}
                  </div>
                </div>

                {/* EVIDENCE IMAGES & LIGHTBOX */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-700 font-bold block">
                      Thư viện ảnh/video minh chứng ({evidenceImages.length}):
                    </span>
                    <span className="text-[10px] text-slate-400">Click để phóng to</span>
                  </div>

                  {evidenceImages.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {evidenceImages.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCurrentImageIndex(idx);
                            setLightboxOpen(true);
                          }}
                          className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-500 shadow-2xs transition cursor-pointer"
                        >
                          <img
                            src={img}
                            alt={`Bằng chứng ${idx + 1}`}
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                            <ExternalLink className="h-4 w-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
                      Người mua không đính kèm ảnh minh chứng.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DOSSIER 2: SELLER */}
            <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
                <div className="flex items-center gap-2 text-orange-900 font-bold text-sm">
                  <Store className="h-4 w-4 text-orange-700" />
                  <span>Hồ sơ Bên Người Bán (Shop)</span>
                </div>
                <span className="text-[11px] text-orange-800 bg-orange-100 font-semibold px-2 py-0.5 rounded">
                  Từ chối trả hàng
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">Tên Gian Hàng / Shop:</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {order?.shopName || `Shop #${dispute.sellerId}`}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Lý do Shop từ chối trả hàng:</span>
                  <div className="mt-1 p-2.5 rounded-lg bg-white border border-rose-200 text-rose-900 font-medium leading-relaxed whitespace-pre-wrap">
                    {dispute.sellerRejectReason || "Shop chưa cung cấp lý do từ chối cụ thể."}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Thời gian Shop phản hồi:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {dispute.sellerRespondedAt ? formatDate(dispute.sellerRespondedAt) : "N/A"}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Địa chỉ kho lấy / trả hàng Shop:</span>
                  <div className="mt-1 p-2.5 rounded-lg bg-white border border-orange-100 text-slate-700 leading-relaxed flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                    <span>
                      {dispute.returnAddress || dispute.pickupAddress || "Địa chỉ kho mặc định của Shop."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PHẦN 4: BẢNG PHÁN QUYẾT CỦA SUPPORTER */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
            <Gavel className="h-5 w-5 text-primary" />
            <span>Phần 4: Bảng Phán quyết của Supporter</span>
          </div>

          {isDisputed ? (
            /* DISPUTED MODE: INPUT VERDICT NOTE & 2 BUTTONS */
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3 text-xs text-amber-950 leading-relaxed">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Hướng dẫn dành cho Supporter:</p>
                  <p className="mt-0.5 text-amber-900">
                    Vui lòng đối chiếu cẩn thận hình ảnh bằng chứng, mô tả của khách hàng và lý do từ chối của Shop trước khi ra phán quyết.
                    Phán quyết của Supporter là quyết định cuối cùng có hiệu lực ngay lập tức.
                  </p>
                </div>
              </div>

              {/* Note Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Căn cứ / Ghi chú phán quyết của Supporter <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  value={supporterNote}
                  onChange={(e) => setSupporterNote(e.target.value)}
                  placeholder="Nhập chi tiết căn cứ phân xử, trích dẫn bằng chứng ảnh/mô tả của các bên để làm biên bản đối soát..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* 2 VERDICT ACTION BUTTONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Button 1: Approve Refund */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Duyệt Hoàn Tiền Cho Người Mua
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Sàn chấp thuận khiếu nại. Tự động hoàn 100% giá trị đơn hàng ({order ? formatVnd(order.totalAmount) : "đơn"}) vào Ví Sàn của Người mua (Không cần hoàn hàng về shop).
                    </p>
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm shadow-emerald-600/20"
                    onClick={() => handleOpenVerdictConfirm("APPROVE_REFUND")}
                  >
                    Duyệt Hoàn Tiền Cho Người Mua
                  </Button>
                </div>

                {/* Button 2: Reject Dispute */}
                <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-rose-950 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-rose-600" />
                      Bác Bỏ Khiếu Nại (Giữ quyết định Shop)
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Bác bỏ khiếu nại của Người mua do thiếu căn cứ. Giữ nguyên quyết định của Shop, đơn hàng được cập nhật trạng thái Hoàn tất (COMPLETED).
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    className="w-full font-bold text-xs py-2.5 rounded-xl shadow-sm"
                    onClick={() => handleOpenVerdictConfirm("REJECT_DISPUTE")}
                  >
                    Bác Bỏ Khiếu Nại & Hoàn Tất Đơn
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* RESOLVED MODE: DISPLAY VERDICT DETAILS */
            <div className={`rounded-xl border p-5 space-y-3 ${
              isApproved ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-slate-200/60">
                <div className="flex items-center gap-2">
                  {isApproved ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-rose-600" />
                  )}
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {isApproved
                        ? "Phán quyết: Chấp thuận hoàn tiền cho Người mua"
                        : "Phán quyết: Bác bỏ khiếu nại (Giữ quyết định Shop)"}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Trạng thái: <strong>{returnStatusLabel[dispute.returnStatus]}</strong>
                    </p>
                  </div>
                </div>

                <StatusBadge
                  status={dispute.returnStatus}
                  label={returnStatusLabel[dispute.returnStatus] || dispute.returnStatus}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">Supporter phụ trách xử lý:</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {dispute.supporterId ? `Supporter #${dispute.supporterId}` : "Hỗ trợ viên Sàn"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Thời gian giải quyết:</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {dispute.resolvedAt ? formatDate(dispute.resolvedAt) : "N/A"}
                  </p>
                </div>
              </div>

              {dispute.supporterNote && (
                <div className="pt-2">
                  <span className="text-slate-600 font-bold block text-xs mb-1">
                    Ghi chú / Căn cứ phán quyết:
                  </span>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {dispute.supporterNote}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* VERDICT CONFIRMATION MODAL */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${
                confirmModal.decision === "APPROVE_REFUND"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}>
                <Gavel className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Xác nhận phán quyết khiếu nại
                </h3>
                <p className="text-xs text-slate-500">Mã khiếu nại: #{dispute.returnCode}</p>
              </div>
            </div>

            <div className="text-xs text-slate-700 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p>
                Bạn đang chuẩn bị đưa ra quyết định:{" "}
                <strong className={confirmModal.decision === "APPROVE_REFUND" ? "text-emerald-700" : "text-rose-700"}>
                  {confirmModal.decision === "APPROVE_REFUND"
                    ? "Duyệt Hoàn Tiền Cho Khách (Hoàn 100% vào Ví sàn)"
                    : "Bác Bỏ Khiếu Nại (Đóng đơn & Hoàn tất đơn)"}
                </strong>
              </p>
              <p className="text-slate-500 italic">
                Căn cứ: "{supporterNote}"
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => setConfirmModal({ open: false, decision: null })}
              >
                Hủy bỏ
              </Button>
              <Button
                className={
                  confirmModal.decision === "APPROVE_REFUND"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    : "bg-rose-600 hover:bg-rose-700 text-white font-bold"
                }
                disabled={isSubmitting}
                onClick={handleExecuteVerdict}
              >
                {isSubmitting ? "Đang xử lý..." : "Xác nhận phán quyết"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EVIDENCE LIGHTBOX / ZOOM MODAL */}
      {lightboxOpen && evidenceImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white bg-white/10 rounded-full transition"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Image display */}
            <div className="w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black">
              <img
                src={evidenceImages[currentImageIndex]}
                alt={`Evidence enlarged ${currentImageIndex + 1}`}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>

            {/* Lightbox Navigation */}
            {evidenceImages.length > 1 && (
              <div className="flex items-center justify-between w-full mt-3 text-white px-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentImageIndex((prev) =>
                      prev === 0 ? evidenceImages.length - 1 : prev - 1
                    )
                  }
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center gap-1 text-xs font-semibold"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span>Ảnh trước</span>
                </button>
                <span className="text-xs font-medium text-white/80">
                  {currentImageIndex + 1} / {evidenceImages.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentImageIndex((prev) =>
                      prev === evidenceImages.length - 1 ? 0 : prev + 1
                    )
                  }
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center gap-1 text-xs font-semibold"
                >
                  <span>Ảnh tiếp</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
