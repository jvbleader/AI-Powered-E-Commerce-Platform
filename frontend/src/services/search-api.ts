import { apiFetch } from "@/services/api";

export type SearchSuggestion = {
  keyword: string;
  type: "keyword" | "shop";
  shop_slug: string | null;
};

export type AutocompleteResponse = {
  suggestions: SearchSuggestion[];
};

export type HotKeywordsResponse = {
  keywords: string[];
};

export type ShopSearchItem = {
  id: number;
  public_id: string;
  shop_name: string;
  shop_slug: string;
  shop_description?: string | null;
  total_sold: number;
  average_rating: number;
  review_count: number;
  product_count: number;
  status: string;
  shop_logo_url?: string | null;
};

export type ShopSearchResponse = {
  total: number;
  page: number;
  limit: number;
  items: ShopSearchItem[];
};

export async function fetchAutocomplete(q: string): Promise<AutocompleteResponse> {
  const trimmed = q.trim();
  // Shopee-style: always keep "Tìm Shop" as first row even if API fails
  const shopAction: SearchSuggestion = {
    keyword: `Tìm Shop "${trimmed}"`,
    type: "shop",
    shop_slug: null,
  };

  if (!trimmed) {
    return { suggestions: [] };
  }

  try {
    const res = await apiFetch<AutocompleteResponse>(
      `/products/autocomplete?q=${encodeURIComponent(trimmed)}`
    );
    const rest = (res.suggestions || []).filter((s) => s.type !== "shop");
    const fromApi = (res.suggestions || []).find((s) => s.type === "shop");
    return {
      suggestions: [
        {
          ...shopAction,
          shop_slug: fromApi?.shop_slug ?? null,
        },
        ...rest,
      ],
    };
  } catch {
    return { suggestions: [shopAction] };
  }
}

export async function fetchShopSearch(params: {
  q: string;
  page?: number;
  size?: number;
}): Promise<ShopSearchResponse> {
  const query = new URLSearchParams();
  query.set("q", params.q);
  if (params.page) query.set("page", String(params.page));
  if (params.size) query.set("size", String(params.size));
  return apiFetch<ShopSearchResponse>(`/search/shops?${query.toString()}`);
}

export async function fetchHotKeywords(): Promise<string[]> {
  try {
    const res = await apiFetch<HotKeywordsResponse>("/search/hot-keywords");
    return res.keywords;
  } catch {
    return ["iPhone 15 Pro", "Tai nghe Bluetooth", "Áo Nam Basic", "Bàn Phím Cơ", "Mỹ Phẩm Korea"];
  }
}
