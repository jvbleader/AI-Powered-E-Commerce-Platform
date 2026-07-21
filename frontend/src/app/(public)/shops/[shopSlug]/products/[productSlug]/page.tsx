"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import {
  PriceDisplay,
  QuantityStepper,
  RatingStars
} from "@/components/shared/cards";
import {
  formatDate,
  getCategoryNames,
  productStatusLabel
} from "@/lib/helpers";
import { fetchProductDetail } from "@/services/product-api";
import { fetchProductReviewsApi, ProductReview } from "@/services/review-api";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import NotFoundPage from "@/components/shared/not-found-page";
import type { Product, ProductVariant, Shop } from "@/types/models";


export default function ProductDetailPage() {
  const params = useParams();
  const shopSlug = typeof params.shopSlug === "string" ? params.shopSlug : "";
  const productSlug = typeof params.productSlug === "string" ? params.productSlug : "";

  const store = useMarketplaceStore();
  const { showToast } = store;

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showReport, setShowReport] = useState(false);
  
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [shop, setShop] = useState<Shop | undefined>(undefined);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadDetail = async () => {
      if (!shopSlug || !productSlug) return;
      setLoading(true);
      const res = await fetchProductDetail(shopSlug, productSlug);
      if (isMounted) {
        if (res.ok && res.product) {
          setProduct(res.product);
          setProductVariants(res.variants!);
          setShop(res.shop);
          setSelectedVariantId(res.variants![0]?.id ?? "");
          store.saveProduct(res.product, res.variants!);
          if (res.shop) store.saveShop(res.shop);
        }
        setLoading(false);
      }
    };
    loadDetail();
    return () => { isMounted = false; };
  }, [shopSlug, productSlug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 text-center text-muted">
        Đang tải chi tiết sản phẩm...
      </main>
    );
  }

  if (!shop || !product) return <NotFoundPage />;
  
  const selectedVariant = productVariants.find((variant) => variant.id === selectedVariantId) ?? productVariants[0];

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <img src={selectedVariant?.imageUrl ?? product.thumbnailUrl} alt={product.name} className="aspect-square w-full rounded-panel object-cover" />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {product.imageUrls.map((image) => (
              <img key={image} src={image} alt={product.name} className="aspect-square rounded-panel border border-line object-cover" />
            ))}
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center gap-2">
            {product.status === "OUT_OF_STOCK" && <StatusBadge status="OUT_OF_STOCK" label="Hết hàng" />}
            <a href={`/shops/${shop.shopSlug}`} className="rounded-panel border border-line px-2 py-1 text-xs font-semibold text-primary">
              {shop.shopName}
            </a>
          </div>

          <h1 className="mt-3 text-3xl font-black text-ink">{product.name}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
            <RatingStars rating={product.averageRating} count={product.reviewCount} />
            <span>Đã bán {product.soldCount}</span>
            <span>{product.viewCount.toLocaleString("vi-VN")} lượt xem</span>
          </div>
          <div className="mt-4 rounded-panel bg-canvas p-4">
            <PriceDisplay price={selectedVariant?.price ?? 0} salePrice={selectedVariant?.salePrice} />
            {selectedVariant?.salePrice ? <p className="mt-1 text-xs text-muted">Sale đến {formatDate(selectedVariant.saleEndAt)}</p> : null}
          </div>
          <div className="mt-5 space-y-4">
            <Field label="Biến thể">
              <div className="flex flex-wrap gap-2">
                {productVariants.map((variant) => (
                  <Button
                    key={variant.id}
                    variant={selectedVariant.id === variant.id ? "primary" : "secondary"}
                    disabled={variant.status !== "ACTIVE"}
                    onClick={() => setSelectedVariantId(variant.id)}
                  >
                    {variant.variantName}
                  </Button>
                ))}
              </div>
            </Field>
            <Field label="Số lượng">
              <div className="flex items-center gap-4">
                <QuantityStepper value={quantity} onChange={setQuantity} max={selectedVariant?.inventory.quantity ?? 1} />
                <span className="text-sm text-muted">{selectedVariant?.inventory.quantity ?? 0} sản phẩm có sẵn</span>
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!selectedVariant || product.status !== "ACTIVE" || selectedVariant.status !== "ACTIVE"}
                onClick={async () => {
                  const result = await store.addToCart(selectedVariant.id, quantity);
                  showToast(result.message, result.ok ? "success" : "danger");
                }}
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Thêm vào giỏ hàng
              </Button>
              <Button variant="secondary" onClick={() => setShowReport((value) => !value)}>
                Báo cáo sản phẩm
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            <InfoRow label="Thương hiệu" value={product.brand ?? "Không khai báo"} />
            <InfoRow label="Xuất xứ" value={product.origin} />
            <InfoRow label="Bảo hành" value={product.warranty ?? "Không áp dụng"} />
            <InfoRow label="Danh mục" value={getCategoryNames(store.state.categories, product) || "Chưa phân loại"} />
          </div>
        </Panel>
      </div>
      {showReport ? <ReportProductPanel product={product} /> : null}
      <Section title="Mô tả sản phẩm">
        <Panel>
          <p className="text-sm leading-7 text-muted">{product.shortDescription}</p>
          <p className="mt-3 text-sm leading-7 text-muted">{product.description}</p>
        </Panel>
      </Section>
      <Section title="Đánh giá sản phẩm">
        <ReviewsModule product={product} />
      </Section>
    </main>
  );

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-panel border border-line bg-white p-3">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-semibold text-ink">{value}</p>
      </div>
    );
  }

  function ReportProductPanel({ product }: { product: Product }) {
    return (
      <Section title="Báo cáo sản phẩm">
        <Panel>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Lý do">
              <Select>
                <option>Hàng giả</option>
                <option>Lừa đảo</option>
                <option>Nội dung không phù hợp</option>
                <option>Mô tả sai</option>
                <option>Spam</option>
                <option>Khác</option>
              </Select>
            </Field>
            <Field label="Ảnh bằng chứng">
              <Input type="file" />
            </Field>
            <div className="flex items-end">
              <Button onClick={() => showToast(`Đã gửi báo cáo cho ${product.name}`, "success")}>Gửi báo cáo</Button>
            </div>
            <div className="md:col-span-3">
              <Field label="Mô tả chi tiết">
                <Textarea placeholder="Mô tả vấn đề bạn gặp phải" />
              </Field>
            </div>
          </div>
        </Panel>
      </Section>
    );
  }

  function ReviewsModule({ product }: { product?: Product }) {
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    useEffect(() => {
      if (!product?.id) {
        setLoadingReviews(false);
        return;
      }

      let isMounted = true;
      setLoadingReviews(true);
      fetchProductReviewsApi(product.id)
        .then((res) => {
          if (isMounted && res?.items) {
            setReviews(res.items);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingReviews(false);
        });
      return () => { isMounted = false; };
    }, [product?.id]);


    if (loadingReviews) {
      return (
        <Panel>
          <p className="text-center text-sm text-muted">Đang tải đánh giá...</p>
        </Panel>
      );
    }

    if (!reviews.length) {
      return (
        <Panel>
          <EmptyState title="Chưa có đánh giá" description="Chưa có ai đánh giá sản phẩm này." />
        </Panel>
      );
    }


    return (
      <Panel className="space-y-4">
        {reviews.map((rev) => (
          <div key={rev.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                  {rev.user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="text-sm font-bold">{rev.user?.full_name || "Người dùng"}</p>
                  <p className="text-xs text-muted">{formatDate(rev.created_at)}</p>
                </div>
              </div>
              <RatingStars rating={rev.rating} />
            </div>

            {rev.comment && <p className="mt-2 text-sm text-ink">{rev.comment}</p>}
          </div>
        ))}
      </Panel>
    );
  }

}
