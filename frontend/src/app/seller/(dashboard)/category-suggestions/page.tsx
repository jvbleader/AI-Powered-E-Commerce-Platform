"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import {
  submitSellerCategorySuggestion,
  fetchSellerCategorySuggestions,
  CategorySuggestion,
} from "@/services/admin-api";
import { formatDate } from "@/lib/helpers";
import { Inbox, PlusCircle, Send } from "lucide-react";

export default function CategorySuggestionsPage() {
  const { showToast } = useMarketplaceStore();

  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMySuggestions = async () => {
    try {
      setLoading(true);
      const data = await fetchSellerCategorySuggestions();
      setSuggestions(data || []);
    } catch (error) {
      console.error(error);
      // If error occurs, keep empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMySuggestions();
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast("Vui lòng nhập tên danh mục bạn muốn đề xuất.", "danger");
      return;
    }

    try {
      setSubmitting(true);
      await submitSellerCategorySuggestion({
        suggested_name: name.trim(),
        reason: reason.trim() || undefined,
      });

      showToast("Đã gửi đề xuất danh mục thành công! Vui lòng chờ Admin xét duyệt.", "success");
      setName("");
      setReason("");
      await loadMySuggestions();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Không thể gửi đề xuất danh mục.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (st: string) => {
    switch (st) {
      case "PENDING":
        return "Chờ duyệt";
      case "APPROVED":
        return "Đã duyệt";
      case "REJECTED":
        return "Từ chối";
      default:
        return st;
    }
  };

  return (
    <Section title="Đề xuất danh mục mới" className="space-y-6">
      {/* Form đề xuất */}
      <Panel className="border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
          <PlusCircle className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Gửi đề xuất mở danh mục ngành hàng</h3>
            <p className="text-xs text-slate-500">
              Nếu mặt hàng của bạn chưa có danh mục phù hợp, hãy gửi đề xuất để ban quản trị xem xét mở rộng.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Tên danh mục đề xuất *">
            <Input
              placeholder="Ví dụ: Đồ chơi mô hình, Linh kiện cơ khí..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Lý do / Mô tả chi tiết">
            <Input
              placeholder="Ví dụ: Cần bán các sản phẩm mô hình Anime chưa có ngành hàng riêng..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 h-10 px-5"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Đang gửi..." : "Gửi đề xuất"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Lịch sử đề xuất */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Lịch sử đề xuất của bạn</h3>

        {loading ? (
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <TableSkeleton headers={["Tên danh mục đề xuất", "Lý do", "Ngày gửi", "Trạng thái"]} rows={4} />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Inbox className="w-8 h-8 mb-2 stroke-1" />
            <p className="text-sm font-medium">Bạn chưa gửi đề xuất danh mục nào.</p>
          </div>
        ) : (
          <DataTable
            columns={["Tên danh mục đề xuất", "Lý do", "Ngày gửi", "Trạng thái"]}
            rows={suggestions.map((item) => [
              <span key="name" className="font-semibold text-slate-900 text-xs">
                {item.suggested_name}
              </span>,
              <div key="reason" className="max-w-[280px] truncate text-slate-600 text-xs" title={item.reason || ""}>
                {item.reason || <span className="text-slate-300 italic">Không có lý do</span>}
              </div>,
              <span key="date" className="text-xs text-slate-500 whitespace-nowrap">
                {formatDate(item.created_at)}
              </span>,
              <span key="status">
                <StatusBadge status={item.status} label={statusLabel(item.status)} className="text-xs" />
              </span>,
            ])}
          />
        )}
      </div>
    </Section>
  );
}
