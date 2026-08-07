import { apiFetch, ApiError } from "@/services/api";
import { Product, ProductVariant, Shop, ProductStatus, VariantStatus } from "@/types/models";

const toProductStatus = (status: string): ProductStatus => {
  const valid: ProductStatus[] = ["ACTIVE", "HIDDEN", "OUT_OF_STOCK", "DELETED"];
  return valid.includes(status as ProductStatus) ? (status as ProductStatus) : "HIDDEN";
};

const toVariantStatus = (status: string): VariantStatus => {
  const valid: VariantStatus[] = ["ACTIVE", "HIDDEN", "OUT_OF_STOCK", "DELETED"];
  return valid.includes(status as VariantStatus) ? (status as VariantStatus) : "HIDDEN";
};

const PUBLIC_PRODUCT_ROUTES = {
  list: "/products",
  recommendations: "/products/recommendations",
  detail: (shopSlug: string, productSlug: string) => `/shops/${shopSlug}/products/${productSlug}`
};

export type FetchProductsParams = {
  keyword?: string;
  category?: string;
  sort_by?: string;
  page?: number;
  size?: number;
  min_price?: number;
  max_price?: number;
  seller_id?: string;
  shop_slug?: string;
  min_rating?: number;
  location?: string;
};


// Define matching interfaces for the backend models
type SellerInfo = {
  id: number;
  shop_name: string;
  shop_slug: string;
  shop_logo_url: string | null;
  total_sold: number;
  shipping_fee: number;
  pickup_address?: string | null;
};

type ImagePublicResponse = {
  image_url: string;
  is_thumbnail: boolean;
  sort_order: number;
};

type InventoryPublicResponse = {
  quantity: number;
  reserved_quantity: number;
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
  status: string;
  created_at?: string;
  seller: SellerInfo | null;
  images: ImagePublicResponse[];
  variants: VariantPublicResponse[];
  categories?: { id: number; name: string }[];
};

type ProductListResponse = {
  items: ProductPublicResponse[];
  total: number;
  page: number;
  size: number;
  aggregations?: any;
};

// Normalize backend product into our frontend models
export const normalizeProduct = (
  backendProduct: ProductPublicResponse
): { product: Product; variants: ProductVariant[]; shop?: Shop } => {
  const sellerId = backendProduct.seller?.id?.toString() ?? backendProduct.seller?.shop_slug ?? "unknown";
  // NOTE: sellerId uses the real integer ID if available, falling back to shop_slug.
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
    status: toProductStatus(backendProduct.status),
    averageRating: backendProduct.average_rating,
    reviewCount: backendProduct.review_count,
    soldCount: backendProduct.sold_count,
    categoryIds: backendProduct.categories ? backendProduct.categories.map((c: { id: number; name: string }) => c.id.toString()) : [],
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
    status: toVariantStatus(variant.status),
    inventory: {
      quantity: Math.max(0, (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved_quantity ?? 0)),
      reservedQuantity: variant.inventory?.reserved_quantity ?? 0
    }
  }));

  let shop: Shop;
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
      pickupAddress: backendProduct.seller.pickup_address ?? "",
      shippingFee: Number(backendProduct.seller.shipping_fee ?? 0),
      shippingProviderName: "",
      status: "APPROVED",
      totalSold: backendProduct.seller.total_sold,
      totalRevenue: 0
    };
  } else {
    shop = {
      id: "shop",
      userId: "",
      shopName: "Cửa hàng chính hãng",
      shopSlug: "shop",
      logoUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=240&q=80",
      description: "",
      phone: "",
      email: "",
      pickupAddress: "",
      shippingFee: 0,
      shippingProviderName: "Giao hàng nhanh",
      status: "APPROVED",
      totalSold: 0,
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
    if (params.min_price !== undefined) query.set("min_price", params.min_price.toString());
    if (params.max_price !== undefined) query.set("max_price", params.max_price.toString());
    if (params.seller_id) query.set("seller_id", params.seller_id);
    if (params.shop_slug) query.set("shop_slug", params.shop_slug);
    if (params.min_rating !== undefined) query.set("min_rating", params.min_rating.toString());
    if (params.location) query.set("location", params.location);

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

    return { ok: true, products, variants, shops, total: response.total, page: response.page, aggregations: response.aggregations };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Không thể tải danh sách sản phẩm." };
  }
}

export async function fetchPublicShop(shopSlug: string) {
  try {
    const response = await apiFetch<any>(`/shops/${shopSlug}`);
    const shop: Shop = {
      id: response.id?.toString() || response.shop_slug,
      userId: "",
      shopName: response.shop_name,
      shopSlug: response.shop_slug,
      logoUrl: response.shop_logo_url || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=240&q=80",
      description: response.shop_description || "Chào mừng bạn đến với cửa hàng của chúng tôi!",
      phone: response.phone || "",
      email: response.email || "",
      pickupAddress: response.pickup_address || "",
      shippingFee: response.shipping_fee || 0,
      shippingProviderName: response.shipping_provider_name || "Giao hàng nhanh",
      status: response.status || "APPROVED",
      totalSold: response.total_sold || 0,
      totalRevenue: 0
    };
    return { ok: true, shop };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Không tìm thấy thông tin cửa hàng." };
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
    const response = await apiFetch<{ categories: any[] }>("/categories");
    return { 
      ok: true, 
      categories: response.categories.map(c => ({
        id: c.id.toString(), // map numeric id
        name: c.name,
        slug: c.slug,
        sortOrder: c.sort_order ?? 0,
        icon: "Package", // default icon
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=240&q=80"
      }))
    };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Không thể tải danh mục." };
  }
}
