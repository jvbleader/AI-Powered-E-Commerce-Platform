"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  ShieldCheck, 
  Flag, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Search, 
  Filter, 
  Trash2, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  User,
  ShoppingBag,
  RefreshCw,
  X,
  ChevronLeft
} from "lucide-react";
import { Section } from "@/components/ui/containers";
import { EmptyState } from "@/components/ui/feedback";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { ViolationReport, ViolationReportStatus } from "@/types/models";

export default function AdminViolationReportsPage() {
  const store = useMarketplaceStore();
  const rawReports: ViolationReport[] = (store.state as any).violationReports ?? [];

  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedReport, setSelectedReport] = useState<ViolationReport | null>(null);
  const [showConfirmResolve, setShowConfirmResolve] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Fetch reports from Backend API on mount if available, or fall back to store/sample data
  useEffect(() => {
    let cancelled = false;
    async function loadBackendReports() {
      setIsRefreshing(true);
      try {
        const { apiFetch } = await import("@/services/api");
        const data = await apiFetch<any[]>("/admin/violation-reports");
        if (!cancelled && Array.isArray(data)) {
          const mappedReports: ViolationReport[] = data.map((r: any) => ({
            id: String(r.id),
            reporterId: String(r.reporter_id),
            reporterName: r.reporter_name || "Khách hàng",
            reporterEmail: r.reporter_email || "user@example.com",
            productId: String(r.product_id),
            productPublicId: r.product_public_id,
            productName: r.product_name || `Sản phẩm #${r.product_id}`,
            productImage: r.product_thumbnail || "https://picsum.photos/200/200",
            reasonType: r.reason_type,
            description: r.description,
            imageUrls: r.images?.map((img: any) => img.image_url) || [],
            status: r.status as ViolationReportStatus,
            createdAt: r.created_at,
            resolvedAt: r.resolved_at
          }));

          useMarketplaceStore.setState((prev) => ({
            state: { ...prev.state, violationReports: mappedReports }
          }));
        }
      } catch (e) {
        // Ignored if unauthenticated admin or offline mock mode
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    }
    loadBackendReports();
    return () => {
      cancelled = true;
    };
  }, [store.ready, refreshKey]);

  // Seed sample mock reports if empty so admin page is useful on first load
  useEffect(() => {
    if (rawReports.length === 0 && store.ready) {
      const sampleProducts = store.state.products;
      const prod1 = sampleProducts[0];
      const prod2 = sampleProducts[1] || sampleProducts[0];

      const sampleReports: ViolationReport[] = [
        {
          id: "rep_101",
          reporterId: "u_sample_1",
          reporterName: "Nguyễn Văn Hùng",
          reporterEmail: "hung.nguyen@gmail.com",
          productId: prod1?.id || "p1",
          productName: prod1?.name || "Tai nghe Bluetooth Không Dây Cao Cấp Pro Max",
          productImage: prod1?.thumbnailUrl || prod1?.imageUrls?.[0] || "https://picsum.photos/200/200?random=1",
          reasonType: "Hàng giả / Nhái thương hiệu",
          description: "Sản phẩm nhận được có dấu hiệu làm nhái logo thương hiệu, linh kiện nhựa thô ráp không giống như quảng cáo.",
          imageUrls: [
            "https://picsum.photos/400/300?random=11",
            "https://picsum.photos/400/300?random=12"
          ],
          status: "PENDING",
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        {
          id: "rep_102",
          reporterId: "u_sample_2",
          reporterName: "Trần Thị Mai",
          reporterEmail: "mai.tran@yahoo.com",
          productId: prod2?.id || "p2",
          productName: prod2?.name || "Áo Sơ Mi Linen Form Rộng Unisex",
          productImage: prod2?.thumbnailUrl || prod2?.imageUrls?.[0] || "https://picsum.photos/200/200?random=2",
          reasonType: "Mô tả sai sự thật",
          description: "Shop đăng thông số là 100% chất liệu Linen cotton nhưng thực tế nhận được vải PE tổng hợp rất mỏng và dễ xù lông.",
          imageUrls: [
            "https://picsum.photos/400/300?random=13"
          ],
          status: "REVIEWING",
          createdAt: new Date(Date.now() - 3600000 * 28).toISOString()
        },
        {
          id: "rep_103",
          reporterId: "u_sample_3",
          reporterName: "Lê Hoàng Nam",
          reporterEmail: "nam.le@gmail.com",
          productId: prod1?.id || "p1",
          productName: prod1?.name || "Giày Sneaker Nam Thể Thao Trắng",
          productImage: prod1?.thumbnailUrl || prod1?.imageUrls?.[0] || "https://picsum.photos/200/200?random=3",
          reasonType: "Lừa đảo / Không giao đúng mẫu",
          description: "Đặt giày size 42 màu trắng nhưng shop gửi đôi dép nhựa giá rẻ màu xanh.",
          imageUrls: [],
          status: "RESOLVED",
          createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
          resolvedAt: new Date(Date.now() - 3600000 * 10).toISOString()
        }
      ];

      useMarketplaceStore.setState((prev) => ({
        state: { ...prev.state, violationReports: sampleReports }
      }));
    }
  }, [rawReports.length, store.ready, store.state]);

  const reports = (store.state as any).violationReports ?? [];

  // Filter & Search logic
  const filteredReports = useMemo(() => {
    return reports.filter((report: ViolationReport) => {
      const matchesTab = activeTab === "ALL" || report.status === activeTab;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        report.productName?.toLowerCase().includes(term) ||
        report.reasonType.toLowerCase().includes(term) ||
        report.description.toLowerCase().includes(term) ||
        report.reporterName?.toLowerCase().includes(term) ||
        report.reporterEmail?.toLowerCase().includes(term) ||
        report.id.toLowerCase().includes(term);

      return matchesTab && matchesSearch;
    });
  }, [reports, activeTab, searchTerm]);

  // Statistics counts
  const stats = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((r: ViolationReport) => r.status === "PENDING").length,
      reviewing: reports.filter((r: ViolationReport) => r.status === "REVIEWING").length,
      resolved: reports.filter((r: ViolationReport) => r.status === "RESOLVED").length,
      rejected: reports.filter((r: ViolationReport) => r.status === "REJECTED").length
    };
  }, [reports]);

  const handleUpdateStatus = async (reportId: string, newStatus: ViolationReportStatus) => {
    // Eager update UI ngay lập tức để tránh bị giật (flicker) do độ trễ API
    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport((prev) => prev ? { ...prev, status: newStatus } : null);
    }
    
    await store.updateViolationReportStatus(reportId, newStatus);
    store.showToast(`Đã cập nhật trạng thái báo cáo sang ${getStatusLabel(newStatus)}`, "success");
  };

  const handleHideProduct = async (productId: string, productPublicId?: string) => {
    try {
      const res = await store.hideProductByAdmin(productId, productPublicId);
      if (res.ok) {
        store.showToast("Đã khóa / ẩn sản phẩm vi phạm khỏi sàn thành công!", "success");
      } else {
        store.showToast(res.message || "Khóa sản phẩm thất bại.", "danger");
      }
    } catch {
      store.showToast("Khóa sản phẩm thất bại.", "danger");
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa đơn báo cáo này khỏi hệ thống?")) {
      await store.deleteViolationReport(reportId);
      store.showToast("Đã xóa báo cáo vi phạm.", "info");
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
    }
  };

  return (
    <Section title="Quản Lý Báo Cáo Vi Phạm">
      <div className="space-y-6">
        {/* Top Summary Stat Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard
            label="Tổng báo cáo"
            count={stats.total}
            active={activeTab === "ALL"}
            onClick={() => setActiveTab("ALL")}
            color="border-slate-200 bg-slate-50 text-slate-900"
            icon={<Flag className="h-5 w-5 text-slate-600" />}
          />
          <StatCard
            label="Chờ xử lý"
            count={stats.pending}
            active={activeTab === "PENDING"}
            onClick={() => setActiveTab("PENDING")}
            color="border-orange-200 bg-orange-50 text-orange-900"
            badgeColor="bg-orange-500 text-white"
            icon={<Clock className="h-5 w-5 text-orange-600" />}
          />
          <StatCard
            label="Đang xem xét"
            count={stats.reviewing}
            active={activeTab === "REVIEWING"}
            onClick={() => setActiveTab("REVIEWING")}
            color="border-blue-200 bg-blue-50/70 text-blue-900"
            badgeColor="bg-blue-500 text-white"
            icon={<AlertTriangle className="h-5 w-5 text-blue-600" />}
          />
          <StatCard
            label="Đã xử lý"
            count={stats.resolved}
            active={activeTab === "RESOLVED"}
            onClick={() => setActiveTab("RESOLVED")}
            color="border-emerald-200 bg-emerald-50/70 text-emerald-900"
            badgeColor="bg-emerald-500 text-white"
            icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
          />
          <StatCard
            label="Từ chối"
            count={stats.rejected}
            active={activeTab === "REJECTED"}
            onClick={() => setActiveTab("REJECTED")}
            color="border-rose-200 bg-rose-50/70 text-rose-900"
            badgeColor="bg-rose-500 text-white"
            icon={<XCircle className="h-5 w-5 text-rose-600" />}
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm, người báo cáo, lý do..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-rose-500 focus:ring-rose-500/20 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4">
              <Filter className="h-4 w-4 text-slate-400" />
              <span>Hiển thị: </span>
              <span className="font-bold text-slate-900">{filteredReports.length} báo cáo</span>
            </div>
            
            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-rose-500" : ""}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Reports Table / List */}
        {filteredReports.length === 0 ? (
          <div className="bg-white p-12 border border-slate-200 text-center space-y-3">
            <ShieldCheck className="h-12 w-12 text-slate-300 mx-auto" />
            <p className="text-slate-600 font-medium">Không tìm thấy báo cáo vi phạm nào phù hợp</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto max-h-[75vh] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:mt-[49px] [&::-webkit-scrollbar-track]:mb-4 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
              <table className="w-full table-fixed text-left text-sm text-slate-700 min-w-[900px]">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="px-3 py-4 w-[12%]">Mã đơn</th>
                    <th className="px-3 py-4 w-[30%]">Sản phẩm bị báo cáo</th>
                    <th className="px-3 py-4 w-[18%]">Người báo cáo</th>
                    <th className="px-3 py-4 w-[15%]">Lý do</th>
                    <th className="px-3 py-4 w-[15%]">Trạng thái</th>
                    <th className="px-3 py-4 w-[10%] text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredReports.map((report: ViolationReport) => (
                    <tr key={report.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-4">
                        <div className="font-mono text-xs font-bold text-slate-900">{report.id}</div>
                        <div className="text-xs text-slate-400">
                          {new Date(report.createdAt).toLocaleString("vi-VN")}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={report.productImage || "https://picsum.photos/200/200"}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 truncate" title={report.productName}>
                              {report.productName || `Sản phẩm #${report.productId}`}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">ID: {report.productId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-slate-900 font-semibold">{report.reporterName || "Khách hàng"}</div>
                        <div className="text-xs text-slate-400">{report.reporterEmail || "-"}</div>
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Flag className="h-3 w-3 flex-shrink-0" />
                          <span className="line-clamp-2">{report.reasonType}</span>
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="px-3 py-4 text-right">
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-bold hover:bg-slate-200 transition-colors whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Xử lý</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Detail Modal */}
        {selectedReport && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => { setSelectedReport(null); setShowConfirmResolve(false); }}
          >
            <div 
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-0 max-h-[90vh] flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Chi Tiết Đơn Báo Cáo Vi Phạm</h3>
                    <p className="text-xs font-mono text-slate-500">Mã đơn: {selectedReport.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedReport(null); setShowConfirmResolve(false); }}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Status & Date bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500">Thời gian gửi: </span>
                    <span className="font-bold text-slate-800">
                      {new Date(selectedReport.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Trạng thái: </span>
                    <StatusBadge status={selectedReport.status} />
                  </div>
                </div>

                {/* Product Info Card */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4" />
                    Sản phẩm bị báo cáo
                  </h4>
                  <div className="flex items-center gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                    <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 overflow-hidden flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedReport.productImage || "https://picsum.photos/200/200"} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-slate-900 truncate">{selectedReport.productName}</h5>
                      <p className="text-xs text-slate-500 font-mono">ID Sản phẩm: {selectedReport.productId}</p>
                    </div>
                    <button
                      onClick={() => handleHideProduct(selectedReport.productId)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      Ẩn sản phẩm
                    </button>
                  </div>
                </div>

                {/* Reporter Info */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    Thông tin người báo cáo
                  </h4>
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-slate-400">Họ và tên</div>
                      <div className="font-bold text-slate-900">{selectedReport.reporterName || "Khách hàng"}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Email liên hệ</div>
                      <div className="font-bold text-slate-900">{selectedReport.reporterEmail || "-"}</div>
                    </div>
                  </div>
                </div>

                {/* Violation Detail */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Flag className="h-4 w-4 text-rose-500" />
                    Nội dung báo cáo
                  </h4>
                  <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200">
                        Lý do: {selectedReport.reasonType}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed font-medium bg-white p-3 rounded-xl border border-rose-100 whitespace-pre-wrap break-words">
                      {selectedReport.description}
                    </p>

                    {/* Image evidence list */}
                    {selectedReport.imageUrls && selectedReport.imageUrls.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-rose-900">Ảnh chứng minh đính kèm ({selectedReport.imageUrls.length}):</div>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedReport.imageUrls.map((url, i) => (
                            <button
                              key={i} 
                              type="button"
                              onClick={() => {
                                setPreviewImages(selectedReport.imageUrls || []);
                                setPreviewIndex(i);
                                setPreviewImage(url);
                              }}
                              className="block relative h-24 rounded-xl overflow-hidden border border-rose-200 bg-white group cursor-zoom-in"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="Bằng chứng" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Confirm Resolve Mini-Popup */}
              {showConfirmResolve && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] rounded-3xl">
                  <div className="bg-white p-5 rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 space-y-4 animate-in zoom-in-95 duration-200">
                    <h4 className="font-bold text-slate-900 text-sm">Xác nhận xử lý báo cáo</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Bạn có muốn đồng thời <span className="font-bold text-rose-600">khóa/ẩn sản phẩm</span> này khỏi sàn không?
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={async () => {
                          await handleHideProduct(selectedReport.productId, selectedReport.productPublicId);
                          await handleUpdateStatus(selectedReport.id, "RESOLVED");
                          setShowConfirmResolve(false);
                        }}
                        className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm"
                      >
                        Đã xử lý & Ẩn sản phẩm
                      </button>
                      <button
                        onClick={async () => {
                          await handleUpdateStatus(selectedReport.id, "RESOLVED");
                          setShowConfirmResolve(false);
                        }}
                        className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                      >
                        Chỉ đánh dấu Đã xử lý
                      </button>
                      <button
                        onClick={() => setShowConfirmResolve(false)}
                        className="w-full py-2 rounded-xl bg-transparent text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors mt-1"
                      >
                        Hủy bỏ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              {(selectedReport.status as any) !== "RESOLVED" && (selectedReport.status as any) !== "REJECTED" ? (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 font-medium">Cập nhật trạng thái báo cáo:</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, "REVIEWING")}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedReport.status === "REVIEWING"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      Đang xem xét
                    </button>
                    <button
                      onClick={() => setShowConfirmResolve(true)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        (selectedReport.status as any) === "RESOLVED"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      Đã xử lý
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, "REJECTED")}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        (selectedReport.status as any) === "REJECTED"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 font-medium">
                    Báo cáo này đã được đóng (Trạng thái: <span className="font-bold">{getStatusLabel(selectedReport.status)}</span>)
                  </div>
                  <div className="text-xs text-slate-400">
                    Không thể thay đổi trạng thái báo cáo nữa.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {previewImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = (previewIndex - 1 + previewImages.length) % previewImages.length;
                  setPreviewIndex(next);
                  setPreviewImage(previewImages[next]);
                }}
                className="absolute left-4 md:left-8 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = (previewIndex + 1) % previewImages.length;
                  setPreviewIndex(next);
                  setPreviewImage(previewImages[next]);
                }}
                className="absolute right-4 md:right-8 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <img
            src={previewImage}
            alt="Ảnh bằng chứng"
            className="max-h-[90vh] max-w-[min(96vw,56rem)] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Section>
  );
}

function StatCard({
  label,
  count,
  active,
  onClick,
  color,
  badgeColor,
  icon
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color: string;
  badgeColor?: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-2xl border text-left transition-all ${color} ${
        active ? "ring-2 ring-emerald-500 ring-offset-2 shadow-sm scale-[1.02]" : "hover:scale-[1.01]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor || "bg-slate-200 text-slate-700"}`}>
          {count}
        </span>
      </div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-xl font-black mt-0.5">{count}</div>
    </button>
  );
}

function StatusBadge({ status }: { status: ViolationReportStatus | string }) {
  switch (status) {
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200 whitespace-nowrap">
          <Clock className="h-3 w-3" />
          Chờ xử lý
        </span>
      );
    case "REVIEWING":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
          <AlertTriangle className="h-3 w-3" />
          Đang xem xét
        </span>
      );
    case "RESOLVED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
          <CheckCircle className="h-3 w-3" />
          Đã xử lý
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
          <XCircle className="h-3 w-3" />
          Từ chối
        </span>
      );
    default:
      return <span className="text-xs text-slate-500 whitespace-nowrap">{status}</span>;
  }
}

function getStatusLabel(status: ViolationReportStatus): string {
  switch (status) {
    case "PENDING":
      return "Chờ xử lý";
    case "REVIEWING":
      return "Đang xem xét";
    case "RESOLVED":
      return "Đã xử lý";
    case "REJECTED":
      return "Từ chối";
  }
}
