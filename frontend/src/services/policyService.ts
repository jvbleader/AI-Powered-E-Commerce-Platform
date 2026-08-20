import { apiFetch } from "@/services/api";

export interface PublicPolicyItem {
  id: number;
  public_id: string;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  page_count: number | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublicPolicyDetail extends PublicPolicyItem {
  extracted_text?: string | null;
}

export const policyService = {
  /**
   * Lấy danh sách các chính sách sàn đã xuất bản
   */
  async fetchPolicies(params?: {
    category?: string;
    search?: string;
  }): Promise<PublicPolicyItem[]> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== "ALL") {
      query.set("category", params.category);
    }
    if (params?.search && params.search.trim()) {
      query.set("search", params.search.trim());
    }

    const qs = query.toString();
    const endpoint = `/policies${qs ? `?${qs}` : ""}`;
    return apiFetch<PublicPolicyItem[]>(endpoint);
  },

  /**
   * Lấy chi tiết một bài viết chính sách theo slug & tăng view count
   */
  async getPolicyBySlug(slug: string): Promise<PublicPolicyDetail> {
    return apiFetch<PublicPolicyDetail>(`/policies/${encodeURIComponent(slug)}`);
  },
};
