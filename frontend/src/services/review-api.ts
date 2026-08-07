import { apiFetch } from "./api";

export interface ReviewUser {
  id: number;
  full_name: string;
  avatar_url?: string;
}

export interface ProductReview {
  id: number;
  user_id: number;
  product_id: number;
  order_item_id: number;
  rating: number;
  comment?: string;
  created_at: string;
  user?: ReviewUser;
  images?: string[];
  variant_name?: string;
}

export interface ReviewListResponse {
  items: ProductReview[];
  total: number;
  page: number;
  size: number;
  average_rating: number;
}

export interface CreateReviewPayload {
  order_item_id: number;
  rating: number;
  comment?: string;
  images?: string[];
}

export async function createReviewApi(payload: CreateReviewPayload): Promise<ProductReview> {
  return apiFetch<ProductReview>("/reviews", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchProductReviewsApi(
  productId: string | number,
  page: number = 1,
  size: number = 20,
  rating?: number,
  hasImage?: boolean,
  variantName?: string
): Promise<ReviewListResponse> {
  let url = `/products/${productId}/reviews?page=${page}&size=${size}`;
  if (rating) url += `&rating=${rating}`;
  if (hasImage) url += `&has_image=true`;
  if (variantName) url += `&variant_name=${encodeURIComponent(variantName)}`;
  return apiFetch<ReviewListResponse>(url);
}

export interface ProductReviewInfo {
  id: number;
  name: string;
  slug: string;
  image_url?: string;
}

export interface UserReviewResponse extends ProductReview {
  product?: ProductReviewInfo;
}

export interface UserReviewListResponse {
  items: UserReviewResponse[];
  total: number;
  page: number;
  size: number;
}

export async function fetchMyReviewsApi(
  page: number = 1,
  size: number = 20
): Promise<UserReviewListResponse> {
  return apiFetch<UserReviewListResponse>(`/reviews/me?page=${page}&size=${size}`);
}
