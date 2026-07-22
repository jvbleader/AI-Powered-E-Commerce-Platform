import { apiFetch, ApiError } from "@/services/api";

const SESSION_STORAGE_KEY = "shepoo_ai_session_id";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface AIProductItem {
  id: number;
  name: string;
  price: number;
  sale_price?: number;
  stock: number;
  thumbnail_url: string;
  rating?: number;
  slug?: string;
  shop_slug?: string;
  primary_variant_id?: string;
}

export interface AIChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    recommended_product_ids?: number[];
    tools_called?: string[];
  };
  products?: AIProductItem[];
  createdAt?: string;
}

export type SSEEventPayload =
  | { type: "status"; content: string }
  | { type: "text"; content: string }
  | { type: "products"; items: AIProductItem[] }
  | { type: "end" }
  | { type: "error"; message: string };

/**
 * Retrieves existing session UUID or generates a new UUID v4.
 * For logged-in users (userId provided), persists to localStorage per user.
 * For guests (no userId), returns a transient UUID without storing in localStorage (F5 clears it).
 */
export function getOrCreateSessionId(userId?: string): string {
  if (typeof window === "undefined") return "";

  const generateUuid = () =>
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  if (userId) {
    const key = `${SESSION_STORAGE_KEY}_${userId}`;
    let sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = generateUuid();
      localStorage.setItem(key, sessionId);
    }
    return sessionId;
  }

  // Transient ID for guest mode (not saved to localStorage)
  return generateUuid();
}

export function clearSessionId(userId?: string): void {
  if (typeof window !== "undefined") {
    if (userId) {
      localStorage.removeItem(`${SESSION_STORAGE_KEY}_${userId}`);
    }
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

/**
 * Fetch past chat messages for a session.
 * Endpoint: GET /ai/chat/history?session_id={sessionId}
 */
export async function fetchChatHistory(sessionId: string): Promise<AIChatMessage[]> {
  try {
    const data = await apiFetch<{ sessionId?: string; session_id?: string; messages: AIChatMessage[] }>(
      `/ai/chat/history?session_id=${encodeURIComponent(sessionId)}`
    );
    const rawMessages = data?.messages ?? [];
    return rawMessages.map((m) => ({
      ...m,
      products:
        m.products && m.products.length > 0
          ? m.products
          : (m.metadata as any)?.products || []
    }));
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return [];
    }
    throw err;
  }
}


/**
 * Stream chat message via SSE.
 * Endpoint: POST /ai/chat/message
 */
export async function sendStreamChatMessage(params: {
  message: string;
  sessionId: string;
  history?: { role: string; content: string }[];
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
  onTextChunk?: (chunk: string) => void;
  onProducts?: (products: AIProductItem[]) => void;
  onError?: (err: Error) => void;
  onEnd?: () => void;
}): Promise<void> {
  const { message, sessionId, history, signal, onStatus, onTextChunk, onProducts, onError, onEnd } = params;

  try {
    const response = await fetch(`${API_BASE_URL}/ai/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ message, session_id: sessionId, history }),
      signal
    });


    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body received from stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const dataStr = trimmed.slice(6);
        if (dataStr === "[DONE]") {
          onEnd?.();
          return;
        }

        try {
          const payload = JSON.parse(dataStr) as SSEEventPayload;
          if (payload.type === "status") {
            onStatus?.(payload.content);
          } else if (payload.type === "text") {
            onTextChunk?.(payload.content);
          } else if (payload.type === "products") {
            onProducts?.(payload.items);
          } else if (payload.type === "end") {
            onEnd?.();
            return;
          } else if (payload.type === "error") {
            onError?.(new Error(payload.message));
            return;
          }
        } catch (parseErr) {
          console.error("Failed to parse SSE payload:", dataStr, parseErr);
        }
      }
    }

    onEnd?.();
  } catch (err: any) {
    if (err.name === "AbortError") return;
    onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}
