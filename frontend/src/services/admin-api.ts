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

export interface AdminUserGrowthPoint {
  date: string;
  count: number;
}

export interface AdminUserGrowthResponse {
  total_users: number;
  weekly: AdminUserGrowthPoint[];
  monthly: AdminUserGrowthPoint[];
}

export async function fetchAdminUserGrowth(): Promise<AdminUserGrowthResponse> {
  return apiFetch<AdminUserGrowthResponse>("/admin/user-growth");
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

export interface FetchAdminProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category_id?: string | number;
  sort_by?: string;
}

export interface AdminProductListResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function mapProductFromApi(p: any): Product {
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
}

export async function fetchAdminProducts(params?: FetchAdminProductsParams): Promise<AdminProductListResult> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.status && params.status !== "ALL") searchParams.set("status", params.status);
  if (params?.category_id && params.category_id !== "ALL") searchParams.set("category_id", String(params.category_id));
  if (params?.sort_by) searchParams.set("sort_by", params.sort_by);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const resp = await apiFetch<any>(`/admin/products${query}`);

  const rawList: any[] = Array.isArray(resp) ? resp : resp.items || [];
  const total = Array.isArray(resp) ? rawList.length : (resp.total ?? rawList.length);
  const page = Array.isArray(resp) ? 1 : (resp.page ?? 1);
  const limit = Array.isArray(resp) ? (params?.limit ?? 100) : (resp.limit ?? 100);
  const totalPages = Array.isArray(resp) ? (Math.ceil(total / limit) || 1) : (resp.total_pages ?? (Math.ceil(total / limit) || 1));

  return {
    items: rawList.map(mapProductFromApi),
    total,
    page,
    limit,
    totalPages,
  };
}

export async function fetchAdminProductDetail(productId: string): Promise<Product> {
  const resp = await apiFetch<any>(`/admin/products/${encodeURIComponent(productId)}`);
  return mapProductFromApi(resp);
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

// ==========================================
// Comprehensive Admin Dashboard Types & APIs
// ==========================================

export interface AdminActionCounts {
  pending_seller_applications: number;
  pending_violation_reports: number;
  pending_category_suggestions: number;
  pending_disputes: number;
  failed_payment_orders: number;
}

export interface AdminKpiDelta {
  current_value: number;
  previous_value: number;
  delta_pct: number | null;
}

export interface AdminHeroKpis {
  revenue: AdminKpiDelta;
  orders: AdminKpiDelta;
  new_users: AdminKpiDelta;
  new_sellers: AdminKpiDelta;
  products: AdminKpiDelta;
}

export interface AdminMicroKpis {
  return_rate: AdminKpiDelta;
  aov: AdminKpiDelta;
  total_visits: AdminKpiDelta;
  conversion_rate: AdminKpiDelta;
  total_reviews: AdminKpiDelta;
}

export interface AdminRevenueSeriesPoint {
  label: string;
  full_date: string;
  current_revenue: number;
  previous_revenue: number;
  current_orders: number;
  previous_orders: number;
}

export interface AdminOrderStatusDonutItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface AdminUserGrowthSeriesPoint {
  label: string;
  new_users: number;
  active_users: number;
}

export interface AdminTrafficSourceItem {
  channel: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface AdminTopCategory {
  rank: number;
  id: string | number;
  name: string;
  revenue: number;
  percentage: number;
}

export interface AdminTopSellerDetailed {
  rank: number;
  id: string;
  name: string;
  logo_url?: string | null;
  revenue: number;
  products_count: number;
  rating: number;
}

export interface AdminTopProductDetailed {
  rank: number;
  id: string;
  name: string;
  image_url?: string | null;
  seller_name: string;
  sold_count: number;
  revenue: number;
}

export interface AdminDemographics {
  devices: {
    mobile: number;
    desktop: number;
    tablet: number;
    mobile_count?: number;
    desktop_count?: number;
    tablet_count?: number;
    total_count?: number;
  };
  age_groups: Array<{
    group: string;
    count: number;
    percentage: number;
  }>;
  gender: {
    male: number;
    female: number;
    other: number;
    male_count?: number;
    female_count?: number;
    other_count?: number;
    total_count?: number;
  };
}

export interface AdminSystemAlertItem {
  id: string;
  type: "warning" | "danger" | "info" | "success";
  title: string;
  description: string;
  time_ago: string;
  action_url?: string | null;
}

export interface AdminRecentActivityItem {
  id: string;
  time: string;
  action: string;
  target: string;
  actor: string;
}

export interface AdminHourlyHeatmapCell {
  day_of_week: number;
  day_label: string;
  hour: number;
  intensity: number;
  count: number;
}

export interface AdminBottomSummary {
  year: number;
  total_revenue_ytd: number;
  total_orders_ytd: number;
  total_users: number;
  total_sellers: number;
  total_products: number;
}

export interface AdminFinanceDonutItem {
  key: string;
  label: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface AdminPlatformFinanceOverview {
  total_held_liquidity: number;
  total_cash_inflow: number;
  total_cash_outflow: number;
  escrow_holding: number;
  shipping_held: number;
  seller_wallets: number;
  platform_revenue: number;
  payouts_disbursed: number;
  chart_items: AdminFinanceDonutItem[];
}

export interface AdminPaymentDonutItem {
  channel: string;
  label: string;
  revenue: number;
  count: number;
  percentage: number;
  color: string;
}

export interface AdminComprehensiveStats {
  hero_kpis: AdminHeroKpis;
  micro_kpis: AdminMicroKpis;
  revenue_chart: AdminRevenueSeriesPoint[];
  order_status_donut: AdminOrderStatusDonutItem[];
  total_orders_count: number;
  user_growth_chart: AdminUserGrowthSeriesPoint[];
  traffic_sources: AdminTrafficSourceItem[];
  total_visits_count: number;
  payment_breakdown?: AdminPaymentDonutItem[];
  total_payment_revenue?: number;
  finance_overview?: AdminPlatformFinanceOverview;
  top_categories: AdminTopCategory[];
  top_sellers: AdminTopSellerDetailed[];
  demographics: AdminDemographics;
  top_products: AdminTopProductDetailed[];
  system_alerts: AdminSystemAlertItem[];
  hourly_heatmap: AdminHourlyHeatmapCell[];
  recent_activities: AdminRecentActivityItem[];
  bottom_summary: AdminBottomSummary;
}

export async function fetchAdminActionCounts(): Promise<AdminActionCounts> {
  return apiFetch<AdminActionCounts>("/admin/dashboard/action-counts");
}

export async function fetchAdminComprehensiveStats(
  preset: string = "7DAYS",
  startDate?: string,
  endDate?: string
): Promise<AdminComprehensiveStats> {
  const params = new URLSearchParams();
  if (preset) params.set("time_preset", preset);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<AdminComprehensiveStats>(`/admin/dashboard/comprehensive${query}`);
}
