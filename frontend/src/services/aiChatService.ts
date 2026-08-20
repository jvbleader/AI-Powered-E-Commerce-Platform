import { apiFetch, ApiError, getApiBaseUrl } from "@/services/api";

import { STORAGE_KEYS } from "@/constants/storage-keys";

const SESSION_STORAGE_KEY = STORAGE_KEYS.AI_SESSION;

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

export interface AICitationItem {
  article_id: string;
  article_public_id?: string;
  title: string;
  section_title?: string;
  slug?: string;
  category?: string;
  page_number?: number;
  file_url?: string;
  excerpt?: string;
}

export interface AIOrderItem {
  item_id?: number | string;
  item_name?: string;
  product_name?: string;
  variant_name?: string;
  quantity?: number;
  unit_price?: number;
}

export interface AIOrderContext {
  order_code: string;
  public_id?: string;
  status: string;
  total_amount?: number;
  created_at?: string;
  delivered_at?: string;
  days_since_delivery?: number | null;
  is_returnable?: boolean;
  has_return_request?: boolean;
  return_status?: string | null;
  return_code?: string | null;
  items?: AIOrderItem[];
  items_summary?: string;
}

export interface AIChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    recommended_product_ids?: number[];
    tools_called?: string[];
    is_error?: boolean;
    error_detail?: string;
    citations?: AICitationItem[];
    order_context?: AIOrderContext | AIOrderContext[];
  };
  isError?: boolean;
  products?: AIProductItem[];
  citations?: AICitationItem[];
  orderContext?: AIOrderContext;
  createdAt?: string;
}

export interface AIChatSessionSummary {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type SSEEventPayload =
  | { type: "status"; content: string }
  | { type: "text"; content: string }
  | { type: "products"; items: AIProductItem[] }
  | { type: "citations"; citations: AICitationItem[] }
  | { type: "order_context"; order: AIOrderContext | AIOrderContext[] }
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

export function setSessionIdLocal(userId: string | undefined, sessionId: string): void {
  if (typeof window !== "undefined" && userId) {
    const key = `${SESSION_STORAGE_KEY}_${userId}`;
    localStorage.setItem(key, sessionId);
  }
}

export async function fetchChatSessions(): Promise<AIChatSessionSummary[]> {
  try {
    const data = await apiFetch<{ sessions: any[] }>("/ai/chat/sessions");
    const rawSessions = data?.sessions || [];
    return rawSessions.map((s: any) => ({
      sessionId: s.sessionId || s.session_id,
      title: s.title || "Đoạn chat mới",
      createdAt: s.createdAt || s.created_at,
      updatedAt: s.updatedAt || s.updated_at || s.createdAt || s.created_at,
    }));
  } catch (err) {
    console.error("Failed to fetch chat sessions:", err);
    return [];
  }
}

/**
 * Fetch past chat messages for a session.
 * Endpoint: GET /ai/chat/history?session_id={sessionId}
 */
export async function fetchChatHistory(sessionId: string): Promise<AIChatMessage[]> {
  try {
    const data = await apiFetch<{ sessionId?: string; session_id?: string; messages: any[] }>(
      `/ai/chat/history?session_id=${encodeURIComponent(sessionId)}`
    );
    const rawMessages = data?.messages ?? [];
    return rawMessages.map((m: any) => {
      const meta = m.metadata || m.metadata_info || {};
      const rawOrder = m.orderContext || m.order_context || meta.order_context || meta.orderContext;
      const orderContext = Array.isArray(rawOrder) ? rawOrder[0] : rawOrder;
      const citations =
        m.citations && m.citations.length > 0
          ? m.citations
          : meta.citations && meta.citations.length > 0
          ? meta.citations
          : undefined;

      return {
        id: String(m.id || ""),
        role: m.role,
        content: m.content,
        createdAt: m.createdAt || m.created_at,
        metadata: meta,
        isError: Boolean(meta.is_error),
        products:
          m.products && m.products.length > 0
            ? m.products
            : meta.products || [],
        citations: citations,
        orderContext: orderContext || undefined,
      };
    });
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return [];
    }
    throw err;
  }
}

/**
 * Delete a chat session.
 * Endpoint: DELETE /ai/chat/sessions/{sessionId}
 */
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  try {
    await apiFetch(`/ai/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    return true;
  } catch (err) {
    console.error("Failed to delete chat session:", err);
    return false;
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
  onCitations?: (citations: AICitationItem[]) => void;
  onOrderContext?: (order: AIOrderContext) => void;
  onError?: (err: Error) => void;
  onEnd?: () => void;
}): Promise<void> {
  const {
    message,
    sessionId,
    history,
    signal,
    onStatus,
    onTextChunk,
    onProducts,
    onCitations,
    onOrderContext,
    onError,
    onEnd,
  } = params;

  try {
    const response = await fetch(`${getApiBaseUrl()}/ai/chat/message`, {
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
          } else if (payload.type === "citations") {
            onCitations?.(payload.citations);
          } else if (payload.type === "order_context") {
            const rawOrder = payload.order;
            const orderData = Array.isArray(rawOrder) ? rawOrder[0] : rawOrder;
            if (orderData) {
              onOrderContext?.(orderData);
            }
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
