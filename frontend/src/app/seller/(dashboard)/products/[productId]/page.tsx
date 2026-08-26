"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Edit,
  Box,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { Product, ProductVariant } from "@/types/models";
import { formatVnd, productStatusLabel } from "@/lib/helpers";
import Unauthorized from "@/components/shared/unauthorized-page";
import { QuickInventoryModal } from "@/components/seller/quick-inventory-modal";

function NotFoundPage({ onBack }: { onBack?: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        title="Không tìm thấy sản phẩm"
        description="Sản phẩm không tồn tại hoặc đã bị xóa khỏi hệ thống."
        action={<Button onClick={onBack}>Về danh sách sản phẩm</Button>}
      />
    </main>
  );
}

export default function SellerProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;

  const store = useMarketplaceStore();
  const { showToast, hideSellerProduct, unhideSellerProduct, deleteSellerProduct, fetchSellerProductDetail } = store;
  const currentUser = store.getCurrentUser();
  const shop = store.getCurrentShop();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [productStatus, setProductStatus] = useState<string>("ACTIVE");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

  // Sync with store state products/variants
  const storeProduct = store.state.products.find((p) => p.id === productId);
  const productVariants: ProductVariant[] = useMemo(() => {
    return store.state.variants.filter((v) => v.productId === productId);
  }, [store.state.variants, productId]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchSellerProductDetail(productId)
      .then((res: any) => {
        if (isMounted) {
          if (res.ok && res.product) {
            setProduct(res.product);
            setProductStatus(res.product.status || "ACTIVE");
            setSelectedImageIndex(0);
          } else if (storeProduct) {
            setProduct(storeProduct);
            setProductStatus(storeProduct.status || "ACTIVE");
          } else {
            setProduct(null);
          }
          setLoading(false);
        }
      })
      .catch((err: any) => {
        console.error("Error fetching seller product detail:", err);
        if (isMounted) {
          if (storeProduct) {
            setProduct(storeProduct);
            setProductStatus(storeProduct.status || "ACTIVE");
          } else {
            setProduct(null);
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId, fetchSellerProductDetail]);

  // Keep active product in sync if store state updates
  useEffect(() => {
    if (storeProduct) {
      setProduct(storeProduct);
      setProductStatus(storeProduct.status);
    }
  }, [storeProduct]);

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
    productVariants.forEach((v) => {
      if (v.imageUrl) set.add(v.imageUrl);
    });

    const list = Array.from(set);
    return list.length > 0
      ? list
      : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80"];
  }, [product, productVariants]);

  const totalStock = useMemo(() => {
    return productVariants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0);
  }, [productVariants]);

  const totalReserved = useMemo(() => {
    return productVariants.reduce((sum, v) => sum + (v.inventory?.reservedQuantity ?? 0), 0);
  }, [productVariants]);

  const priceRange = useMemo(() => {
    if (productVariants.length === 0) return "-";
    const prices = productVariants.map((v) => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (minPrice === maxPrice) return formatVnd(minPrice);
    return `${formatVnd(minPrice)} - ${formatVnd(maxPrice)}`;
  }, [productVariants]);

  const handleHide = async () => {
    if (!confirm("Bạn có chắc muốn ẩn sản phẩm này khỏi gian hàng?")) return;
    try {
      const res = await hideSellerProduct(productId);
      if (res.ok) {
        showToast("Đã ẩn sản phẩm thành công", "success");
        setProductStatus("HIDDEN");
      } else {
        showToast(res.message || "Lỗi khi ẩn sản phẩm", "danger");
      }
    } catch (error) {
      showToast("Lỗi khi ẩn sản phẩm", "danger");
    }
  };

  const handleUnhide = async () => {
    if (!confirm("Bạn có chắc muốn mở bán lại sản phẩm này?")) return;
    try {
      const res = await unhideSellerProduct(productId);
      if (res.ok) {
        showToast("Đã hiện lại sản phẩm thành công", "success");
        setProductStatus("ACTIVE");
      } else {
        showToast(res.message || "Lỗi khi hiển thị sản phẩm", "danger");
      }
    } catch (error) {
      showToast("Lỗi khi hiển thị sản phẩm", "danger");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc chắn muốn xoá sản phẩm này? Hành động này không thể hoàn tác.")) return;
    try {
      const res = await deleteSellerProduct(productId);
      if (res.ok) {
        showToast("Đã xoá sản phẩm thành công", "success");
        router.push("/seller/products");
      } else {
        showToast(res.message || "Lỗi khi xoá sản phẩm", "danger");
      }
    } catch (error) {
      showToast("Lỗi khi xoá sản phẩm", "danger");
    }
  };

  if (!currentUser) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi xem chi tiết sản phẩm." />;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-semibold text-muted">Đang tải chi tiết sản phẩm...</p>
      </div>
    );
  }

  if (!product) {
    return <NotFoundPage onBack={() => router.push("/seller/products")} />;
  }

  const categoryNames =
    (product as any).categories?.map((c: any) => c.name).join(", ") ||
    store.state.categories
      .filter((c) => product.categoryIds?.includes(c.id))
      .map((c) => c.name)
      .join(", ") ||
    "Chưa phân loại";

  const publicProductUrl = shop?.shopSlug
    ? `/shops/${shop.shopSlug}/products/${product.slug || product.id}`
    : `/products/${product.slug || product.id}`;

  return (
    <>
      <Section
        title={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              className="h-8 px-2.5 text-xs flex items-center gap-1.5"
              onClick={() => router.push("/seller/products")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Danh sách
            </Button>
            <span className="font-bold text-lg text-ink line-clamp-1">{product.name}</span>
            <StatusBadge
              status={productStatus}
              label={productStatusLabel[productStatus as keyof typeof productStatusLabel] ?? productStatus}
            />
          </div>
        }
        className="h-full overflow-y-auto pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* Left Column: Image Viewer & Overview */}
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
                        <span className="absolute bottom-0 inset-x-0 bg-primary/85 text-[8px] text-white text-center py-0.5 font-medium">
                          Ảnh bìa
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Product Overview Info */}
              <div className="mt-5 grid gap-2">
                <h3 className="font-bold text-lg text-ink">Thông tin tổng quan</h3>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-sm">
                  <div className="p-2.5 bg-canvas rounded-panel border border-line">
                    <span className="text-muted block text-xs">Đã bán</span>
                    <span className="font-semibold text-ink">{product.soldCount || 0} sản phẩm</span>
                  </div>
                  <div className="p-2.5 bg-canvas rounded-panel border border-line">
                    <span className="text-muted block text-xs">Đánh giá</span>
                    <span className="font-semibold text-ink">
                      ⭐ {(product.averageRating || 0).toFixed(1)} / 5 ({product.reviewCount || 0} lượt)
                    </span>
                  </div>
                  <div className="p-2.5 bg-canvas rounded-panel border border-line">
                    <span className="text-muted block text-xs">Danh mục</span>
                    <span className="font-semibold text-ink">{categoryNames}</span>
                  </div>
                  <div className="p-2.5 bg-canvas rounded-panel border border-line">
                    <span className="text-muted block text-xs">Mức giá</span>
                    <span className="font-semibold text-primary">{priceRange}</span>
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

            {/* Right Column: Actions & Quick Stats */}
            <div className="flex flex-col gap-4">
              <Panel>
                <h3 className="font-bold text-base text-ink">Thao tác sản phẩm</h3>
                <div className="mt-3 flex flex-col gap-2.5">
                  <Button
                    variant="primary"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => router.push(`/seller/products/${productId}/edit`)}
                  >
                    <Edit className="h-4 w-4" />
                    Chỉnh sửa thông tin
                  </Button>

                  <Button
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => setIsInventoryModalOpen(true)}
                  >
                    <Box className="h-4 w-4" />
                    Quản lý kho phân loại
                  </Button>

                  <a
                    href={publicProductUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-panel border border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas/80 hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Xem trang bán lẻ
                  </a>

                  <div className="my-1 border-t border-line" />

                  {productStatus === "ACTIVE" && (
                    <Button
                      variant="secondary"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={handleHide}
                    >
                      <EyeOff className="h-4 w-4" />
                      Ẩn sản phẩm
                    </Button>
                  )}

                  {productStatus === "HIDDEN" && (
                    <Button
                      variant="secondary"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={handleUnhide}
                    >
                      <Eye className="h-4 w-4" />
                      Mở bán lại sản phẩm
                    </Button>
                  )}

                  {productStatus !== "DELETED" && (
                    <Button
                      variant="danger"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                      Xoá sản phẩm
                    </Button>
                  )}
                </div>
              </Panel>

              {/* Inventory & Status Summary */}
              <Panel>
                <h3 className="font-bold text-base mb-3 text-ink flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Tóm tắt tồn kho
                </h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center py-1.5 border-b border-line">
                    <span className="text-muted">Tổng số phân loại</span>
                    <span className="font-bold text-ink">{productVariants.length} loại</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-line">
                    <span className="text-muted">Tổng tồn kho sẵn có</span>
                    <span
                      className={`font-bold ${
                        totalStock === 0
                          ? "text-rose-600"
                          : totalStock <= 10
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {totalStock} sản phẩm
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-line">
                    <span className="text-muted">Đang giữ đơn hàng</span>
                    <span className="font-bold text-ink">{totalReserved} sản phẩm</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-muted">Mã định danh (Slug)</span>
                    <span className="font-mono text-xs text-muted truncate max-w-[170px]" title={product.slug}>
                      {product.slug || "-"}
                    </span>
                  </div>
                </div>
              </Panel>
            </div>
          </div>

          {/* Variants Table */}
          {productVariants.length > 0 && (
            <Panel>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg text-ink">
                  Các phân loại hàng ({productVariants.length})
                </h3>
                <Button
                  variant="secondary"
                  className="h-8 px-2.5 text-xs flex items-center gap-1.5"
                  onClick={() => setIsInventoryModalOpen(true)}
                >
                  <Box className="h-3.5 w-3.5" />
                  Cập nhật nhanh tồn kho
                </Button>
              </div>

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
                    {productVariants.map((v) => (
                      <tr key={v.id || v.sku} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-2.5 px-3 font-medium flex items-center gap-2.5">
                          {v.imageUrl && (
                            <img
                              src={v.imageUrl}
                              alt={v.variantName}
                              className="w-9 h-9 rounded-panel object-cover border border-line flex-shrink-0"
                            />
                          )}
                          <span className="text-ink font-semibold">{v.variantName}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-muted">{v.sku}</td>
                        <td className="py-2.5 px-3 font-semibold text-ink">{formatVnd(v.price)}</td>
                        <td className="py-2.5 px-3 text-secondary font-semibold">
                          {v.salePrice ? formatVnd(v.salePrice) : "-"}
                        </td>
                        <td className="py-2.5 px-3">
                          {v.inventory ? (
                            <span
                              className={`font-semibold ${
                                v.inventory.quantity === 0
                                  ? "text-rose-600"
                                  : v.inventory.quantity <= 10
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {v.inventory.quantity}{" "}
                              <span className="text-xs text-muted font-normal">
                                (giữ: {v.inventory.reservedQuantity ?? 0})
                              </span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge
                            status={v.status}
                            label={productStatusLabel[v.status as keyof typeof productStatusLabel] ?? v.status}
                          />
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
            <h3 className="font-bold text-lg text-ink mb-2">Mô tả ngắn</h3>
            <div className="text-sm leading-6 text-ink whitespace-pre-wrap mb-6">
              {product.shortDescription || (product as any).short_description || "Chưa có mô tả ngắn."}
            </div>

            <h3 className="font-bold text-lg text-ink mb-2">Mô tả chi tiết</h3>
            <div className="text-sm leading-6 text-ink whitespace-pre-wrap">
              {product.description || "Chưa có mô tả chi tiết cho sản phẩm này."}
            </div>
          </Panel>
        </div>
      </Section>

      <QuickInventoryModal
        product={isInventoryModalOpen ? product : null}
        onClose={() => setIsInventoryModalOpen(false)}
      />
    </>
  );
}
