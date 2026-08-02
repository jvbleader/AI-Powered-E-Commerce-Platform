"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { fetchAdminProducts, hideAdminProduct, unhideAdminProduct, deleteAdminProduct } from "@/services/admin-api";
import { Product } from "@/types/models";

function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        title="Không tìm thấy route"
        description="Đường dẫn không đúng hoặc không còn tồn tại."
        action={<Button onClick={() => (window.location.href = "/admin/products")}>Về trang danh sách</Button>}
      />
    </main>
  );
}

export default function AdminProductDetailPage() {
  const params = useParams();
  const productId = params.productId as string;
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [productStatus, setProductStatus] = useState<string>("ACTIVE");

  const handleHide = async () => {
    if (!confirm("Bạn có chắc muốn ẩn sản phẩm này?")) return;
    try {
      await hideAdminProduct(productId);
      showToast("Đã ẩn sản phẩm", "success");
      setProductStatus("HIDDEN");
    } catch (error) {
      showToast("Lỗi khi ẩn sản phẩm", "danger");
    }
  };

  const handleUnhide = async () => {
    if (!confirm("Bạn có chắc muốn hiện lại sản phẩm này?")) return;
    try {
      await unhideAdminProduct(productId);
      showToast("Đã hiện sản phẩm", "success");
      setProductStatus("ACTIVE");
    } catch (error) {
      showToast("Lỗi khi hiện sản phẩm", "danger");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc muốn xoá sản phẩm này?")) return;
    try {
      await deleteAdminProduct(productId);
      showToast("Đã xoá sản phẩm", "success");
      setProductStatus("DELETED");
    } catch (error) {
      showToast("Lỗi khi xoá sản phẩm", "danger");
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchAdminProducts()
      .then((data) => {
        if (isMounted) {
          const found = data.find((item) => item.id === productId);
          setProduct(found || null);
          setProductStatus(found?.status || "ACTIVE");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (loading) return <div className="p-10 text-center">Đang tải...</div>;
  if (!product) return <NotFoundPage />;

  return (
    <Section
      title={
        <div className="flex items-center gap-2">
          <span>{product.name}</span>
          <StatusBadge status={productStatus} label={productStatus} />
        </div>
      }
      className="h-full overflow-y-auto pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel>
            <img
              src={
                product.thumbnailUrl ||
                (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80")
              }
              alt={product.name}
              className="aspect-[16/9] w-full rounded-panel object-cover"
            />
            <div className="mt-4 grid gap-2">
              <h3 className="font-bold text-lg">Thông tin tổng quan</h3>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                <div><strong>Đã bán:</strong> {product.soldCount || 0}</div>
                <div><strong>Đánh giá:</strong> {product.averageRating || 0} / 5 ({product.reviewCount || 0} lượt)</div>
                <div><strong>Danh mục:</strong> {(product as any).categories?.map((c: any) => c.name).join(", ") || "Chưa phân loại"}</div>
                <div><strong>Shop:</strong> {(product as any).seller?.shopName || "-"}</div>
              </div>
            </div>
          </Panel>
          <Panel>
            <h3 className="font-bold">Thao tác kiểm duyệt</h3>
            <div className="mt-3 grid gap-2">
              {productStatus === "ACTIVE" && (
                <Button variant="secondary" onClick={handleHide}>
                  Ẩn sản phẩm
                </Button>
              )}
              {productStatus === "HIDDEN" && (
                <Button variant="secondary" onClick={handleUnhide}>
                  Hiện lại sản phẩm
                </Button>
              )}
              {productStatus !== "DELETED" && (
                <Button variant="danger" onClick={handleDelete}>
                  Xóa sản phẩm
                </Button>
              )}
            </div>
          </Panel>
        </div>
        
        <Panel>
          <h3 className="font-bold text-lg mb-3">Mô tả ngắn</h3>
          <div className="text-sm leading-6 text-ink whitespace-pre-wrap mb-6">
            {product.shortDescription || (product as any).short_description || "Chưa có mô tả ngắn."}
          </div>

          <h3 className="font-bold text-lg mb-3">Mô tả chi tiết</h3>
          <div className="text-sm leading-6 text-ink whitespace-pre-wrap">
            {product.description || "Chưa có mô tả chi tiết cho sản phẩm này."}
          </div>
        </Panel>
      </div>
    </Section>
  );
}
