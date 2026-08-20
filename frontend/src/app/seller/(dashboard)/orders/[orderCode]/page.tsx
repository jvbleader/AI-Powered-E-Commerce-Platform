"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Copy, 
  User, 
  CreditCard, 
  Receipt, 
  Printer, 
  Truck, 
  PackageCheck, 
  RotateCcw, 
  AlertCircle, 
  Headset, 
  CheckCircle2, 
  Check, 
  X, 
  ExternalLink,
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import {
  canSellerCancel,
  canSellerConfirm,
  canSellerShip,
  canSellerDeliver,
  canSellerApproveReturn,
  canSellerRejectReturn,
  canSellerConfirmReturn,
  formatDate,
  formatVnd,
  orderStatusLabel,
  paymentStatusLabel,
  returnStatusLabel,
  orderPaymentMethodLabel
} from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderCode = params.orderCode as string;
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;

  // Modals & Action States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const order = store.state.orders.find(
    (item) => item.id === orderCode || item.orderCode === orderCode
  );

  useEffect(() => {
    if (orderCode) {
      store.fetchSellerOrderDetail(orderCode);
    }
  }, [orderCode]);

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi xem chi tiết đơn hàng." />;
  }

  if (!shop || !order) {
    return (
      <div className="flex justify-center p-8">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>
    );
  }

  const findPaymentForOrder = (orderCode: string) =>
    store.state.payments.find((payment) => payment.orderCodes.includes(orderCode));

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, "success");
  };

  const handleApproveReturn = async () => {
    const res = await store.approveSellerReturn(order.id);
    if (res.ok) {
      showToast("Đã đồng ý nhận lại hàng. Đơn vị vận chuyển sàn sẽ tới thu gom từ khách hàng.", "success");
    } else {
      showToast(res.message || "Lỗi khi đồng ý trả hàng.", "danger");
    }
  };

  const handleConfirmReceivedReturn = async () => {
    const res = await store.confirmReceivedReturn(order.id);
    if (res.ok) {
      showToast("Đã xác nhận nhận lại hàng hoàn. Số tiền đã được hoàn về ví người mua.", "success");
    } else {
      showToast(res.message || "Lỗi khi xác nhận nhận hàng hoàn.", "danger");
    }
  };

  const handleSubmitReject = async () => {
    if (!rejectReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối hoàn hàng.", "danger");
      return;
    }
    setIsRejecting(true);
    const res = await store.rejectSellerReturn(order.id, rejectReason.trim());
    setIsRejecting(false);
    if (res.ok) {
      showToast("Đã từ chối yêu cầu trả hàng.", "success");
      setRejectModalOpen(false);
      setRejectReason("");
    } else {
      showToast(res.message || "Lỗi khi từ chối trả hàng.", "danger");
    }
  };

  const payment = findPaymentForOrder(order.orderCode);
  const paymentTime = payment?.paidAt
    ? formatDate(payment.paidAt)
    : payment?.createdAt
    ? formatDate(payment.createdAt)
    : order.paymentStatus === "PAID"
    ? formatDate(order.createdAt)
    : null;

  return (
    <Section title={null} className="pt-2">
      <div className="mb-4">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              router.push("/seller/orders");
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 transition bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
          Quay lại danh sách đơn hàng
        </button>
      </div>

      <div className="space-y-4">
        {/* HEADER: ID & ACTIONS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-panel border border-line shadow-sm">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">#{order.orderCode}</h2>
              <button
                type="button"
                onClick={() => handleCopy(order.orderCode, "mã đơn hàng")}
                className="p-1 text-slate-400 hover:text-emerald-700 transition"
                title="Sao chép mã đơn"
              >
                <Copy className="h-4 w-4" />
              </button>
              <StatusBadge status={order.orderStatus} label={order.sellerConfirmed && order.orderStatus === "PLACED" ? "Đã xác nhận (chờ TT)" : orderStatusLabel[order.orderStatus]} />
              <StatusBadge status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ngày đặt: <span className="font-semibold text-slate-700">{formatDate(order.createdAt)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canSellerConfirm(order) && (
              <Button onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>
                Xác nhận đơn
              </Button>
            )}
            {canSellerShip(order) && (
              <Button variant="secondary" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) { showToast("Đã chuyển shipping.", "success"); window.open(`/seller/print-orders?ids=${order.id}`, '_blank'); } else { showToast(res.message || "Lỗi chuyển shipping", "danger"); } })}>
                Chuyển giao hàng
              </Button>
            )}
            {canSellerDeliver(order) && (
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                onClick={() => store.markOrderDelivered(order.id).then((res) => { 
                  if (res.ok) showToast("Đã cập nhật trạng thái đã giao hàng.", "success"); 
                  else showToast(res.message || "Lỗi cập nhật", "danger"); 
                })}
              >
                <PackageCheck className="h-4 w-4" />
                Đã giao hàng
              </Button>
            )}
            {canSellerCancel(order) && (
              <Button variant="danger" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })}>
                Từ chối đơn
              </Button>
            )}
            {order.orderStatus === "SHIPPING" && (
              <Button 
                variant="secondary" 
                disabled={(order.printCount || 0) >= 2} 
                title={(order.printCount || 0) >= 2 ? "Đã hết lượt in lại" : ""}
                onClick={() => store.incrementPrintCount(order.id).then((res) => { if (res.ok) { window.open(`/seller/print-orders?ids=${order.id}`, '_blank'); } else { showToast(res.message || "Lỗi in lại", "danger"); } })}
              >
                <Printer className="h-4 w-4 mr-1" />
                In lại ({Math.max(0, 2 - (order.printCount || 0))})
              </Button>
            )}
          </div>
        </div>

        {/* RETURN REQUEST SHOPEE PICK-UP PANEL */}
        {order.returnRequest && (
          <Panel className="rounded-2xl border border-amber-200 shadow-sm p-5 sm:p-6 bg-amber-50/40 overflow-hidden space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 font-bold">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-base">Yêu cầu Trả hàng / Hoàn tiền (Shopee Pick-up)</h3>
                    <span className="text-xs font-mono text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      #{order.returnRequest.returnCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ngày yêu cầu: <span className="font-semibold text-slate-800">{formatDate(order.returnRequest.createdAt)}</span>
                  </p>
                </div>
              </div>
              <StatusBadge
                status={order.returnRequest.returnStatus}
                label={returnStatusLabel[order.returnRequest.returnStatus] || order.returnRequest.returnStatus}
              />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm">
                <span className="text-slate-600 font-medium">Lý do hoàn hàng của khách:</span>
                <span className="font-bold text-slate-900">{order.returnRequest.reason}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 text-xs sm:text-sm">
                <span className="text-slate-600 font-medium shrink-0">Mô tả chi tiết:</span>
                <span className="font-medium text-slate-900 max-w-lg sm:text-right">{order.returnRequest.description}</span>
              </div>

              {/* Evidence Images */}
              {order.returnRequest.evidenceImages && order.returnRequest.evidenceImages.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-slate-700 mb-2">Ảnh minh chứng từ người mua:</p>
                  <div className="flex flex-wrap gap-2.5">
                    {order.returnRequest.evidenceImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewImage(img)}
                        className="group relative h-20 w-20 rounded-xl overflow-hidden border border-line hover:border-emerald-500 transition shadow-sm cursor-pointer"
                      >
                        <img src={img} alt={`Evidence ${idx + 1}`} className="h-full w-full object-cover group-hover:scale-105 transition duration-200" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                          <ExternalLink className="h-4 w-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. REQUESTED ACTION BOX */}
              {order.returnRequest.returnStatus === "REQUESTED" && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <h4 className="font-bold text-amber-950 text-sm">Khách hàng đang yêu cầu trả hàng</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Nếu đồng ý, hệ thống sàn sẽ tạo mã vận đơn thu gom tự động để nhận lại hàng từ khách.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 flex items-center gap-1.5 rounded-xl shadow-sm"
                      onClick={handleApproveReturn}
                    >
                      <Check className="h-4 w-4" />
                      Đồng ý nhận lại hàng
                    </Button>
                    <Button
                      variant="danger"
                      className="font-semibold text-xs h-9 px-4 flex items-center gap-1.5 rounded-xl shadow-sm"
                      onClick={() => {
                        setRejectReason("");
                        setRejectModalOpen(true);
                      }}
                    >
                      <X className="h-4 w-4" />
                      Từ chối hoàn hàng
                    </Button>
                  </div>
                </div>
              )}

              {/* 2. SELLER_APPROVED hoặc RETURNING: Shopee Pick-up Card */}
              {(order.returnRequest.returnStatus === "SELLER_APPROVED" || order.returnRequest.returnStatus === "RETURNING") && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                      <Truck className="h-4 w-4 text-emerald-600" />
                      <span>Vận đơn thu gom sàn (Shopee Pick-up tận nơi)</span>
                    </div>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-4 flex items-center gap-1.5 rounded-xl shadow-sm"
                      onClick={handleConfirmReceivedReturn}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Xác nhận đã nhận lại hàng hoàn
                    </Button>
                  </div>
                  <div className="grid gap-2 text-xs sm:text-sm bg-white/70 p-3 rounded-xl border border-emerald-100">
                    <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                      <span className="text-emerald-800 font-medium">Đơn vị vận chuyển thu gom:</span>
                      <span className="font-bold text-emerald-950">{order.returnRequest.returnShippingProvider || "Shopee Xpress Pick-up"}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                      <span className="text-emerald-800 font-medium">Mã vận đơn hoàn:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-950">{order.returnRequest.returnTrackingCode || "RET-PENDING"}</span>
                        {order.returnRequest.returnTrackingCode && (
                          <button
                            type="button"
                            onClick={() => handleCopy(order.returnRequest!.returnTrackingCode!, "mã vận đơn hoàn")}
                            className="p-1 text-emerald-700 hover:text-emerald-900"
                            title="Sao chép mã"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start py-1 border-b border-emerald-100">
                      <span className="text-emerald-800 font-medium shrink-0">Địa chỉ lấy hàng từ khách:</span>
                      <span className="font-medium text-emerald-950 text-right max-w-xs">
                        {order.returnRequest.pickupAddress || `${order.shipment.detailAddress}, ${order.shipment.ward}, ${order.shipment.district}, ${order.shipment.province}`}
                      </span>
                    </div>
                    {(order.returnRequest.returnAddress || shop.pickupAddress) && (
                      <div className="flex justify-between items-start py-1 border-b border-emerald-100">
                        <span className="text-emerald-800 font-medium shrink-0">Địa chỉ Shop nhận lại:</span>
                        <span className="font-medium text-emerald-950 text-right max-w-xs">
                          {order.returnRequest.returnAddress || shop.pickupAddress}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-emerald-800 italic bg-white/60 p-2 rounded-lg border border-emerald-200">
                    Đơn vị vận chuyển đang thu gom kiện hàng hoàn về địa chỉ của Shop. Sau khi nhận được kiện hàng và kiểm tra nguyên vẹn, vui lòng bấm <strong>"Xác nhận đã nhận lại hàng hoàn"</strong> để hoàn tất hoàn tiền ví cho người mua.
                  </p>
                </div>
              )}

              {/* 3. SELLER_REJECTED */}
              {order.returnRequest.returnStatus === "SELLER_REJECTED" && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    <span>Shop đã từ chối yêu cầu hoàn hàng</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-semibold text-slate-800">Lý do từ chối từ Shop: </span>
                    <span className="text-slate-900 font-medium">{order.returnRequest.sellerRejectReason || "Shop không chấp nhận lý do hoàn hàng."}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Người mua có quyền khiếu nại lên Sàn trong vòng 7 ngày nếu không đồng ý với lý do này.
                  </p>
                </div>
              )}

              {/* 4. DISPUTED */}
              {order.returnRequest.returnStatus === "DISPUTED" && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-100/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Headset className="h-4 w-4 text-amber-700" />
                    <span>Người mua đã khiếu nại lên Sàn (Đang chờ Supporter phân xử)</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-semibold text-amber-950">Lý do khiếu nại của khách: </span>
                    <span className="text-amber-900">{order.returnRequest.disputeReason}</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Ban quản trị Sàn đang tiến hành đối soát hồ sơ và bằng chứng của cả hai bên để đưa ra quyết định công bằng nhất.
                  </p>
                </div>
              )}

              {/* 5. SUPPORT_APPROVED / COMPLETED / orderStatus === "RETURNED" */}
              {(order.returnRequest.returnStatus === "SUPPORT_APPROVED" || order.returnRequest.returnStatus === "COMPLETED" || order.orderStatus === "RETURNED") && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Đã hoàn tất hoàn trả</span>
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-800">
                    Quy trình hoàn hàng đã hoàn tất thành công. Số tiền <strong>{formatVnd(order.totalAmount)}</strong> đã được hoàn lại vào Ví tiền của khách hàng.
                  </p>
                  {order.returnRequest.supporterNote && (
                    <p className="text-xs text-emerald-700 bg-white/70 p-2 rounded-lg border border-emerald-200">
                      <strong>Ghi chú từ Supporter:</strong> {order.returnRequest.supporterNote}
                    </p>
                  )}
                </div>
              )}

              {/* 6. SUPPORT_REJECTED */}
              {order.returnRequest.returnStatus === "SUPPORT_REJECTED" && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-100 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <AlertCircle className="h-4 w-4 text-slate-600" />
                    <span>Sàn đã bác bỏ khiếu nại của người mua</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Sau khi đối soát bằng chứng, Supporter đã bác bỏ khiếu nại của khách. Đơn hàng tiếp tục giữ trạng thái hoàn thành.
                  </p>
                  {order.returnRequest.supporterNote && (
                    <p className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                      <strong>Ghi chú từ Supporter:</strong> {order.returnRequest.supporterNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* 3-COLUMN KPI INFO GRID */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Customer */}
          <Panel className="p-4 flex flex-col gap-2 bg-white h-full">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-1">
              <User className="h-4 w-4 text-emerald-600" />
              Khách hàng & Giao hàng
            </div>
            <div className="text-sm">
              <span className="font-semibold text-slate-900">{order.shipment.receiverName}</span>
              <span className="text-slate-500 ml-2">{order.shipment.receiverPhone}</span>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed mt-1">
              {order.shipment.detailAddress}, {order.shipment.ward}, {order.shipment.district}, {order.shipment.province}
            </div>
            {order.shipment?.shippingProviderName && (
              <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 bg-slate-50 p-1.5 rounded border border-line">
                <Truck className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700">ĐVVC:</span> {order.shipment.shippingProviderName}
              </div>
            )}
            {order.customerNote && (
              <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded max-h-20 overflow-y-auto">
                <span className="font-semibold">Ghi chú:</span> {order.customerNote}
              </div>
            )}
          </Panel>

          {/* Payment & Status */}
          <Panel className="p-4 flex flex-col gap-2 bg-white h-full">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-1">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Thanh toán & Trạng thái
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-y-2 text-xs items-center">
              <span className="text-slate-500">Thanh toán</span>
              <div><StatusBadge status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} /></div>
              
              <span className="text-slate-500">Phương thức</span>
              <span className="font-semibold text-slate-800">{orderPaymentMethodLabel(order, payment)}</span>
              
              {paymentTime && (
                <>
                  <span className="text-slate-500">Thời gian TT</span>
                  <span className="font-semibold text-slate-800">{paymentTime}</span>
                </>
              )}
            </div>
          </Panel>

          {/* Financials */}
          <Panel className="p-4 flex flex-col gap-2 bg-white h-full">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-1">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Tài chính
            </div>
            <div className="grid gap-1.5 text-sm mt-1">
              <div className="flex justify-between text-slate-600">
                <span>Tổng tiền hàng</span>
                <span>{formatVnd(order.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Phí vận chuyển</span>
                <span>{formatVnd(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-2 mt-1">
                <span>Tổng cộng</span>
                <span className="text-emerald-700">{formatVnd(order.totalAmount)}</span>
              </div>
            </div>
          </Panel>
        </div>

        {/* ORDER ITEMS TABLE */}
        <Panel className="p-0 overflow-hidden bg-white">
          <div className="overflow-x-auto overflow-y-auto max-h-80">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-line sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600">Sản phẩm</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">SKU</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Đơn giá</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-center">SL</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <img src={item.productImageSnapshot} alt={item.productNameSnapshot} className="h-10 w-10 rounded border border-line object-cover shrink-0" />
                        <div>
                          <p className="font-bold text-slate-900 line-clamp-1" title={item.productNameSnapshot}>{item.productNameSnapshot}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.variantNameSnapshot}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {item.skuSnapshot || "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                      {formatVnd(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-800">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatVnd(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* REJECT RETURN MODAL */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                <AlertCircle className="h-5 w-5" />
                Từ chối yêu cầu hoàn hàng
              </div>
              <button 
                type="button" 
                onClick={() => setRejectModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600 mb-2">
                Bạn đang từ chối yêu cầu trả hàng của đơn <strong>#{order.orderCode}</strong>. Khách hàng có thể khiếu nại lên Sàn nếu không chấp nhận lý do này.
              </p>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Lý do từ chối <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do cụ thể (vd: Hàng hoá giao đúng mô tả, tem niêm phong đã bị rách...)"
                rows={3}
                className="w-full text-sm border border-line rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted font-medium w-full">Gợi ý nhanh:</span>
                {[
                  "Sản phẩm đúng mô tả và nguyên vẹn",
                  "Sản phẩm đã qua sử dụng / rách tem",
                  "Khách hàng không cung cấp video mở kiện hàng"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md border border-slate-200 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                variant="secondary"
                onClick={() => setRejectModalOpen(false)}
                disabled={isRejecting}
                className="h-9 text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                onClick={handleSubmitReject}
                disabled={isRejecting || !rejectReason.trim()}
                className="h-9 text-xs flex items-center gap-1.5"
              >
                {isRejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW IMAGE MODAL */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2 bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full z-10 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={previewImage} alt="Ảnh minh chứng" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </Section>
  );
}
