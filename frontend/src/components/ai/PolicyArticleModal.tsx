"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  ShieldCheck,
  Bookmark,
  ExternalLink,
  Download,
  Sparkles,
} from "lucide-react";
import { AICitationItem } from "@/services/aiChatService";
import { getApiBaseUrl } from "@/services/api";
import { cn } from "@/lib/utils";
import { PDFInPageHighlighter } from "./PDFInPageHighlighter";

export interface PolicyArticleModalProps {
  citation: AICitationItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  RETURN_REFUND: "Đổi trả & Hoàn tiền",
  WARRANTY: "Chính sách Bảo hành",
  SHIPPING: "Vận chuyển & Giao nhận",
  PAYMENT: "Phương thức Thanh toán",
  DISPUTE: "Giải quyết Tranh chấp",
  GENERAL: "Quy định & Chính sách Chung",
};

export function PolicyArticleModal({
  citation,
  isOpen,
  onClose,
}: PolicyArticleModalProps) {
  const [viewerMode, setViewerMode] = useState<"highlight" | "native">("highlight");

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !citation) return null;

  const displayTitle = citation.title || "Tài liệu chính sách";
  const displayCategory =
    (citation.category && CATEGORY_LABELS[citation.category]) ||
    citation.category ||
    "Tài liệu chính sách sàn";

  const targetPage = citation.page_number || 1;
  const rawFileUrl = citation.file_url
    ? citation.file_url.startsWith("http")
      ? citation.file_url
      : `${getApiBaseUrl()}${citation.file_url}`
    : "";

  // Build native PDF viewer URL
  const pdfHashParams = new URLSearchParams();
  pdfHashParams.set("page", String(targetPage));
  pdfHashParams.set("view", "FitH");
  const pdfViewUrl = rawFileUrl ? `${rawFileUrl}#${pdfHashParams.toString()}` : "";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 font-body-tech">
      {/* Backdrop click handler */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Container */}
      <div
        className="relative z-10 w-full max-w-5xl max-h-[94vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/90 px-4 sm:px-6 py-3">
          <div className="space-y-1 pr-4 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <FileText className="w-3 h-3 text-rose-600" />
                Văn bản PDF
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                {displayCategory}
              </span>
              {citation.page_number && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <Bookmark className="w-3 h-3 text-amber-600" />
                  Đang mở Trang {citation.page_number}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
              {displayTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Viewer Mode Switcher */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => setViewerMode("highlight")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer",
                  viewerMode === "highlight"
                    ? "bg-yellow-400 text-slate-950 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
                title="Bôi vàng highlight trực tiếp trong từng dòng chữ của file PDF"
              >
                <Sparkles className="w-3 h-3 text-amber-900" />
                <span>Highlight PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setViewerMode("native")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 cursor-pointer",
                  viewerMode === "native"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
                title="Xem qua trình đọc PDF mặc định của trình duyệt"
              >
                <FileText className="w-3 h-3" />
                <span>Gốc</span>
              </button>
            </div>

            {rawFileUrl && (
              <>
                <a
                  href={pdfViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-medium"
                  title="Mở trong tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href={rawFileUrl}
                  download
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-medium"
                  title="Tải file PDF"
                >
                  <Download className="w-4 h-4" />
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Highlighting PDF Engine */}
        <div className="flex-1 bg-slate-900 flex flex-col min-h-[550px] h-[75vh] relative overflow-hidden">
          {rawFileUrl ? (
            viewerMode === "highlight" ? (
              <PDFInPageHighlighter
                key={`hl-${rawFileUrl}-${targetPage}`}
                fileUrl={rawFileUrl}
                initialPage={targetPage}
                excerpt={citation.excerpt || ""}
                className="w-full h-full"
              />
            ) : (
              <iframe
                key={`native-${pdfViewUrl}`}
                src={pdfViewUrl}
                className="w-full h-full flex-1 border-0 bg-white"
                title={displayTitle}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400 space-y-3">
              <FileText className="w-12 h-12 text-slate-500" />
              <p className="text-sm font-medium">Không tìm thấy đường dẫn file PDF gốc.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-2.5 shrink-0">
          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Văn bản PDF chính thức của Sàn TMĐT Shepoo
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer active:scale-95 shrink-0"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
