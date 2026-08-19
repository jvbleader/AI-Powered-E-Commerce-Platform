"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { fetchAdminProducts, hideAdminProduct, unhideAdminProduct, deleteAdminProduct } from "@/services/admin-api";
import { Product } from "@/types/models";
import { formatVnd, productStatusLabel } from "@/lib/helpers";

function NotFoundPage({ onBack }: { onBack?: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        title="Không tìm thấy route"
        description="Đường dẫn không đúng hoặc không còn tồn tại."
        action={<Button onClick={onBack}>Về trang danh sách</Button>}
      />
    </main>
  );
}

export default function AdminProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [productStatus, setProductStatus] = useState<string>("ACTIVE");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const allImages = useMemo(() => {
    if (!product) return [];
    const set = new Set<string>();
    if (product.thumbnailUrl) set.add(product.thumbnailUrl);
    if (product.imageUrls && Array.isArray(product.imageUrls)) {
      product.imageUrls.forEach((url) => {
        if (url) set.add(url);
      });
    }
    const rawImages = (product as any).images;
    if (Array.isArray(rawImages)) {
      rawImages.forEach((img: any) => {
        const url = typeof img === "string" ? img : img?.image_url;
        if (url) set.add(url);
      });
    }
    const variants = (product as any).variants;
    if (Array.isArray(variants)) {
      variants.forEach((v: any) => {
        const url = v?.image_url || v?.imageUrl;
        if (url) set.add(url);
      });
    }
    const list = Array.from(set);
    return list.length > 0
      ? list
      : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80"];
  }, [product]);

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
          const found = data.find((item) => item.id === productId || item.slug === productId);
          setProduct(found || null);
          setProductStatus(found?.status || "ACTIVE");
          setSelectedImageIndex(0);
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
  if (!product) return <NotFoundPage onBack={() => router.push("/admin/products")} />;

  const variants = (product as any).variants || [];

  return (
    <Section
      title={
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            className="h-8 px-2.5 text-xs flex items-center gap-1.5"
            onClick={() => router.push("/admin/products")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Danh sách
          </Button>
          <span className="font-bold text-lg">{product.name}</span>
          <StatusBadge status={productStatus} label={productStatusLabel[productStatus as keyof typeof productStatusLabel] ?? productStatus} />
        </div>
      }
      className="h-full overflow-y-auto pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel>
            {/* Main Image Viewer */}
            <div className="relative aspect-[16/9] w-full rounded-panel overflow-hidden bg-slate-900/5 border border-line flex items-center justify-center">
              <img
                src={allImages[selectedImageIndex]}
                alt={`${product.name} - ảnh ${selectedImageIndex + 1}`}
                className="h-full w-full object-contain transition-all duration-300"
              />
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1))
                    }
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors shadow-md"
                    aria-label="Ảnh trước"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0))
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors shadow-md"
                    aria-label="Ảnh kế tiếp"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/70 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                    {selectedImageIndex + 1} / {allImages.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {allImages.length > 1 && (
              <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
                {allImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-panel overflow-hidden border-2 transition-all ${
                      selectedImageIndex === idx
                        ? "border-primary ring-2 ring-primary/30 scale-105 shadow-sm"
                        : "border-line opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {imgUrl === product.thumbnailUrl && (
                      <span className="absolute bottom-0 inset-x-0 bg-primary/85 text-[8px] text-white text-center py-0.2 font-medium">
                        Ảnh bìa
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Product Overview Info */}
            <div className="mt-5 grid gap-2">
              <h3 className="font-bold text-lg">Thông tin tổng quan</h3>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-sm">
                <div className="p-2.5 bg-canvas rounded-panel border border-line">
                  <span className="text-muted block text-xs">Đã bán</span>
                  <span className="font-semibold text-ink">{product.soldCount || 0} sản phẩm</span>
                </div>
                <div className="p-2.5 bg-canvas rounded-panel border border-line">
                  <span className="text-muted block text-xs">Đánh giá</span>
                  <span className="font-semibold text-ink">
                    ⭐ {product.averageRating || 0} / 5 ({product.reviewCount || 0} lượt)
                  </span>
                </div>
                <div className="p-2.5 bg-canvas rounded-panel border border-line">
                  <span className="text-muted block text-xs">Danh mục</span>
                  <span className="font-semibold text-ink">
                    {(product as any).categories?.map((c: any) => c.name).join(", ") || "Chưa phân loại"}
                  </span>
                </div>
                <div className="p-2.5 bg-canvas rounded-panel border border-line">
                  <span className="text-muted block text-xs">Gian hàng (Shop)</span>
                  <span className="font-semibold text-primary">
                    {(product as any).seller?.shopName || "-"}
                  </span>
                </div>
                {product.brand && (
                  <div className="p-2.5 bg-canvas rounded-panel border border-line">
                    <span className="text-muted block text-xs">Thương hiệu</span>
                    <span className="font-semibold text-ink">{product.brand}</span>
                  </div>
                )}
                {product.origin && (
                  <div className="p-2.5 bg-canvas rounded-panel border border-line">
                    <span className="text-muted block text-xs">Xuất xứ</span>
                    <span className="font-semibold text-ink">{product.origin}</span>
                  </div>
                )}
                {product.warranty && (
                  <div className="p-2.5 bg-canvas rounded-panel border border-line">
                    <span className="text-muted block text-xs">Bảo hành</span>
                    <span className="font-semibold text-ink">{product.warranty}</span>
                  </div>
                )}
                {product.createdAt && (
                  <div className="p-2.5 bg-canvas rounded-panel border border-line">
                    <span className="text-muted block text-xs">Ngày đăng</span>
                    <span className="font-semibold text-ink">
                      {new Date(product.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* Actions Panel */}
          <div className="flex flex-col gap-4">
            <Panel>
              <h3 className="font-bold text-base">Thao tác kiểm duyệt</h3>
              <div className="mt-3 grid gap-2.5">
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

            {(product as any).seller && (
              <Panel>
                <h3 className="font-bold text-base mb-2">Thông tin người bán</h3>
                <div className="text-sm space-y-1.5">
                  <p><strong>Shop:</strong> {(product as any).seller.shopName || (product as any).seller.shop_name}</p>
                  <p><strong>Slug:</strong> {(product as any).seller.shopSlug || (product as any).seller.shop_slug}</p>
                  {(product as any).seller.pickup_address && (
                    <p><strong>Địa chỉ kho:</strong> {(product as any).seller.pickup_address}</p>
                  )}
                  <div className="pt-2">
                    <a
                      href={`/admin/sellers/${(product as any).seller.public_id || (product as any).seller.id}`}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Xem chi tiết Seller →
                    </a>
                  </div>
                </div>
              </Panel>
            )}
          </div>
        </div>

        {/* Variants List */}
        {variants.length > 0 && (
          <Panel>
            <h3 className="font-bold text-lg mb-3">Các phân loại hàng ({variants.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line text-xs font-bold text-muted uppercase">
                    <th className="py-2.5 px-3">Phân loại</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Giá bán</th>
                    <th className="py-2.5 px-3">Giá khuyến mãi</th>
                    <th className="py-2.5 px-3">Tồn kho</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {variants.map((v: any) => (
                    <tr key={v.public_id || v.id || v.sku} className="hover:bg-canvas/50">
                      <td className="py-2.5 px-3 font-medium flex items-center gap-2">
                        {v.image_url && (
                          <img src={v.image_url} alt={v.variant_name} className="w-8 h-8 rounded object-cover border border-line" />
                        )}
                        <span>{v.variant_name}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-muted">{v.sku}</td>
                      <td className="py-2.5 px-3 font-semibold">{formatVnd(v.price)}</td>
                      <td className="py-2.5 px-3 text-secondary font-semibold">
                        {v.sale_price ? formatVnd(v.sale_price) : "-"}
                      </td>
                      <td className="py-2.5 px-3">
                        {v.inventory ? `${v.inventory.quantity} (giữ: ${v.inventory.reserved_quantity ?? 0})` : "-"}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={v.status} label={productStatusLabel[v.status as keyof typeof productStatusLabel] ?? v.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* Description Panels */}
        <Panel>
          <h3 className="font-bold text-lg mb-2">Mô tả ngắn</h3>
          <div className="text-sm leading-6 text-ink whitespace-pre-wrap mb-6">
            {product.shortDescription || (product as any).short_description || "Chưa có mô tả ngắn."}
          </div>

          <h3 className="font-bold text-lg mb-2">Mô tả chi tiết</h3>
          <div className="text-sm leading-6 text-ink whitespace-pre-wrap">
            {product.description || "Chưa có mô tả chi tiết cho sản phẩm này."}
          </div>
        </Panel>
      </div>
    </Section>
  );
}
