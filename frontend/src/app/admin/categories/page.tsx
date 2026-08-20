"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Field } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Panel, Section } from "@/components/ui/containers";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import {
  fetchAdminCategories,
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategorySuggestions,
  approveAdminCategorySuggestion,
  rejectAdminCategorySuggestion,
  CategorySuggestion,
} from "@/services/admin-api";
import { Category } from "@/types/models";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/helpers";
import { Check, FolderPlus, Inbox, Search, X } from "lucide-react";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default function AdminCategoriesPage() {
  const { showToast } = useMarketplaceStore();
  const [activeTab, setActiveTab] = useState<"categories" | "suggestions">("categories");

  // Tab 1: Categories State
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [isDefaultOther, setIsDefaultOther] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tab 2: Suggestions State
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<string>("ALL");
  const [suggestionSearch, setSuggestionSearch] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<CategorySuggestion | null>(null);

  // Modal Approve Form State
  const [approveName, setApproveName] = useState("");
  const [approveSlug, setApproveSlug] = useState("");
  const [approveSortOrder, setApproveSortOrder] = useState("");
  const [approveIsDefaultOther, setApproveIsDefaultOther] = useState(false);
  const [approving, setApproving] = useState(false);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await fetchAdminCategories();
      setCategories(data.categories || []);
    } catch (error) {
      console.error(error);
      showToast("Lỗi tải danh sách category", "danger");
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const data = await fetchAdminCategorySuggestions();
      setSuggestions(data || []);
    } catch (error) {
      console.error(error);
      showToast("Lỗi tải danh sách đề xuất danh mục", "danger");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadSuggestions();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSuggestion && !approving) {
        setSelectedSuggestion(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSuggestion, approving]);

  // Tính số lượng đề xuất chờ duyệt
  const pendingCount = useMemo(() => {
    return suggestions.filter((s) => s.status === "PENDING").length;
  }, [suggestions]);

  // Tab 1 Actions
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(val));
    }
  };

  const handleSave = async () => {
    if (!name || !slug) {
      showToast("Vui lòng nhập tên và slug cho category.", "danger");
      return;
    }

    try {
      setSaving(true);
      const normalCategories = categories.filter((c: any) => !(c.is_default_other ?? c.isDefaultOther));
      const nextSortOrder =
        normalCategories.length > 0
          ? Math.max(...normalCategories.map((c: any) => c.sort_order ?? c.sortOrder ?? 0)) + 1
          : 1;

      await createAdminCategory({
        name,
        slug,
        sort_order: sortOrder.trim() !== "" ? Number(sortOrder) : nextSortOrder,
        is_default_other: isDefaultOther,
      });
      showToast("Đã lưu category.", "success");

      // Clear form
      setName("");
      setSlug("");
      setSortOrder("");
      setIsDefaultOther(false);

      // Tải lại danh sách
      await loadCategories();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Không thể tạo category.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (categoryId: number) => {
    if (!confirm("Bạn có chắc muốn xoá danh mục này? Việc này cũng sẽ gỡ danh mục khỏi các sản phẩm liên quan.")) return;

    try {
      setLoadingCategories(true);
      await deleteAdminCategory(categoryId);
      showToast("Đã xoá danh mục thành công.", "success");
      await loadCategories();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Không thể xoá danh mục.", "danger");
      setLoadingCategories(false);
    }
  };

  // Tab 2 Actions
  const openApproveModal = (suggestion: CategorySuggestion) => {
    setSelectedSuggestion(suggestion);
    setApproveName(suggestion.suggested_name);
    setApproveSlug(slugify(suggestion.suggested_name));

    const normalCategories = categories.filter((c: any) => !(c.is_default_other ?? c.isDefaultOther));
    const nextSortOrder =
      normalCategories.length > 0
        ? Math.max(...normalCategories.map((c: any) => c.sort_order ?? c.sortOrder ?? 0)) + 1
        : 1;
    setApproveSortOrder(String(nextSortOrder));
    setApproveIsDefaultOther(false);
  };

  const handleApproveSubmit = async () => {
    if (!selectedSuggestion) return;
    if (!approveName.trim()) {
      showToast("Vui lòng nhập tên danh mục.", "danger");
      return;
    }

    try {
      setApproving(true);
      await approveAdminCategorySuggestion(selectedSuggestion.id, {
        name: approveName.trim(),
        slug: approveSlug.trim() ? slugify(approveSlug.trim()) : slugify(approveName.trim()),
        sort_order: approveSortOrder.trim() !== "" ? Number(approveSortOrder) : undefined,
        is_default_other: approveIsDefaultOther,
      });

      showToast(`Đã duyệt đề xuất và tạo danh mục "${approveName}"!`, "success");
      setSelectedSuggestion(null);
      await Promise.all([loadSuggestions(), loadCategories()]);
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Lỗi khi duyệt đề xuất danh mục.", "danger");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (suggestionId: number) => {
    if (!confirm("Bạn có chắc muốn từ chối đề xuất danh mục này?")) return;

    try {
      await rejectAdminCategorySuggestion(suggestionId);
      showToast("Đã từ chối đề xuất danh mục.", "info");
      await loadSuggestions();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Lỗi khi từ chối đề xuất danh mục.", "danger");
    }
  };

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((item) => {
      const matchStatus =
        suggestionStatusFilter === "ALL" || item.status === suggestionStatusFilter;
      const search = suggestionSearch.toLowerCase().trim();
      const matchSearch =
        !search ||
        item.suggested_name.toLowerCase().includes(search) ||
        (item.shop_name && item.shop_name.toLowerCase().includes(search)) ||
        (item.reason && item.reason.toLowerCase().includes(search));
      return matchStatus && matchSearch;
    });
  }, [suggestions, suggestionStatusFilter, suggestionSearch]);

  const suggestionStatusLabel = (st: string) => {
    switch (st) {
      case "PENDING":
        return "Chờ duyệt";
      case "APPROVED":
        return "Đã duyệt";
      case "REJECTED":
        return "Đã từ chối";
      default:
        return st;
    }
  };

  return (
    <Section title="Quản lý danh mục" className="h-full flex flex-col overflow-hidden pb-0">
      {/* Top Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
            activeTab === "categories"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span>Danh mục hiện tại</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              activeTab === "categories" ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
            }`}
          >
            {categories.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("suggestions")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
            activeTab === "suggestions"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span>Đề xuất từ người bán</span>
          {pendingCount > 0 ? (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeTab === "suggestions"
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "bg-amber-100 text-amber-900 border border-amber-300 shadow-xs"
              }`}
            >
              {pendingCount} chờ duyệt
            </span>
          ) : (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                activeTab === "suggestions" ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
              }`}
            >
              {suggestions.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Current Categories View */}
      {activeTab === "categories" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] flex-1 overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">
            {loadingCategories ? (
              <div className="p-4">
                <TableSkeleton headers={["Tên danh mục", "Slug", "Thứ tự", "Mặc định khác", "Thao tác"]} rows={10} />
              </div>
            ) : (
              <DataTable
                columns={["Tên danh mục", "Slug", "Thứ tự", "Mặc định khác", "Thao tác"]}
                rows={categories.map((category: any) => [
                  <span key="name" className="font-medium text-slate-900">{category.name}</span>,
                  <div key="slug" className="max-w-[150px] truncate text-slate-600" title={category.slug}>
                    {category.slug}
                  </div>,
                  <span key="sort" className="text-slate-600">{category.sort_order ?? category.sortOrder ?? "-"}</span>,
                  <span key="default">
                    {(category.is_default_other ?? category.isDefaultOther) ? (
                      <Badge tone="info">Mặc định</Badge>
                    ) : (
                      "-"
                    )}
                  </span>,
                  <Button
                    key="delete"
                    variant="danger"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => handleDelete(category.id)}
                  >
                    Xoá
                  </Button>,
                ])}
              />
            )}
          </div>
          <Panel className="h-fit shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-emerald-600" />
              Thêm danh mục mới
            </h3>
            <div className="mt-3 grid gap-3">
              <Field label="Tên danh mục">
                <Input placeholder="Ví dụ: Thời trang nam" value={name} onChange={(e) => handleNameChange(e.target.value)} />
              </Field>
              <Field label="Slug URL">
                <Input placeholder="thoi-trang-nam" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </Field>
              <Field label="Thứ tự hiển thị">
                <Input
                  type="number"
                  placeholder="Tự động nếu để trống"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </Field>
              <Checkbox
                label="Đặt làm danh mục mặc định ('Khác')"
                checked={isDefaultOther}
                onChange={(e) => setIsDefaultOther(e.target.checked)}
              />
              <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
                {saving ? "Đang lưu..." : "Lưu danh mục"}
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 2: Category Suggestions from Sellers */}
      {activeTab === "suggestions" && (
        <div className="flex flex-col flex-1 overflow-hidden space-y-3">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: "ALL", label: "Tất cả", count: suggestions.length },
                { key: "PENDING", label: "Chờ duyệt", count: pendingCount },
                {
                  key: "APPROVED",
                  label: "Đã duyệt",
                  count: suggestions.filter((s) => s.status === "APPROVED").length,
                },
                {
                  key: "REJECTED",
                  label: "Đã từ chối",
                  count: suggestions.filter((s) => s.status === "REJECTED").length,
                },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSuggestionStatusFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    suggestionStatusFilter === f.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      suggestionStatusFilter === f.key
                        ? "bg-slate-700 text-slate-200"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm shop, tên đề xuất..."
                value={suggestionSearch}
                onChange={(e) => setSuggestionSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
              />
            </div>
          </div>

          {/* Suggestions Table */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {loadingSuggestions ? (
              <div className="p-4">
                <TableSkeleton headers={["Shop đề xuất", "Tên danh mục", "Lý do", "Ngày gửi", "Trạng thái", "Thao tác"]} rows={6} />
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                <Inbox className="w-10 h-10 mb-2 stroke-1" />
                <p className="text-sm font-medium">Không có đề xuất danh mục nào phù hợp.</p>
              </div>
            ) : (
              <DataTable
                columns={["Shop đề xuất", "Tên danh mục", "Lý do", "Ngày gửi", "Trạng thái", "Thao tác"]}
                rows={filteredSuggestions.map((item) => [
                  <div key="shop" className="flex flex-col">
                    <span className="font-semibold text-slate-900 text-xs">
                      {item.shop_name || `Shop #${item.seller_id}`}
                    </span>
                    {item.shop_slug && (
                      <span className="text-[11px] text-slate-400">@{item.shop_slug}</span>
                    )}
                  </div>,
                  <span key="name" className="font-medium text-slate-900 text-sm">
                    {item.suggested_name}
                  </span>,
                  <div key="reason" className="max-w-[240px] truncate text-slate-600 text-xs" title={item.reason || "Không có lý do"}>
                    {item.reason || <span className="text-slate-300 italic">Không có lý do</span>}
                  </div>,
                  <span key="date" className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(item.created_at)}
                  </span>,
                  <span key="status">
                    <StatusBadge
                      status={item.status}
                      label={suggestionStatusLabel(item.status)}
                      className="text-xs"
                    />
                  </span>,
                  <div key="actions" className="flex items-center gap-1.5">
                    {item.status === "PENDING" ? (
                      <>
                        <Button
                          variant="primary"
                          className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                          onClick={() => openApproveModal(item)}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Duyệt & Tạo
                        </Button>
                        <Button
                          variant="danger"
                          className="h-7 px-2 text-xs flex items-center gap-1"
                          onClick={() => handleReject(item.id)}
                        >
                          <X className="w-3.5 h-3.5" />
                          Từ chối
                        </Button>
                      </>
                    ) : item.status === "APPROVED" ? (
                      <span className="text-[11px] text-emerald-600 font-medium">
                        ✓ Đã tạo danh mục
                      </span>
                    ) : (
                      <span className="text-[11px] text-rose-500 font-medium">
                        ✕ Đã từ chối
                      </span>
                    )}
                  </div>,
                ])}
              />
            )}
          </div>
        </div>
      )}

      {/* Modal: Duyệt & Tạo Danh mục */}
      {selectedSuggestion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-category-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !approving) {
              setSelectedSuggestion(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="approve-category-modal-title" className="font-bold text-slate-900 text-sm">Duyệt & Tạo Danh Mục</h3>
                  <p className="text-xs text-slate-500">
                    Đề xuất từ: {selectedSuggestion.shop_name || `Shop #${selectedSuggestion.seller_id}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSuggestion(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {selectedSuggestion.reason && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Lý do từ Seller: </span>
                  {selectedSuggestion.reason}
                </div>
              )}

              <Field label="Tên danh mục chính thức *">
                <Input
                  value={approveName}
                  onChange={(e) => {
                    setApproveName(e.target.value);
                    if (!approveSlug || approveSlug === slugify(approveName)) {
                      setApproveSlug(slugify(e.target.value));
                    }
                  }}
                  placeholder="Nhập tên danh mục..."
                />
              </Field>

              <Field label="Slug URL *">
                <Input
                  value={approveSlug}
                  onChange={(e) => setApproveSlug(e.target.value)}
                  placeholder="slug-danh-muc"
                />
              </Field>

              <Field label="Thứ tự hiển thị (sort order)">
                <Input
                  type="number"
                  value={approveSortOrder}
                  onChange={(e) => setApproveSortOrder(e.target.value)}
                  placeholder="Thứ tự hiển thị..."
                />
              </Field>

              <Checkbox
                label="Đặt làm danh mục mặc định ('Khác')"
                checked={approveIsDefaultOther}
                onChange={(e) => setApproveIsDefaultOther(e.target.checked)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
              <Button
                variant="ghost"
                onClick={() => setSelectedSuggestion(null)}
                disabled={approving}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={handleApproveSubmit}
                disabled={approving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {approving ? "Đang xử lý..." : "Xác nhận tạo danh mục"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
