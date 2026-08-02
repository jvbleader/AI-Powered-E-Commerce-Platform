import { apiFetch } from "./api";
import { User, Category, Product } from "@/types/models";

export interface AdminDashboardStats {
  total_revenue: number;
  total_users: number;
  total_sellers: number;
  pending_seller_applications: number;
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  return apiFetch<AdminDashboardStats>("/admin/dashboard-stats");
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

export async function fetchAdminProducts(): Promise<Product[]> {
  const products = await apiFetch<any[]>("/admin/products");
  return products.map((p) => ({
    ...p,
    id: p.public_id || p.id,
    soldCount: p.sold_count ?? p.soldCount ?? 0,
    seller: p.seller ? {
      ...p.seller,
      shopName: p.seller.shop_name,
      shopSlug: p.seller.shop_slug,
    } : undefined,
  }));
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
