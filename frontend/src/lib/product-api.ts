import { apiFetch, ApiError } from "./api";
import { Product, ProductVariant, Shop } from "@/types/models";

const PUBLIC_PRODUCT_ROUTES = {
  list: "/api/v1/products",
  recommendations: "/api/v1/products/recommendations",
  detail: (shopSlug: string, productSlug: string) => `/api/v1/shops/${shopSlug}/products/${productSlug}`
};

export type FetchProductsParams = {
  keyword?: string;
  category?: string;
  sort_by?: string;
  page?: number;
  size?: number;
};

// Define matching interfaces for the backend models
type SellerInfo = {
  shop_name: string;
  shop_slug: string;
  shop_logo_url: string | null;
  total_sold: number;
};

type ImagePublicResponse = {
  image_url: string;
  is_thumbnail: boolean;
  sort_order: number;
};

type InventoryPublicResponse = {
  quantity: number;
};

type VariantPublicResponse = {
  public_id: string;
  sku: string;
  variant_name: string;
  price: number;
  sale_price: number | null;
  sale_start_at: string | null;
  sale_end_at: string | null;
  image_url: string | null;
  status: string;
  inventory?: InventoryPublicResponse | null;
};

type ProductPublicResponse = {
  public_id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description?: string | null;
  brand?: string | null;
  origin?: string | null;
  warranty_info?: string | null;
  average_rating: number;
  review_count: number;
  sold_count: number;
  view_count: number;
  status: string;
  created_at?: string;
  seller: SellerInfo | null;
  images: ImagePublicResponse[];
  variants: VariantPublicResponse[];
  categories?: any[];
};

type ProductListResponse = {
  items: ProductPublicResponse[];
  total: number;
  page: number;
  size: number;
};

// Normalize backend product into our frontend models
export const normalizeProduct = (
  backendProduct: ProductPublicResponse
): { product: Product; variants: ProductVariant[]; shop?: Shop } => {
  const sellerId = backendProduct.seller?.shop_slug ?? "unknown";
  const product: Product = {
    id: backendProduct.public_id,
    sellerId,
    name: backendProduct.name,
    slug: backendProduct.slug,
    shortDescription: backendProduct.short_description ?? "",
    description: backendProduct.description ?? "",
    brand: backendProduct.brand ?? undefined,
    origin: backendProduct.origin ?? "Việt Nam",
    warranty: backendProduct.warranty_info ?? undefined,
    status: backendProduct.status as any,
    averageRating: backendProduct.average_rating,
    reviewCount: backendProduct.review_count,
    soldCount: backendProduct.sold_count,
    viewCount: backendProduct.view_count,
    categoryIds: backendProduct.categories ? backendProduct.categories.map((c: any) => c.id.toString()) : [],
    imageUrls: backendProduct.images.map((img) => img.image_url),
    thumbnailUrl:
      backendProduct.images.find((img) => img.is_thumbnail)?.image_url ??
      backendProduct.images[0]?.image_url ??
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    createdAt: backendProduct.created_at ?? new Date().toISOString()
  };

  const variants: ProductVariant[] = backendProduct.variants.map((variant) => ({
    id: variant.public_id,
    productId: product.id,
    sku: variant.sku,
    variantName: variant.variant_name,
    price: Number(variant.price),
    salePrice: variant.sale_price != null ? Number(variant.sale_price) : undefined,
    saleStartAt: variant.sale_start_at ?? undefined,
    saleEndAt: variant.sale_end_at ?? undefined,
    imageUrl: variant.image_url ?? product.thumbnailUrl,
    status: variant.status as any,
    inventory: {
      quantity: variant.inventory?.quantity ?? 0,
      reservedQuantity: 0
    }
  }));

  let shop: Shop | undefined;
  if (backendProduct.seller) {
    shop = {
      id: sellerId,
      userId: "",
      shopName: backendProduct.seller.shop_name,
      shopSlug: backendProduct.seller.shop_slug,
      logoUrl: backendProduct.seller.shop_logo_url ?? "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=240&q=80",
      description: "",
      phone: "",
      email: "",
      pickupAddress: "",
      shippingFee: 0,
      shippingProviderName: "",
      status: "APPROVED",
      totalSold: backendProduct.seller.total_sold,
      totalRevenue: 0
    };
  }

  return { product, variants, shop };
};

export async function fetchPublicProducts(params: FetchProductsParams) {
  try {
    const query = new URLSearchParams();
    if (params.keyword) query.set("keyword", params.keyword);
    if (params.category) query.set("category", params.category);
    if (params.sort_by) query.set("sort_by", params.sort_by);
    if (params.page) query.set("page", params.page.toString());
    if (params.size) query.set("size", params.size.toString());

    const response = await apiFetch<ProductListResponse>(`${PUBLIC_PRODUCT_ROUTES.list}?${query.toString()}`);
    
    const products: Product[] = [];
    const variants: ProductVariant[] = [];
    const shops: Shop[] = [];
    
    response.items.forEach((item) => {
      const normalized = normalizeProduct(item);
      products.push(normalized.product);
      variants.push(...normalized.variants);
      if (normalized.shop && !shops.some(s => s.id === normalized.shop!.id)) {
        shops.push(normalized.shop);
      }
    });

    return { ok: true, products, variants, shops, total: response.total, page: response.page };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Không thể tải danh sách sản phẩm." };
  }
}

export async function fetchRecommendedProducts(limit: number = 10) {
  try {
    const response = await apiFetch<ProductPublicResponse[]>(`${PUBLIC_PRODUCT_ROUTES.recommendations}?limit=${limit}`);
    
    const products: Product[] = [];
    const variants: ProductVariant[] = [];
    const shops: Shop[] = [];
    
    response.forEach((item) => {
      const normalized = normalizeProduct(item);
      products.push(normalized.product);
      variants.push(...normalized.variants);
      if (normalized.shop && !shops.some(s => s.id === normalized.shop!.id)) {
        shops.push(normalized.shop);
      }
    });

    return { ok: true, products, variants, shops };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Không thể tải sản phẩm gợi ý." };
  }
}

export async function fetchProductDetail(shopSlug: string, productSlug: string) {
  try {
    const response = await apiFetch<ProductPublicResponse>(PUBLIC_PRODUCT_ROUTES.detail(shopSlug, productSlug));
    const normalized = normalizeProduct(response);
    return { ok: true, product: normalized.product, variants: normalized.variants, shop: normalized.shop };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Không thể tải chi tiết sản phẩm." };
  }
}

export async function fetchCategories() {
  try {
    const response = await apiFetch<{ categories: any[] }>("/api/v1/categories");
    return { 
      ok: true, 
      categories: response.categories.map(c => ({
        id: c.id.toString(), // map numeric id
        name: c.name,
        slug: c.slug,
        icon: "Package", // default icon
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=240&q=80"
      }))
    };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Không thể tải danh mục." };
  }
}
