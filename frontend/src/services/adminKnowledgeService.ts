import { apiFetch } from "@/services/api";

export interface KnowledgeBaseArticleItem {
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
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleListResponse {
  items: KnowledgeBaseArticleItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ArticleReindexResponse {
  success: boolean;
  message: string;
  indexed_articles: number;
  total_chunks: number;
}

export const adminKnowledgeService = {
  /**
   * Lấy danh sách tài liệu tri thức (phân trang, lọc theo category, tìm kiếm tiêu đề)
   */
  async fetchArticles(params?: {
    category?: string;
    search?: string;
    is_published?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<ArticleListResponse> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== "ALL") {
      query.set("category", params.category);
    }
    if (params?.search && params.search.trim()) {
      query.set("search", params.search.trim());
    }
    if (params?.is_published !== undefined) {
      query.set("is_published", String(params.is_published));
    }
    if (params?.page) {
      query.set("page", String(params.page));
    }
    if (params?.page_size) {
      query.set("page_size", String(params.page_size));
    }

    const qs = query.toString();
    const endpoint = `/admin/knowledge-base/articles${qs ? `?${qs}` : ""}`;
    return apiFetch<ArticleListResponse>(endpoint);
  },

  /**
   * Tải file PDF chính sách lên server và tự động vector hóa vào Elasticsearch
   */
  async uploadPdfArticle(formData: FormData): Promise<KnowledgeBaseArticleItem> {
    return apiFetch<KnowledgeBaseArticleItem>("/admin/knowledge-base/upload", {
      method: "POST",
      body: formData,
    });
  },

  /**
   * Xóa tài liệu khỏi CSDL, xóa file PDF vật lý và xóa toàn bộ chunks trong Elasticsearch
   */
  async deleteArticle(id: number | string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(
      `/admin/knowledge-base/articles/${id}`,
      {
        method: "DELETE",
      }
    );
  },

  /**
   * Đồng bộ lại toàn bộ tài liệu từ CSDL vào Elasticsearch
   */
  async reindexAll(): Promise<ArticleReindexResponse> {
    return apiFetch<ArticleReindexResponse>("/admin/knowledge-base/reindex", {
      method: "POST",
    });
  },
};
