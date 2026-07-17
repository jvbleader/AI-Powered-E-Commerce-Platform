"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { Product, ProductVariant } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function ProductForm({ productId }: { productId?: string }) {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;

  const editing = store.state.products.find((product) => product.id === productId);
  const editingVariants = editing ? store.state.variants.filter((v) => v.productId === editing.id) : [];

  const [name, setName] = useState(editing?.name ?? "");
  const [shortDescription, setShortDescription] = useState(editing?.shortDescription ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [brand, setBrand] = useState(editing?.brand ?? "");
  const [origin, setOrigin] = useState(editing?.origin ?? "Việt Nam");
  const [warranty, setWarranty] = useState(editing?.warranty ?? "");
  const [status, setStatus] = useState<Product["status"]>(editing?.status ?? "ACTIVE");
  const [categoryIds, setCategoryIds] = useState<string[]>(editing?.categoryIds ?? []);
  const [imageUrl, setImageUrl] = useState(editing?.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80");
  const slug = slugify(name || "san-pham-moi");

  const [hasVariants, setHasVariants] = useState(editing && editing.variantOptions && editing.variantOptions.length > 0 ? true : false);
  const [options, setOptions] = useState<{name: string, values: string[], rawValue?: string}[]>(
    editing?.variantOptions ? editing.variantOptions : []
  );
  const [variantMatrix, setVariantMatrix] = useState<{
    tierIndex: number[];
    sku: string;
    price: string;
    quantity: string;
    imageUrl: string;
    publicId?: string;
  }[]>([{ tierIndex: [], sku: "", price: "199000", quantity: "20", imageUrl: imageUrl }]);

  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkQuantity, setBulkQuantity] = useState("");

  useEffect(() => {
    if (editing) {
      setName(editing.name ?? "");
      setShortDescription(editing.shortDescription ?? "");
      setDescription(editing.description ?? "");
      setBrand(editing.brand ?? "");
      setOrigin(editing.origin ?? "Việt Nam");
      setWarranty(editing.warranty ?? "");
      setStatus(editing.status ?? "ACTIVE");
      setCategoryIds(editing.categoryIds ?? []);
      setImageUrl(editing.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80");
      
      if (editing.variantOptions && editing.variantOptions.length > 0) {
        setHasVariants(true);
        setOptions(editing.variantOptions);
      } else {
        setHasVariants(false);
        setOptions([]);
      }

      const newMatrix = editingVariants.map(v => ({
          tierIndex: v.tierIndex ?? [],
          sku: v.sku,
          price: v.price.toString(),
          quantity: v.inventory?.quantity.toString() ?? "0",
          imageUrl: v.imageUrl ?? (editing.thumbnailUrl || ""),
          publicId: v.id
      }));
      
      if (!editing.variantOptions || editing.variantOptions.length === 0) {
          if (editingVariants.length > 0) {
              setVariantMatrix([{
                  tierIndex: [],
                  sku: editingVariants[0].sku,
                  price: editingVariants[0].price.toString(),
                  quantity: editingVariants[0].inventory?.quantity.toString() ?? "0",
                  imageUrl: editingVariants[0].imageUrl ?? (editing.thumbnailUrl || ""),
                  publicId: editingVariants[0].id
              }]);
          }
      } else {
          setVariantMatrix(newMatrix);
      }
    }
  }, [editing, store.state.variants]);

  // Generate Cartesian Product of options
  useEffect(() => {
      if (!hasVariants || options.length === 0) return;
      
      const generateCartesian = (opts: {name: string, values: string[]}[]): number[][] => {
          if (opts.length === 0) return [[]];
          const first = opts[0];
          const rest = generateCartesian(opts.slice(1));
          const result: number[][] = [];
          for (let i = 0; i < first.values.length; i++) {
              for (const r of rest) {
                  result.push([i, ...r]);
              }
          }
          return result;
      };

      const allCombinations = generateCartesian(options.filter(o => o.values.length > 0));
      
      // Preserve existing data in matrix if tierIndex matches
      setVariantMatrix(prev => {
          return allCombinations.map(combo => {
              const existing = prev.find(p => p.tierIndex && p.tierIndex.length === combo.length && p.tierIndex.every((val, idx) => val === combo[idx]));
              if (existing) return existing;
              return {
                  tierIndex: combo,
                  sku: `${shop?.shopSlug}-${slug}-${combo.join("")}`,
                  price: "0",
                  quantity: "0",
                  imageUrl: imageUrl
              };
          });
      });

  }, [options, hasVariants]);

  const handleApplyBulk = () => {
      setVariantMatrix(prev => prev.map(row => ({
          ...row,
          price: bulkPrice ? bulkPrice : row.price,
          quantity: bulkQuantity ? bulkQuantity : row.quantity
      })));
  };

  const handleAddOption = () => {
      if (options.length >= 2) return;
      setOptions([...options, { name: `Nhóm phân loại ${options.length + 1}`, values: [] }]);
  };

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi quản lý sản phẩm." />;
  }

  return (
    <Section title={editing ? "Sửa sản phẩm" : "Tạo sản phẩm"}>
      <Panel>
        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          <div className="grid gap-4">
            <Field label="Tên sản phẩm"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <InfoRow label="Slug preview" value={slug} />
            <Field label="Mô tả ngắn"><Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} /></Field>
            <Field label="Mô tả dài"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Brand"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
              <Field label="Xuất xứ"><Input value={origin} onChange={(e) => setOrigin(e.target.value)} /></Field>
              <Field label="Bảo hành"><Input value={warranty} onChange={(e) => setWarranty(e.target.value)} /></Field>
            </div>
            <Field label="URL ảnh sản phẩm chính">
              <Input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Nhập URL ảnh" />
            </Field>
            <Field label="Danh mục sản phẩm">
              <div className="grid gap-2 sm:grid-cols-2">
                {store.state.categories.map((category) => (
                  <Checkbox
                    key={category.id}
                    label={category.name}
                    checked={categoryIds.includes(category.id)}
                    onChange={(event) => {
                      setCategoryIds((prev) => event.target.checked ? [...prev, category.id] : prev.filter((id) => id !== category.id));
                    }}
                  />
                ))}
              </div>
            </Field>
          </div>
          
          <div className="grid gap-4">
            <Panel className="shadow-none flex flex-col gap-4">
              <h3 className="font-bold border-b pb-2">Phân loại hàng (Variant Options)</h3>
              <Checkbox 
                  label="Sản phẩm có nhiều phân loại?" 
                  checked={hasVariants} 
                  onChange={e => {
                      setHasVariants(e.target.checked);
                      if (!e.target.checked) {
                          setOptions([]);
                          setVariantMatrix([{ tierIndex: [], sku: `${shop?.shopSlug}-${slug}-1`, price: "0", quantity: "0", imageUrl: imageUrl }]);
                      } else if (options.length === 0) {
                          setOptions([{ name: "Màu sắc", values: ["Đỏ", "Xanh"] }]);
                      }
                  }} 
              />

              {hasVariants && (
                  <div className="space-y-4">
                      {options.map((opt, oIdx) => (
                          <div key={oIdx} className="bg-slate-50 dark:bg-slate-800 p-3 rounded border space-y-2">
                              <div className="flex justify-between items-center">
                                  <Input value={opt.name} onChange={e => {
                                      const newOpts = [...options];
                                      newOpts[oIdx].name = e.target.value;
                                      setOptions(newOpts);
                                  }} className="w-1/2" />
                                  <Button variant="danger" onClick={() => {
                                      setOptions(options.filter((_, i) => i !== oIdx));
                                  }}>Xóa</Button>
                              </div>
                              <div>
                                  <label className="text-xs text-slate-500">Các giá trị (Cách nhau bởi dấu phẩy)</label>
                                  <Input 
                                      value={opt.rawValue ?? opt.values.join(", ")} 
                                      onChange={e => {
                                          const newOpts = [...options];
                                          newOpts[oIdx].rawValue = e.target.value;
                                          newOpts[oIdx].values = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                                          setOptions(newOpts);
                                      }} 
                                      placeholder="Ví dụ: Đỏ, Xanh, Vàng" 
                                  />
                              </div>
                          </div>
                      ))}
                      {options.length < 2 && (
                          <Button variant="secondary" onClick={handleAddOption} className="w-full text-sm">
                              + Thêm nhóm phân loại
                          </Button>
                      )}
                  </div>
              )}
            </Panel>
            
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value as Product["status"])}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="HIDDEN">HIDDEN</option>
                <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
                <option value="DELETED">DELETED</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="mt-8 border-t pt-8">
          <h3 className="font-bold text-lg mb-4">Ma trận phân loại hàng</h3>
          {hasVariants && (
              <div className="flex items-center gap-3 mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded border">
                  <span className="font-semibold text-sm">Áp dụng cho tất cả:</span>
                  <Input placeholder="Giá bán..." value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} type="number" className="w-32" />
                  <Input placeholder="Tồn kho..." value={bulkQuantity} onChange={e => setBulkQuantity(e.target.value)} type="number" className="w-32" />
                  <Button variant="secondary" onClick={handleApplyBulk}>Áp dụng</Button>
              </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b">
                      {hasVariants && options.map((o, i) => (
                          <th key={i} className="p-3 text-left font-medium">{o.name}</th>
                      ))}
                      <th className="p-3 text-left font-medium">Giá bán *</th>
                      <th className="p-3 text-left font-medium">Tồn kho *</th>
                      <th className="p-3 text-left font-medium">SKU</th>
                  </tr>
              </thead>
              <tbody>
                  {variantMatrix.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {hasVariants && row.tierIndex.map((optIdx, i) => (
                              <td key={i} className="p-3">{options[i]?.values[optIdx]}</td>
                          ))}
                          <td className="p-3">
                              <Input type="number" value={row.price} onChange={e => {
                                  const newM = [...variantMatrix];
                                  newM[rIdx].price = e.target.value;
                                  setVariantMatrix(newM);
                              }} />
                          </td>
                          <td className="p-3">
                              <Input type="number" value={row.quantity} onChange={e => {
                                  const newM = [...variantMatrix];
                                  newM[rIdx].quantity = e.target.value;
                                  setVariantMatrix(newM);
                              }} />
                          </td>
                          <td className="p-3">
                              <Input value={row.sku} onChange={e => {
                                  const newM = [...variantMatrix];
                                  newM[rIdx].sku = e.target.value;
                                  setVariantMatrix(newM);
                              }} />
                          </td>
                      </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button
              onClick={async () => {
                if (!shop) {
                  showToast("Shop của bạn chưa sẵn sàng để tạo sản phẩm.", "danger");
                  return;
                }

                const payload = {
                  name: name || "Sản phẩm mới",
                  slug,
                  short_description: shortDescription,
                  description: description,
                  brand: brand,
                  origin: origin,
                  warranty_info: warranty,
                  category_ids: categoryIds.map(Number),
                  variant_options: hasVariants ? options : [],
                  images: [
                    { image_url: imageUrl, is_thumbnail: true, sort_order: 1 }
                  ],
                  variants: variantMatrix.map(row => ({
                    public_id: row.publicId,
                    sku: row.sku || `${shop.shopSlug}-${slug}-${row.tierIndex.join("") || "1"}`,
                    variant_name: hasVariants && options.length > 0 
                      ? row.tierIndex.map((tIdx, i) => options[i].values[tIdx]).join(" - ")
                      : "Default",
                    price: Number(row.price) || 0,
                    quantity: Number(row.quantity) || 0,
                    image_url: imageUrl,
                    tier_index: hasVariants ? row.tierIndex : []
                  }))
                };

                let res;
                if (editing) {
                  res = await store.updateSellerProduct(editing.id, payload);
                } else {
                  res = await store.createSellerProduct(payload);
                }

                if (res.ok) {
                  showToast("Đã lưu sản phẩm.", "success");
                  window.location.href = "/seller/products";
                } else {
                  showToast(res.message || "Lỗi lưu sản phẩm", "danger");
                }
              }}
            >
              Lưu sản phẩm
            </Button>
        </div>
      </Panel>
    </Section>
  );
}
