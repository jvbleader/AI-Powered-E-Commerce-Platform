"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FileText,
  UploadCloud,
  RefreshCw,
  Trash2,
  Eye,
  Download,
  Search,
  Check,
  X,
  Loader2,
  Inbox,
  HardDrive,
  BookOpen,
} from "lucide-react";
import {
  adminKnowledgeService,
  KnowledgeBaseArticleItem,
} from "@/services/adminKnowledgeService";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { formatDate } from "@/lib/helpers";
import { getApiBaseUrl } from "@/services/api";
import { PolicyArticleModal } from "@/components/ai/PolicyArticleModal";
import type { AICitationItem } from "@/services/aiChatService";
import { Section, Panel } from "@/components/ui/containers";
import { DataTable } from "@/components/ui/data-table";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG: Record<
  string,
  { label: string; tone: "success" | "info" | "warning" | "purple" | "indigo" | "neutral" }
> = {
  RETURN_REFUND: { label: "Đổi trả & Hoàn tiền", tone: "success" },
  SHIPPING: { label: "Vận chuyển", tone: "info" },
  WARRANTY: { label: "Bảo hành", tone: "warning" },
  PAYMENT: { label: "Thanh toán", tone: "purple" },
  ACCOUNT: { label: "Tài khoản", tone: "indigo" },
  GENERAL: { label: "Quy chế chung", tone: "neutral" },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminKnowledgePage() {
  const { showToast } = useMarketplaceStore();

  const [articles, setArticles] = useState<KnowledgeBaseArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isReindexing, setIsReindexing] = useState(false);

  // Form Upload state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("RETURN_REFUND");
  const [summary, setSummary] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Preview Modal
  const [previewCitation, setPreviewCitation] = useState<AICitationItem | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load articles
  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminKnowledgeService.fetchArticles({
        category: categoryFilter === "ALL" ? undefined : categoryFilter,
        search: searchQuery.trim() || undefined,
        page_size: 50,
      });
      setArticles(res.items || []);
    } catch (err: any) {
      showToast(err.message || "Lỗi tải danh sách tri thức", "danger");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, searchQuery, showToast]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      showToast("Chỉ chấp nhận file định dạng PDF (.pdf)", "danger");
      return;
    }

    if (selected.size > 25 * 1024 * 1024) {
      showToast("Kích thước file PDF tối đa là 25MB", "danger");
      return;
    }

    setFile(selected);
    if (!title) {
      const defaultName = selected.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
      setTitle(defaultName.charAt(0).toUpperCase() + defaultName.slice(1));
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      showToast("Vui lòng chọn một file PDF", "danger");
      return;
    }

    if (!title.trim()) {
      showToast("Vui lòng nhập tiêu đề tài liệu", "danger");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      formData.append("category", category);
      if (summary.trim()) {
        formData.append("summary", summary.trim());
      }
      formData.append("is_published", String(isPublished));

      const newArticle = await adminKnowledgeService.uploadPdfArticle(formData);
      showToast(
        `Đã tải lên và vector hóa: ${newArticle.title} (${newArticle.page_count} trang)`,
        "success"
      );

      // Reset form
      setFile(null);
      setTitle("");
      setSummary("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadArticles();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi tải lên file PDF", "danger");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Delete
  const handleDeleteArticle = async (id: number, articleTitle: string) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa tài liệu: "${articleTitle}"?\nTất cả vector trong Elasticsearch và file PDF sẽ bị xóa.`
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);
      await adminKnowledgeService.deleteArticle(id);
      showToast("Đã xóa tài liệu thành công", "success");
      await loadArticles();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi xóa tài liệu", "danger");
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Re-index All
  const handleReindexAll = async () => {
    if (
      !confirm(
        "Hệ thống sẽ nạp lại toàn bộ văn bản chính sách và cập nhật vector 1024-dim vào Elasticsearch. Tiếp tục?"
      )
    ) {
      return;
    }

    try {
      setIsReindexing(true);
      const res = await adminKnowledgeService.reindexAll();
      showToast(
        `Đồng bộ hoàn tất: ${res.indexed_articles} tài liệu (${res.total_chunks} chunks).`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Lỗi khi đồng bộ Elasticsearch", "danger");
    } finally {
      setIsReindexing(false);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (article: KnowledgeBaseArticleItem) => {
    setPreviewCitation({
      article_id: String(article.id),
      title: article.title,
      category: article.category,
      slug: article.slug,
      page_number: 1,
      file_url: article.file_url,
      excerpt:
        article.summary ||
        `Tài liệu chính sách "${article.title}" đã được lưu trữ, xử lý vector và lập chỉ mục trong kho tri thức AI.`,
    });
  };

  return (
    <Section
      title="Quản trị Tri thức AI / RAG"
      action={
        <Button
          variant="outline"
          onClick={handleReindexAll}
          disabled={isReindexing}
          className="text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isReindexing && "animate-spin")} />
          <span>{isReindexing ? "Đang đồng bộ..." : "Đồng bộ Elasticsearch"}</span>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Data Table & Filters */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-panel border border-line shadow-soft">
            <div className="flex items-center gap-2.5 flex-1 max-w-lg">
              <div className="w-48 sm:w-56 shrink-0">
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-9 text-xs font-medium text-ink bg-slate-50/60 border-line hover:border-primary/50 focus:border-primary"
                >
                  <option value="ALL">Tất cả danh mục ({articles.length})</option>
                  <option value="RETURN_REFUND">
                    Đổi trả & Hoàn tiền ({articles.filter((a) => a.category === "RETURN_REFUND").length})
                  </option>
                  <option value="SHIPPING">
                    Vận chuyển ({articles.filter((a) => a.category === "SHIPPING").length})
                  </option>
                  <option value="WARRANTY">
                    Bảo hành ({articles.filter((a) => a.category === "WARRANTY").length})
                  </option>
                  <option value="PAYMENT">
                    Thanh toán ({articles.filter((a) => a.category === "PAYMENT").length})
                  </option>
                  <option value="ACCOUNT">
                    Tài khoản ({articles.filter((a) => a.category === "ACCOUNT").length})
                  </option>
                  <option value="GENERAL">
                    Quy chế chung ({articles.filter((a) => a.category === "GENERAL").length})
                  </option>
                </Select>
              </div>

              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tiêu đề, file..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 h-9 text-xs bg-slate-50/60 border border-line rounded-panel focus:outline-none focus:border-primary focus:bg-white text-ink transition-colors placeholder:text-muted/70"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex flex-col flex-1 overflow-hidden bg-white rounded-panel border border-line shadow-soft">
            {loading ? (
              <div className="p-4">
                <TableSkeleton
                  headers={[
                    "Tài liệu",
                    "Danh mục",
                    "Trang / Size",
                    "Lượt đọc",
                    "Trạng thái",
                    "Ngày cập nhật",
                    "Thao tác",
                  ]}
                  rows={6}
                />
              </div>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Inbox className="w-10 h-10 mb-2 stroke-1" />
                <p className="text-sm font-medium">Chưa có tài liệu tri thức nào phù hợp.</p>
              </div>
            ) : (
              <DataTable
                columns={[
                  "Tài liệu",
                  "Danh mục",
                  "Trang / Size",
                  "Lượt đọc",
                  "Trạng thái",
                  "Ngày cập nhật",
                  "Thao tác",
                ]}
                rows={articles.map((item) => {
                  const catCfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.GENERAL;
                  const downloadUrl = item.file_url.startsWith("http")
                    ? item.file_url
                    : `${getApiBaseUrl()}${item.file_url}`;

                  return [
                    <div key="doc" className="flex items-start gap-2.5 max-w-[240px]">
                      <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 font-bold text-[9px] mt-0.5">
                        PDF
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink text-xs line-clamp-1" title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-[11px] text-muted truncate" title={item.file_name}>
                          {item.file_name}
                        </p>
                      </div>
                    </div>,

                    <Badge key="cat" tone={catCfg.tone} className="text-[11px]">
                      {catCfg.label}
                    </Badge>,

                    <div key="size" className="text-xs">
                      <span className="font-medium text-ink">{item.page_count ?? 1} trang</span>
                      <span className="text-muted text-[11px] ml-1">
                        ({formatFileSize(item.file_size)})
                      </span>
                    </div>,

                    <span key="views" className="text-xs font-medium text-slate-700">
                      {item.view_count}
                    </span>,

                    <StatusBadge
                      key="status"
                      status={item.is_published ? "ACTIVE" : "INACTIVE"}
                      label={item.is_published ? "Hoạt động" : "Tạm ẩn"}
                      className="text-xs"
                    />,

                    <span key="date" className="text-xs text-muted whitespace-nowrap">
                      {formatDate(item.updated_at || item.created_at)}
                    </span>,

                    <div key="actions" className="flex items-center gap-1">
                      <IconButton
                        onClick={() => handleOpenPreview(item)}
                        className="h-8 w-8 text-slate-500 hover:text-primary"
                        title="Xem trước PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </IconButton>

                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex h-8 w-8 items-center justify-center rounded-panel border border-line bg-white text-slate-500 hover:text-blue-600 transition-colors"
                        title="Tải file gốc"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <IconButton
                        onClick={() => handleDeleteArticle(item.id, item.title)}
                        disabled={deletingId === item.id}
                        className="h-8 w-8 text-slate-400 hover:text-coral"
                        title="Xóa tài liệu"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-coral" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </IconButton>
                    </div>,
                  ];
                })}
              />
            )}
          </div>
        </div>

        {/* Right Column: Upload Panel */}
        <Panel>
          <h3 className="font-bold text-base text-ink">Upload knowledge</h3>
          <p className="text-xs text-muted mt-0.5">
            Tự động trích xuất text từng trang và tạo vector 1024-dim vào Elasticsearch.
          </p>

          <form onSubmit={handleUploadSubmit} className="mt-4 grid gap-3">
            {/* File Drop Box */}
            <Field label="File PDF *">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-panel p-3 text-center cursor-pointer transition-colors hover:bg-slate-50",
                  file ? "border-primary bg-emerald-50/30" : "border-line bg-slate-50/40"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs text-ink truncate max-w-[260px] mx-auto">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-primary font-medium">
                      {formatFileSize(file.size)} • Bấm để đổi file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 py-1 text-slate-400">
                    <UploadCloud className="w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-xs font-medium text-slate-600">Chọn hoặc kéo thả file .pdf</p>
                    <p className="text-[10px] text-muted">Tối đa 25MB</p>
                  </div>
                )}
              </div>
            </Field>

            <Field label="Tên tài liệu *">
              <Input
                placeholder="VD: Chính sách Đổi trả & Hoàn tiền"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>

            <Field label="Phân loại danh mục *">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="RETURN_REFUND">Đổi trả & Hoàn tiền (RETURN_REFUND)</option>
                <option value="SHIPPING">Vận chuyển & Giao nhận (SHIPPING)</option>
                <option value="WARRANTY">Bảo hành & Sửa chữa (WARRANTY)</option>
                <option value="PAYMENT">Phương thức Thanh toán (PAYMENT)</option>
                <option value="ACCOUNT">Tài khoản & Bảo mật (ACCOUNT)</option>
                <option value="GENERAL">Quy chế chung (GENERAL)</option>
              </Select>
            </Field>

            <Field label="Tóm tắt ngắn gọn">
              <Textarea
                rows={2}
                placeholder="Tóm tắt nội dung chính..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </Field>

            <Checkbox
              id="is_published_chk"
              label={<span className="text-xs text-ink">Xuất bản và kích hoạt tra cứu AI</span>}
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />

            <Button
              type="submit"
              variant="primary"
              disabled={isUploading || !file}
              className="w-full mt-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang vector hóa...</span>
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </form>
        </Panel>
      </div>

      {/* PDF Article Preview Modal */}
      <PolicyArticleModal
        isOpen={Boolean(previewCitation)}
        citation={previewCitation}
        onClose={() => setPreviewCitation(null)}
      />
    </Section>
  );
}
