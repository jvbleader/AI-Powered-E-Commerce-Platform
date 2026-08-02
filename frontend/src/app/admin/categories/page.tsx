"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { fetchAdminCategories, createAdminCategory, deleteAdminCategory } from "@/services/admin-api";
import { Category } from "@/types/models";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function AdminCategoriesPage() {
  const { showToast } = useMarketplaceStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [isDefaultOther, setIsDefaultOther] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminCategories();
      setCategories(data.categories || []);
    } catch (error) {
      console.error(error);
      showToast("Lỗi tải danh sách category", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSave = async () => {
    if (!name || !slug) {
      showToast("Vui lòng nhập tên và slug cho category.", "danger");
      return;
    }
    
    try {
      setSaving(true);
      const normalCategories = categories.filter((c: any) => !(c.is_default_other ?? c.isDefaultOther));
      const nextSortOrder = normalCategories.length > 0
        ? Math.max(...normalCategories.map((c: any) => c.sort_order ?? c.sortOrder ?? 0)) + 1
        : 1;

      await createAdminCategory({
        name,
        slug,
        sort_order: sortOrder.trim() !== "" ? Number(sortOrder) : nextSortOrder,
        is_default_other: isDefaultOther
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
      setLoading(true);
      await deleteAdminCategory(categoryId);
      showToast("Đã xoá danh mục thành công.", "success");
      await loadCategories();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Không thể xoá danh mục.", "danger");
      setLoading(false);
    }
  };

  return (
    <Section title="Quản lý categories" className="h-full flex flex-col overflow-hidden pb-0">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px] flex-1 overflow-hidden">
        <div className="flex flex-col h-full overflow-hidden">
          {loading ? (
            <div className="p-4"><TableSkeleton headers={["Name", "Slug", "Sort", "Default other", "Action"]} rows={10} /></div>
          ) : (
            <DataTable
              columns={["Name", "Slug", "Sort", "Default other", "Action"]}
              rows={categories.map((category: any) => [
                category.name,
                <div key="slug" className="max-w-[150px] truncate" title={category.slug}>
                  {category.slug}
                </div>,
                `${category.sort_order ?? category.sortOrder ?? "-"}`,
                (category.is_default_other ?? category.isDefaultOther) ? "Yes" : "No",
                <Button key="delete" variant="danger" className="h-7 px-2.5 text-xs" onClick={() => handleDelete(category.id)}>
                  Xoá
                </Button>
              ])}
            />
          )}
        </div>
        <Panel className="h-fit">
          <h3 className="font-bold">Category form</h3>
          <div className="mt-3 grid gap-3">
            <Input placeholder="Tên category" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <Input type="number" placeholder="Sort order" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            <Checkbox label="is_default_other" checked={isDefaultOther} onChange={(e) => setIsDefaultOther(e.target.checked)} />
            <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
