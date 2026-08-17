import { apiFetch } from "./api";
import { User, Category, Product } from "@/types/models";

export interface AdminDashboardStats {
  total_revenue: number;
  total_users: number;
  total_sellers: number;
  pending_seller_applications: number;
}

export interface AdminTopProduct {
  id: string;
  name: string;
  image_url?: string | null;
  sold_count: number;
  revenue: number;
  price?: number | null;
}

export interface AdminTopSeller {
  id: string;
  shop_name: string;
  logo_url?: string | null;
  total_orders: number;
  total_revenue: number;
}

export interface AdminTimeSeriesData {
  date: string;
  revenue: number;
  orders_count: number;
}

export interface AdminPaymentBreakdown {
  cod_revenue: number;
  cod_count: number;
  vnpay_revenue: number;
  vnpay_count: number;
}

export interface AdminUserBreakdown {
  total_customers: number;
  total_sellers: number;
  total_supporters: number;
  total_admins: number;
  active_users: number;
  locked_users: number;
}

export interface AdminDetailedStats {
  total_revenue: number;
  pending_revenue: number;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  average_order_value: number;
  total_products: number;
  active_products: number;
  hidden_products: number;
  total_categories: number;
  user_breakdown: AdminUserBreakdown;
  payment_breakdown: AdminPaymentBreakdown;
  order_status_breakdown: Record<string, number>;
  daily_stats: AdminTimeSeriesData[];
  monthly_stats: AdminTimeSeriesData[];
  top_products: AdminTopProduct[];
  top_sellers: AdminTopSeller[];
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  return apiFetch<AdminDashboardStats>("/admin/dashboard-stats");
}

export async function fetchAdminDetailedStats(): Promise<AdminDetailedStats> {
  return apiFetch<AdminDetailedStats>("/admin/statistics/detailed");
}

export async function recalculateAdminStatistics(): Promise<any> {
  return apiFetch("/admin/statistics/recalculate", { method: "POST" });
}

export async function fetchAdminUsers(): Promise<User[]> {
  const users = await apiFetch<any[]>("/admin/users");
  return users.map((u) => ({
    ...u,
    id: u.publicId || u.id,
    fullName: u.full_name || u.fullName,
  }));
}

export async function toggleAdminUserLock(userId: string): Promise<User> {
  return apiFetch<User>(`/admin/users/${userId}/toggle-lock`, {
    method: "POST"
  });
}

export interface CategorySuggestion {
  id: number;
  seller_id: number;
  shop_name?: string;
  shop_slug?: string;
  suggested_name: string;
  reason?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  created_at: string;
  resolved_at?: string | null;
}

export async function fetchAdminCategories(): Promise<{ categories: Category[] }> {
  return apiFetch<{ categories: Category[] }>("/categories");
}

export async function createAdminCategory(data: { name: string; slug: string; sort_order: number; is_default_other: boolean }): Promise<Category> {
  return apiFetch<Category>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function deleteAdminCategory(categoryId: number | string): Promise<any> {
  return apiFetch(`/admin/categories/${categoryId}`, { method: "DELETE" });
}

export async function fetchAdminCategorySuggestions(status?: string): Promise<CategorySuggestion[]> {
  const query = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<CategorySuggestion[]>(`/admin/category-suggestions${query}`);
}

export async function approveAdminCategorySuggestion(
  id: number,
  data?: { name?: string; slug?: string; sort_order?: number; is_default_other?: boolean }
): Promise<Category> {
  return apiFetch<Category>(`/admin/category-suggestions/${id}/approve`, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function rejectAdminCategorySuggestion(id: number): Promise<CategorySuggestion> {
  return apiFetch<CategorySuggestion>(`/admin/category-suggestions/${id}/reject`, {
    method: "POST",
  });
}

export async function submitSellerCategorySuggestion(data: {
  suggested_name: string;
  reason?: string;
}): Promise<CategorySuggestion> {
  return apiFetch<CategorySuggestion>("/seller/category-suggestions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchSellerCategorySuggestions(): Promise<CategorySuggestion[]> {
  return apiFetch<CategorySuggestion[]>("/seller/category-suggestions");
}

export async function fetchAdminProducts(): Promise<Product[]> {
  const products = await apiFetch<any[]>("/admin/products");
  return products.map((p) => {
    const images = p.images || [];
    const thumbnail = images.find((img: any) => img.is_thumbnail)?.image_url || images[0]?.image_url || p.thumbnail_url || p.thumbnailUrl || "";
    const imageUrls = images.map((img: any) => (typeof img === "string" ? img : img.image_url)).filter(Boolean);
    return {
      ...p,
      id: p.public_id || p.id,
      soldCount: p.sold_count ?? p.soldCount ?? 0,
      averageRating: p.average_rating !== undefined ? Number(p.average_rating) : (p.averageRating ?? 0),
      reviewCount: p.review_count ?? p.reviewCount ?? 0,
      shortDescription: p.short_description ?? p.shortDescription ?? "",
      description: p.description ?? "",
      brand: p.brand ?? "",
      origin: p.origin ?? "",
      warranty: p.warranty_info ?? p.warranty ?? "",
      thumbnailUrl: thumbnail,
      imageUrls: imageUrls.length > 0 ? imageUrls : (p.imageUrls || []),
      categoryIds: p.categories?.map((c: any) => String(c.id)) || [],
      seller: p.seller ? {
        ...p.seller,
        shopName: p.seller.shop_name ?? p.seller.shopName,
        shopSlug: p.seller.shop_slug ?? p.seller.shopSlug,
      } : undefined,
    };
  });
}

export async function hideAdminProduct(productId: string): Promise<any> {
  return apiFetch(`/admin/products/${productId}/hide`, { method: "PATCH" });
}

export async function unhideAdminProduct(productId: string): Promise<any> {
  return apiFetch(`/admin/products/${productId}/unhide`, { method: "PATCH" });
}

export async function deleteAdminProduct(productId: string): Promise<any> {
  return apiFetch(`/admin/products/${productId}`, { method: "DELETE" });
}
