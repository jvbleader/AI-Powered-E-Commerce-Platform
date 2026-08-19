import { STORAGE_KEYS } from "@/constants/storage-keys";

const STORAGE_KEY = STORAGE_KEYS.SEARCH_HISTORY;
const MAX_ITEMS = 10;

export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(keyword: string): void {
  if (typeof window === "undefined" || !keyword.trim()) return;
  try {
    const trimmed = keyword.trim();
    const history = getSearchHistory().filter((k) => k !== trimmed);
    history.unshift(trimmed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ITEMS)));
  } catch (error) {
    console.warn("[SearchHistory] Failed to save search history:", error);
  }
}

export function removeSearchHistory(keyword: string): void {
  if (typeof window === "undefined") return;
  try {
    const history = getSearchHistory().filter((k) => k !== keyword);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn("[SearchHistory] Failed to remove search history item:", error);
  }
}

export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
