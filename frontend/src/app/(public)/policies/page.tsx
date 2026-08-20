"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  BookOpen,
  ArrowLeft,
  Eye,
  Download,
  Loader2,
  ShieldCheck,
  RotateCcw,
  Truck,
  CreditCard,
  UserCheck,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { policyService, PublicPolicyItem } from "@/services/policyService";
import { PolicyArticleModal } from "@/components/ai/PolicyArticleModal";
import type { AICitationItem } from "@/services/aiChatService";
import { getApiBaseUrl } from "@/services/api";
import { formatDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";

const CATEGORY_TABS = [
  { id: "ALL", label: "Tất cả chính sách", icon: BookOpen },
  { id: "RETURN_REFUND", label: "Đổi trả & Hoàn tiền", icon: RotateCcw },
  { id: "SHIPPING", label: "Vận chuyển & Giao hàng", icon: Truck },
  { id: "WARRANTY", label: "Bảo hành & Sửa chữa", icon: ShieldCheck },
  { id: "PAYMENT", label: "Thanh toán & Ví", icon: CreditCard },
  { id: "ACCOUNT", label: "Tài khoản & Bảo mật", icon: UserCheck },
  { id: "GENERAL", label: "Quy chế hoạt động", icon: HelpCircle },
];

export default function PublicPoliciesPage() {
  const [policies, setPolicies] = useState<PublicPolicyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCitation, setSelectedCitation] = useState<AICitationItem | null>(null);

  const loadPolicies = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await policyService.fetchPolicies({
        category: selectedCategory === "ALL" ? undefined : selectedCategory,
        search: searchQuery.trim() || undefined,
      });
      setPolicies(data || []);
    } catch {
      setPolicies([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleOpenPdf = (item: PublicPolicyItem) => {
    setSelectedCitation({
      article_id: String(item.id),
      title: item.title,
      category: item.category,
      slug: item.slug,
      page_number: 1,
      file_url: item.file_url,
      excerpt: item.summary || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Trung tâm Điều khoản & Quy chế Sàn Shepoo</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">
                Chính Sách & Hướng Dẫn Khách Hàng
              </h1>
              <p className="text-sm md:text-base text-slate-500 mt-2 max-w-2xl leading-relaxed">
                Tra cứu chi tiết các văn bản quy chế hoạt động, chính sách đổi trả 7 ngày, quy định bảo hành, vận chuyển và giải quyết tranh chấp chính thức trên sàn thương mại điện tử Shepoo.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm điều khoản, từ khóa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs md:text-sm font-medium transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                    isActive
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content List */}
      <div className="max-w-6xl mx-auto px-4 pt-8">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-xs font-medium">Đang tải tài liệu chính sách...</p>
          </div>
        ) : policies.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200 p-8 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy tài liệu phù hợp</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Thử tìm kiếm với từ khóa khác hoặc chọn mục "Tất cả chính sách".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {policies.map((item) => {
              const downloadUrl = item.file_url.startsWith("http")
                ? item.file_url
                : `${getApiBaseUrl()}${item.file_url}`;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Icon & Page Count */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs border border-rose-100 group-hover:scale-105 transition-transform">
                        PDF
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                        {item.page_count ?? 1} trang PDF
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-base text-slate-900 line-clamp-2 group-hover:text-emerald-700 transition-colors leading-snug">
                      {item.title}
                    </h3>

                    {/* Summary */}
                    {item.summary && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  {/* Footer & Action Buttons */}
                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>{formatDate(item.updated_at || item.created_at)}</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenPdf(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem PDF</span>
                      </button>

                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Tải file PDF gốc"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF Reader Modal */}
      <PolicyArticleModal
        isOpen={Boolean(selectedCitation)}
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}
