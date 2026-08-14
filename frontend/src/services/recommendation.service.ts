import { apiClient } from './api';
import { Product } from '@/types/models';

export interface ProductListResponse {
  items: Product[];
  total: number;
  page?: number;
  size?: number;
  pages?: number;
}

class RecommendationService {
  /**
   * Get semantic similar products for "Có thể bạn cũng thích"
   */
  async getSimilarProducts(productSlug: string, limit: number = 10, page: number = 1): Promise<ProductListResponse> {
    const response = await apiClient.get(`/products/${productSlug}/similar`, {
      params: { limit, page },
    });
    return response.data;
  }

  /**
   * Get shop similar products for "Các sản phẩm khác của shop"
   */
  async getShopSimilarProducts(
    productSlug: string,
    limit: number = 6,
    page: number = 1
  ): Promise<ProductListResponse> {
    const response = await apiClient.get(`/products/${productSlug}/shop-similar`, {
      params: { limit, page },
    });
    return response.data;
  }
}

export const recommendationService = new RecommendationService();
