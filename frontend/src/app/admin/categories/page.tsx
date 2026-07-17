"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function AdminCategoriesPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [isDefaultOther, setIsDefaultOther] = useState(false);

  const handleSave = () => {
    if (!name || !slug) {
      showToast("Vui lòng nhập tên và slug cho category.", "danger");
      return;
    }
    const newCategory = {
      id: Date.now().toString(),
      name,
      slug,
      sortOrder: Number(sortOrder) || 0,
      isDefaultOther
    };

    store.setCategories([...store.state.categories, newCategory]);
    showToast("Đã lưu category.", "success");

    // Clear form
    setName("");
    setSlug("");
    setSortOrder("");
    setIsDefaultOther(false);
  };

  return (
    <Section title="Quản lý categories một cấp">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <DataTable
          columns={["Name", "Slug", "Sort", "Default other"]}
          rows={store.state.categories.map((category) => [
            category.name,
            category.slug,
            `${category.sortOrder}`,
            category.isDefaultOther ? "Yes" : "No"
          ])}
        />
        <Panel>
          <h3 className="font-bold">Category form</h3>
          <div className="mt-3 grid gap-3">
            <Input placeholder="Tên category" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <Input type="number" placeholder="Sort order" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            <Checkbox label="is_default_other" checked={isDefaultOther} onChange={(e) => setIsDefaultOther(e.target.checked)} />
            <Button onClick={handleSave}>Lưu</Button>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
