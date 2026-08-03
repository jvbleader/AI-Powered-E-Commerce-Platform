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

export async function fetchAutocomplete(q: string): Promise<AutocompleteResponse> {
  try {
    return await apiFetch<AutocompleteResponse>(
      `/products/autocomplete?q=${encodeURIComponent(q)}`
    );
  } catch {
    return { suggestions: [] };
  }
}

export async function fetchHotKeywords(): Promise<string[]> {
  try {
    const res = await apiFetch<HotKeywordsResponse>("/search/hot-keywords");
    return res.keywords;
  } catch {
    return ["iPhone 15 Pro", "Tai nghe Bluetooth", "Áo Nam Basic", "Bàn Phím Cơ", "Mỹ Phẩm Korea"];
  }
}
