"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Scale, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  ShieldAlert, 
  ArrowRight, 
  User, 
  Store, 
  ReceiptText,
  Filter
} from "lucide-react";
import { Section, Panel } from "@/components/ui/containers";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { formatDate, formatVnd, returnStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { OrderReturn } from "@/types/models";

const STATUS_TABS = [
  { key: "ALL", label: "Tất cả", color: "all" },
  { key: "DISPUTED", label: "Chờ xử lý", color: "amber" },
  { key: "SUPPORT_APPROVED", label: "Đã duyệt hoàn tiền", color: "emerald" },
  { key: "SUPPORT_REJECTED", label: "Đã bác bỏ", color: "rose" },
];

export default function AdminDisputesPage() {
  const store = useMarketplaceStore();
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [disputes, setDisputes] = useState<OrderReturn[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const filterArg = activeTab === "ALL" ? undefined : activeTab;
    store.fetchDisputes(filterArg)
      .then((res: any) => {
        if (cancelled) return;
        if (res.ok) {
          setDisputes(res.disputes || []);
        } else {
          setError(res.message || "Không thể tải danh sách khiếu nại.");
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
  }, [activeTab, refreshKey, store.fetchDisputes]);

  // Client search filter
  const filteredDisputes = useMemo(() => {
    if (!searchTerm.trim()) return disputes;
    const term = searchTerm.toLowerCase().trim();
    return disputes.filter((item) => {
      const returnCode = (item.returnCode || "").toLowerCase();
      const orderCode = (item.order?.orderCode || String(item.orderId || "")).toLowerCase();
      const shopName = (item.order?.shopName || "").toLowerCase();
      const buyerName = (item.order?.receiverName || item.order?.userId || "").toLowerCase();
      const reason = (item.reason || "").toLowerCase();
      const disputeReason = (item.disputeReason || "").toLowerCase();
      return (
        returnCode.includes(term) ||
        orderCode.includes(term) ||
        shopName.includes(term) ||
        buyerName.includes(term) ||
        reason.includes(term) ||
        disputeReason.includes(term)
      );
    });
  }, [disputes, searchTerm]);

  // Summary counts
  const stats = useMemo(() => {
    const total = disputes.length;
    const disputedCount = disputes.filter((d) => d.returnStatus === "DISPUTED").length;
    const approvedCount = disputes.filter((d) => d.returnStatus === "SUPPORT_APPROVED").length;
    const rejectedCount = disputes.filter((d) => d.returnStatus === "SUPPORT_REJECTED").length;
    return { total, disputedCount, approvedCount, rejectedCount };
  }, [disputes]);

  return (
    <Section
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Scale className="h-5 w-5" />
          </div>
          <span>Cổng Tranh Chấp & Khiếu Nại Hoàn Hàng</span>
        </div>
      }
      description="Quản lý và giải quyết các trường hợp tranh chấp trả hàng/hoàn tiền giữa Người mua và Người bán trên sàn."
      action={
        <Button
          variant="secondary"
          onClick={() => setRefreshKey((prev) => prev + 1)}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : "text-slate-500"}`} />
          Làm mới
        </Button>
      }
      className="pb-6"
    >
      {/* 4 SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Tổng số vụ việc</span>
            <ReceiptText className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          <span className="text-[11px] text-slate-400">Tất cả khiếu nại ghi nhận</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 mb-1">
            <span>Chờ Supporter xử lý</span>
            <Clock className="h-4 w-4 text-amber-600 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-amber-900">{stats.disputedCount}</p>
          <span className="text-[11px] text-amber-700 font-medium">Cần đối soát & phán quyết</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mb-1">
            <span>Đã duyệt hoàn tiền</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900">{stats.approvedCount}</p>
          <span className="text-[11px] text-emerald-700">Chấp thuận khiếu nại khách</span>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 mb-1">
            <span>Đã bác bỏ khiếu nại</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-900">{stats.rejectedCount}</p>
          <span className="text-[11px] text-rose-700">Giữ nguyên quyết định Shop</span>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-5 space-y-4">
        {/* TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            let tabStyle = "";
            if (isActive) {
              if (tab.color === "amber") {
                tabStyle = "bg-amber-600 text-white shadow-sm shadow-amber-600/20";
              } else if (tab.color === "emerald") {
                tabStyle = "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20";
              } else if (tab.color === "rose") {
                tabStyle = "bg-rose-600 text-white shadow-sm shadow-rose-600/20";
              } else {
                tabStyle = "bg-slate-900 text-white shadow-sm";
              }
            } else {
              if (tab.color === "amber") {
                tabStyle = "bg-amber-50 text-amber-800 border border-amber-200/90 hover:bg-amber-100";
              } else if (tab.color === "emerald") {
                tabStyle = "bg-emerald-50 text-emerald-800 border border-emerald-200/90 hover:bg-emerald-100";
              } else if (tab.color === "rose") {
                tabStyle = "bg-rose-50 text-rose-800 border border-rose-200/90 hover:bg-rose-100";
              } else {
                tabStyle = "bg-slate-100 text-slate-700 hover:bg-slate-200/80";
              }
            }
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${tabStyle}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã khiếu nại (RET-...), mã đơn (ORD-...), tên shop, tên người mua, lý do..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:text-sm transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* DISPUTES TABLE / CONTENT */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="flex justify-center mb-3">
            <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Đang tải danh sách khiếu nại tranh chấp...</p>
        </div>
      ) : error ? (
        <ErrorState
          title="Không thể tải danh sách khiếu nại"
          description={error}
          action={
            <Button variant="secondary" onClick={() => setRefreshKey((prev) => prev + 1)}>
              Thử lại
            </Button>
          }
        />
      ) : filteredDisputes.length === 0 ? (
        <EmptyState
          title="Không có vụ khiếu nại nào"
          description={
            searchTerm
              ? `Không tìm thấy kết quả phù hợp với từ khóa "${searchTerm}".`
              : activeTab !== "ALL"
              ? "Không có khiếu nại nào trong bộ lọc này."
              : "Hiện tại không có tranh chấp hoàn hàng nào được gửi lên Sàn."
          }
          action={
            searchTerm ? (
              <Button variant="secondary" onClick={() => setSearchTerm("")}>
                Xóa tìm kiếm
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Mã khiếu nại</th>
                  <th className="px-4 py-3.5">Mã đơn hàng</th>
                  <th className="px-4 py-3.5">Người mua</th>
                  <th className="px-4 py-3.5">Shop / Người bán</th>
                  <th className="px-4 py-3.5">Ngày khiếu nại</th>
                  <th className="px-4 py-3.5">Lý do khiếu nại</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredDisputes.map((item) => {
                  const targetId = item.publicId || item.id || item.returnCode;
                  const isDisputed = item.returnStatus === "DISPUTED";
                  const disputeDate = item.disputedAt || item.createdAt;

                  return (
                    <tr
                      key={String(item.id || item.returnCode)}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDisputed ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* RETURN CODE */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-slate-900">
                          <ShieldAlert
                            className={`h-4 w-4 ${
                              isDisputed ? "text-amber-600" : "text-slate-400"
                            }`}
                          />
                          <span>#{item.returnCode}</span>
                        </div>
                      </td>

                      {/* ORDER CODE */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {item.order ? (
                          <div>
                            <span className="font-semibold text-primary">#{item.order.orderCode}</span>
                            <p className="text-[11px] text-slate-500">{formatVnd(item.order.totalAmount)}</p>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-700 font-mono">
                            #{item.orderId || "N/A"}
                          </span>
                        )}
                      </td>

                      {/* BUYER */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {(() => {
                                const rName = item.order?.receiverName || item.order?.shipment?.receiverName;
                                if (rName && rName.trim() !== "-" && rName.trim() !== "") return rName.trim();
                                if (item.user?.fullName && item.user.fullName.trim() !== "") return item.user.fullName.trim();
                                return `Khách #${item.userId}`;
                              })()}
                            </p>
                            {(item.order?.phone || item.order?.shipment?.receiverPhone) && (
                              <p className="text-[11px] text-slate-400">{item.order?.phone || item.order?.shipment?.receiverPhone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SELLER / SHOP */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-100">
                            <Store className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-medium text-slate-800">
                            {item.order?.shopName || `Shop #${item.sellerId}`}
                          </span>
                        </div>
                      </td>

                      {/* DISPUTE DATE */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                        {item.disputedAt ? (
                          <span>{formatDate(item.disputedAt)}</span>
                        ) : (
                          <span className="text-slate-400">{formatDate(item.createdAt)}</span>
                        )}
                      </td>

                      {/* REASON */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="font-semibold text-slate-900 truncate" title={item.reason}>
                          {item.reason}
                        </p>
                        {item.disputeReason && (
                          <p className="text-[11px] text-rose-600 italic truncate" title={item.disputeReason}>
                            Khiếu nại: "{item.disputeReason}"
                          </p>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge
                          status={item.returnStatus}
                          label={returnStatusLabel[item.returnStatus] || item.returnStatus}
                        />
                      </td>

                      {/* ACTION BUTTON */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <Link
                          href={`/supporter/disputes/${targetId}`}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs ${
                            isDisputed
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 hover:scale-[1.02] active:scale-95"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          <span>Xem xét & Đối soát</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}
