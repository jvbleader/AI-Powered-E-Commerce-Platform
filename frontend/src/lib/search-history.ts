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
  const trimmed = keyword.trim();
  const history = getSearchHistory().filter((k) => k !== trimmed);
  history.unshift(trimmed);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ITEMS)));
}

export function removeSearchHistory(keyword: string): void {
  if (typeof window === "undefined") return;
  const history = getSearchHistory().filter((k) => k !== keyword);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
