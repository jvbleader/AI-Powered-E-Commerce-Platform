"use client";

import { useEffect, useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { productStatusLabel } from "@/lib/helpers";
import { fetchAdminProducts, hideAdminProduct, unhideAdminProduct, deleteAdminProduct, fetchAdminCategories } from "@/services/admin-api";
import { Button } from "@/components/ui/button";
import { Product, Category } from "@/types/models";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { Input, Select } from "@/components/ui/input";

import { TableSkeleton } from "@/components/ui/skeleton";

export default function AdminProductsPage() {
  const { showToast } = useMarketplaceStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [categories, setCategories] = useState<Category[]>([]);

  const handleHideProduct = async (productId: string) => {
    if (!confirm("Bạn có chắc muốn ẩn sản phẩm này?")) return;
    try {
      await hideAdminProduct(productId);
      showToast("Đã ẩn sản phẩm", "success");
      setProducts(products.map(p => p.id === productId ? { ...p, status: "HIDDEN" } : p));
    } catch (error) {
      showToast("Lỗi khi ẩn sản phẩm", "danger");
    }
  };

  const handleUnhideProduct = async (productId: string) => {
    if (!confirm("Bạn có chắc muốn hiện lại sản phẩm này?")) return;
    try {
      await unhideAdminProduct(productId);
      showToast("Đã hiện sản phẩm", "success");
      setProducts(products.map(p => p.id === productId ? { ...p, status: "ACTIVE" } : p));
    } catch (error) {
      showToast("Lỗi khi hiện sản phẩm", "danger");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Bạn có chắc muốn xoá sản phẩm này?")) return;
    try {
      await deleteAdminProduct(productId);
      showToast("Đã xoá sản phẩm", "success");
      setProducts(products.map(p => p.id === productId ? { ...p, status: "DELETED" } : p));
    } catch (error) {
      showToast("Lỗi khi xoá sản phẩm", "danger");
    }
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchAdminProducts()
      .then((data) => {
        if (isMounted) {
          setProducts(data);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error(error);
        if (isMounted) {
          showToast("Lỗi tải danh sách sản phẩm", "danger");
          setLoading(false);
        }
      });
    fetchAdminCategories()
      .then((data) => {
        if (isMounted) {
          setCategories(data.categories || []);
        }
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = products;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p as any).seller?.shopName?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (categoryFilter !== "ALL") {
      result = result.filter((p) => 
        (p as any).categories?.some((c: any) => c.id.toString() === categoryFilter || c.slug === categoryFilter)
      );
    }

    result = [...result];
    switch (sortBy) {
      case "sold_desc":
        result.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
        break;
      case "sold_asc":
        result.sort((a, b) => (a.soldCount || 0) - (b.soldCount || 0));
        break;
      case "name_asc":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      // "newest" uses original array order which is created_at desc from API
    }
    return result;
  }, [products, searchQuery, sortBy]);

  return (
    <Section 
      title="Sản phẩm toàn sàn" 
      className="h-full flex flex-col overflow-hidden pb-0"
      action={
        <div className="flex items-center gap-3">
          <Input
            placeholder="Tìm theo tên sản phẩm, shop..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36 text-sm"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="HIDDEN">Đã ẩn</option>
            <option value="OUT_OF_STOCK">Hết hàng</option>
            <option value="DELETED">Đã xoá</option>
          </Select>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-40 text-sm"
          >
            <option value="ALL">Tất cả danh mục</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </option>
            ))}
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-40 text-sm"
          >
            <option value="newest">Mới nhất</option>
            <option value="sold_desc">Bán chạy nhất</option>
            <option value="sold_asc">Bán ế nhất</option>
            <option value="name_asc">Tên A-Z</option>
            <option value="name_desc">Tên Z-A</option>
          </Select>
        </div>
      }
    >
      {loading ? (
        <div className="p-4"><TableSkeleton headers={["Product", "Shop", "Category", "Status", "Sold", "Action"]} rows={10} /></div>
      ) : (
        <DataTable
          columns={["Product", "Shop", "Category", "Status", "Sold", "Action"]}
          rows={filteredAndSortedProducts.map((product) => [
            <a key="p" className="font-bold text-primary" href={`/admin/products/${product.id}`}>
              {product.name}
            </a>,
            (product as any).seller?.shopName ?? "-",
            (product as any).categories?.map((c: any) => c.name).join(", ") || "-",
            <StatusBadge key="st" status={product.status} label={productStatusLabel[product.status]} />,
            `${product.soldCount}`,
            <div key="act" className="flex gap-2">
              {product.status === "ACTIVE" && (
                <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => handleHideProduct(product.id)}>
                  Ẩn
                </Button>
              )}
              {product.status === "HIDDEN" && (
                <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => handleUnhideProduct(product.id)}>
                  Hiện
                </Button>
              )}
              {product.status !== "DELETED" && (
                <Button variant="danger" className="h-8 px-2 text-xs" onClick={() => handleDeleteProduct(product.id)}>
                  Xoá
                </Button>
              )}
            </div>
          ])}
        />
      )}
    </Section>
  );
}
