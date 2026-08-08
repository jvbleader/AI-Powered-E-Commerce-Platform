"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getApiBaseUrl } from "@/services/api";
import {
  areChatMessageListsEqual,
  EMPTY_CHAT_MESSAGES,
  mergeChatMessagesById,
} from "@/lib/chat-messages";
import type { SellerSessionSummary } from "@/types/chat";
import type { SellerMessage } from "@/hooks/useSellerChat";

type SenderType = "CUSTOMER" | "SELLER";

type ActiveSubscription = {
  conversationId: string;
  senderType: SenderType;
};

type SellerChatRealtimeProviderProps = {
  asSeller: boolean;
  enabled?: boolean;
  children: ReactNode;
};

const MAX_QUEUED_COMMANDS = 50;
const MAX_HANDSHAKE_FAILURES = 5;

function toWsBaseUrl() {
  return getApiBaseUrl().replace(/^http/, "ws");
}

function sortSessions(sessions: SellerSessionSummary[]) {
  return [...sessions].sort((a, b) => {
    const pinDiff = Number(b.is_pinned) - Number(a.is_pinned);
    if (pinDiff !== 0) return pinDiff;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

/**
 * Callbacks only. This object identity must stay stable for the lifetime of the
 * provider, otherwise consumer effects re-subscribe on every incoming message.
 */
type SellerChatRealtimeApi = {
  asSeller: boolean;
  loadSessions: (silent?: boolean) => Promise<void>;
  markSessionReadLocally: (conversationId: string) => void;
  conversationAction: (conversationId: string, action: string) => Promise<boolean>;
  removeSession: (conversationId: string) => void;
  updateSessionLocally: (
    conversationId: string,
    patch: Partial<SellerSessionSummary>
  ) => void;
  setSessions: React.Dispatch<React.SetStateAction<SellerSessionSummary[]>>;
  subscribeConversation: (conversationId: string, senderType: SenderType) => void;
  unsubscribeConversation: (conversationId?: string | null) => void;
  sendConversationMessage: (
    conversationId: string,
    payload: {
      content: string;
      sender_type: SenderType;
      attachment_type?: string;
      attachment_id?: string;
      reply_to_id?: number;
    }
  ) => void;
  markConversationRead: (conversationId: string, senderType: SenderType) => void;
  markConversationDelivered: (conversationId: string, senderType: SenderType) => void;
  refetchConversationMessages: (conversationId: string) => Promise<void>;
};

type SellerChatRealtimeState = {
  sessions: SellerSessionSummary[];
  unreadCount: number;
  isLoading: boolean;
  isRealtimeConnected: boolean;
  messagesByConversation: Record<string, SellerMessage[]>;
  subscribedConversationId: string | null;
};

const SellerChatRealtimeApiContext = createContext<SellerChatRealtimeApi | null>(null);
const SellerChatRealtimeStateContext = createContext<SellerChatRealtimeState | null>(
  null
);

export function SellerChatRealtimeProvider({
  asSeller,
  enabled = true,
  children,
}: SellerChatRealtimeProviderProps) {
  const [sessions, setSessions] = useState<SellerSessionSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, SellerMessage[]>
  >({});
  const [subscribedConversationId, setSubscribedConversationId] = useState<
    string | null
  >(null);

  const isInitialLoad = useRef(true);
  const inFlightLoad = useRef<Promise<void> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempt = useRef(0);
  const handshakeFailures = useRef(0);
  const outboundQueue = useRef<Record<string, unknown>[]>([]);
  const activeSubscriptionRef = useRef<ActiveSubscription | null>(null);
  const fetchGenerationRef = useRef<Record<string, number>>({});

  const upsertSession = useCallback((conversation: SellerSessionSummary) => {
    setSessions((prev) => {
      const without = prev.filter((s) => s.id !== conversation.id);
      return sortSessions([...without, conversation]);
    });
  }, []);

  const removeSession = useCallback((conversationId: string) => {
    setSessions((prev) => {
      const wasUnread = Boolean(prev.find((s) => s.id === conversationId)?.has_unread);
      if (wasUnread) {
        queueMicrotask(() => setUnreadCount((count) => Math.max(0, count - 1)));
      }
      return prev.filter((s) => s.id !== conversationId);
    });
    setMessagesByConversation((prev) => {
      if (!(conversationId in prev)) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, []);

  const updateSessionLocally = useCallback(
    (conversationId: string, patch: Partial<SellerSessionSummary>) => {
      setSessions((prev) =>
        sortSessions(prev.map((s) => (s.id === conversationId ? { ...s, ...patch } : s)))
      );
    },
    []
  );

  const loadSessions = useCallback(
    async (silent = false) => {
      // Mount hydrate and INBOX_READY often fire together; share one request.
      if (inFlightLoad.current) return inFlightLoad.current;

      if (!silent && isInitialLoad.current) setIsLoading(true);

      const request = (async () => {
        try {
          const data = await apiFetch<SellerSessionSummary[]>(
            `/api/seller-chat/conversations/my?as_seller=${asSeller}`
          );
          if (data) {
            setSessions(data);
            setUnreadCount(data.filter((s) => s.has_unread).length);
            isInitialLoad.current = false;
          }
        } catch (error) {
          console.error("Failed to load seller chat sessions", error);
        } finally {
          if (!silent) setIsLoading(false);
          inFlightLoad.current = null;
        }
      })();

      inFlightLoad.current = request;
      return request;
    },
    [asSeller]
  );

  const conversationAction = useCallback(
    async (conversationId: string, action: string) => {
      try {
        const result = await apiFetch<{ ok: boolean; removed?: boolean }>(
          `/api/seller-chat/conversations/${conversationId}/settings`,
          {
            method: "PATCH",
            body: JSON.stringify({ action }),
          }
        );
        if (!result?.ok) return false;

        if (action === "delete" || result.removed) {
          removeSession(conversationId);
          return true;
        }

        if (action === "pin") {
          updateSessionLocally(conversationId, { is_pinned: true });
        } else if (action === "unpin") {
          updateSessionLocally(conversationId, { is_pinned: false });
        } else if (action === "mute") {
          updateSessionLocally(conversationId, { is_muted: true });
        } else if (action === "unmute") {
          updateSessionLocally(conversationId, { is_muted: false });
        } else if (action === "mark_unread") {
          updateSessionLocally(conversationId, { has_unread: true });
          setUnreadCount((count) => count + 1);
        } else if (action === "mark_read") {
          updateSessionLocally(conversationId, { has_unread: false });
        }

        await loadSessions(true);
        return true;
      } catch (error) {
        console.error("Conversation action failed", error);
        return false;
      }
    },
    [loadSessions, removeSession, updateSessionLocally]
  );

  const markSessionReadLocally = useCallback((conversationId: string) => {
    setSessions((prev) => {
      const target = prev.find((s) => s.id === conversationId);
      if (!target?.has_unread) return prev;
      queueMicrotask(() => setUnreadCount((count) => Math.max(0, count - 1)));
      return prev.map((s) =>
        s.id === conversationId ? { ...s, has_unread: false, unread_count: 0 } : s
      );
    });
  }, []);

  const mergeMessagesForConversation = useCallback(
    (conversationId: string, incoming: SellerMessage[]) => {
      setMessagesByConversation((prev) => {
        const existing = prev[conversationId] ?? EMPTY_CHAT_MESSAGES;
        const merged = mergeChatMessagesById(existing, incoming);
        if (areChatMessageListsEqual(existing, merged)) return prev;
        return { ...prev, [conversationId]: merged };
      });
    },
    []
  );

  const appendMessageForConversation = useCallback(
    (conversationId: string, message: SellerMessage) => {
      setMessagesByConversation((prev) => {
        const existing = prev[conversationId] ?? EMPTY_CHAT_MESSAGES;
        if (existing.some((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [conversationId]: mergeChatMessagesById(existing, [message]),
        };
      });
    },
    []
  );

  const applyStatusUpdate = useCallback(
    (conversationId: string, messageIds: number[], status: SellerMessage["status"]) => {
      setMessagesByConversation((prev) => {
        const existing = prev[conversationId];
        if (!existing?.length) return prev;
        let changed = false;
        const next = existing.map((m) => {
          if (!messageIds.includes(m.id) || m.status === status) return m;
          changed = true;
          return { ...m, status };
        });
        if (!changed) return prev;
        return { ...prev, [conversationId]: next };
      });
    },
    []
  );

  const refetchConversationMessages = useCallback(
    async (conversationId: string) => {
      const generation = (fetchGenerationRef.current[conversationId] ?? 0) + 1;
      fetchGenerationRef.current[conversationId] = generation;

      try {
        const data = await apiFetch<SellerMessage[]>(
          `/api/seller-chat/conversations/${conversationId}/messages`
        );
        if (!data) return;
        if (fetchGenerationRef.current[conversationId] !== generation) return;
        mergeMessagesForConversation(conversationId, data);
      } catch (error) {
        console.error("Failed to refetch seller messages:", error);
      }
    },
    [mergeMessagesForConversation]
  );

  const sendRaw = useCallback((payload: Record<string, unknown>) => {
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  /**
   * Subscribe/unsubscribe are never queued: reconnect replays the active
   * subscription, so a stale one would target the wrong conversation.
   */
  const sendOrQueue = useCallback(
    (payload: Record<string, unknown>) => {
      if (sendRaw(payload)) return;
      if (outboundQueue.current.length >= MAX_QUEUED_COMMANDS) {
        outboundQueue.current.shift();
      }
      outboundQueue.current.push(payload);
    },
    [sendRaw]
  );

  const flushOutboundQueue = useCallback(() => {
    const socket = wsRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    const queued = outboundQueue.current;
    outboundQueue.current = [];
    for (const payload of queued) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  const subscribeConversation = useCallback(
    (conversationId: string, senderType: SenderType) => {
      const current = activeSubscriptionRef.current;
      const alreadyActive =
        current?.conversationId === conversationId && current.senderType === senderType;

      if (!alreadyActive) {
        if (current && current.conversationId !== conversationId) {
          sendRaw({
            action: "UNSUBSCRIBE_CONVERSATION",
            conversation_id: current.conversationId,
          });
        }

        activeSubscriptionRef.current = { conversationId, senderType };
        setSubscribedConversationId(conversationId);

        sendRaw({
          action: "SUBSCRIBE_CONVERSATION",
          conversation_id: conversationId,
          sender_type: senderType,
        });
      }

      void refetchConversationMessages(conversationId);
    },
    [refetchConversationMessages, sendRaw]
  );

  const unsubscribeConversation = useCallback(
    (conversationId?: string | null) => {
      const current = activeSubscriptionRef.current;
      if (!current) return;
      if (conversationId && current.conversationId !== conversationId) return;

      sendRaw({
        action: "UNSUBSCRIBE_CONVERSATION",
        conversation_id: current.conversationId,
      });

      activeSubscriptionRef.current = null;
      setSubscribedConversationId(null);
    },
    [sendRaw]
  );

  const sendConversationMessage = useCallback(
    (
      conversationId: string,
      payload: {
        content: string;
        sender_type: SenderType;
        attachment_type?: string;
        attachment_id?: string;
        reply_to_id?: number;
      }
    ) => {
      sendOrQueue({
        action: "SEND_MESSAGE",
        conversation_id: conversationId,
        content: payload.content || " ",
        sender_type: payload.sender_type,
        attachment_type: payload.attachment_type,
        attachment_id: payload.attachment_id,
        reply_to_id: payload.reply_to_id,
      });
    },
    [sendOrQueue]
  );

  const markConversationRead = useCallback(
    (conversationId: string, senderType: SenderType) => {
      sendOrQueue({
        action: "MARK_READ",
        conversation_id: conversationId,
        sender_type: senderType,
      });
    },
    [sendOrQueue]
  );

  const markConversationDelivered = useCallback(
    (conversationId: string, senderType: SenderType) => {
      sendOrQueue({
        action: "MARK_DELIVERED",
        conversation_id: conversationId,
        sender_type: senderType,
      });
    },
    [sendOrQueue]
  );

  const handleWsPayload = useCallback(
    (payload: Record<string, unknown>) => {
      const type = payload.type as string | undefined;

      if (type === "pong") return;

      if (type === "INBOX_UPSERT" && payload.conversation) {
        upsertSession(payload.conversation as SellerSessionSummary);
        return;
      }

      if (type === "INBOX_UNREAD_COUNT") {
        setUnreadCount((payload.unread_count as number | undefined) ?? 0);
        return;
      }

      if (type === "INBOX_READY") {
        void loadSessions(true);
        return;
      }

      if (type === "STATUS_UPDATE") {
        const conversationId =
          (payload.conversation_id as string | undefined) ??
          activeSubscriptionRef.current?.conversationId;
        const messageIds = payload.message_ids as number[] | undefined;
        const status = payload.status as SellerMessage["status"] | undefined;
        if (conversationId && messageIds?.length && status) {
          applyStatusUpdate(conversationId, messageIds, status);
        }
        return;
      }

      if (type === "ACK") {
        if (
          payload.action === "SEND_MESSAGE" &&
          payload.message &&
          typeof payload.message === "object"
        ) {
          const msg = payload.message as SellerMessage;
          if (typeof msg.id === "number" && typeof msg.conversation_id === "string") {
            appendMessageForConversation(msg.conversation_id, msg);
          }
        }
        return;
      }

      if (type === "ERROR") {
        console.error("Seller chat websocket error event", payload);
        return;
      }

      if (type === "SUBSCRIBED") return;

      if (typeof payload.id === "number" && typeof payload.conversation_id === "string") {
        appendMessageForConversation(
          payload.conversation_id,
          payload as unknown as SellerMessage
        );
      }
    },
    [appendMessageForConversation, applyStatusUpdate, loadSessions, upsertSession]
  );

  useEffect(() => {
    if (!enabled) return;
    void loadSessions();
  }, [enabled, loadSessions]);

  useEffect(() => {
    if (!enabled) {
      // Logged out: drop everything so the next session never resubscribes to
      // or renders a previous user's conversation.
      setIsRealtimeConnected(false);
      activeSubscriptionRef.current = null;
      outboundQueue.current = [];
      handshakeFailures.current = 0;
      reconnectAttempt.current = 0;
      isInitialLoad.current = true;
      setSubscribedConversationId(null);
      setMessagesByConversation({});
      setSessions([]);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    const clearTimers = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
    };

    const resubscribeActiveConversation = () => {
      const sub = activeSubscriptionRef.current;
      if (!sub) return;
      sendRaw({
        action: "SUBSCRIBE_CONVERSATION",
        conversation_id: sub.conversationId,
        sender_type: sub.senderType,
      });
      void refetchConversationMessages(sub.conversationId);
    };

    const connect = () => {
      if (cancelled) return;

      const socket = new WebSocket(
        `${toWsBaseUrl()}/api/seller-chat/ws?as_seller=${asSeller}`
      );
      wsRef.current = socket;
      let everOpened = false;

      socket.onopen = () => {
        if (cancelled) {
          socket.close();
          return;
        }
        everOpened = true;
        reconnectAttempt.current = 0;
        handshakeFailures.current = 0;
        setIsRealtimeConnected(true);
        resubscribeActiveConversation();
        flushOutboundQueue();

        pingTimer.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: "ping" }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          if (!event.data?.trim()) return;
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          handleWsPayload(payload);
        } catch (error) {
          console.error("Invalid seller chat websocket payload", error);
        }
      };

      socket.onclose = () => {
        setIsRealtimeConnected(false);
        clearTimers();
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (cancelled) return;

        // A socket that never opened means the handshake was rejected (usually
        // an expired session). Retrying fast would hammer the server forever.
        if (!everOpened) {
          handshakeFailures.current += 1;
          if (handshakeFailures.current >= MAX_HANDSHAKE_FAILURES) return;
        }

        const delay = Math.min(3000 * 1.5 ** reconnectAttempt.current, 30000);
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    const handleWakeUp = () => {
      if (document.visibilityState !== "visible") return;
      const socket = wsRef.current;
      if (
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
      clearTimers();
      reconnectAttempt.current = 0;
      handshakeFailures.current = 0;
      connect();
    };

    document.addEventListener("visibilitychange", handleWakeUp);
    window.addEventListener("online", handleWakeUp);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleWakeUp);
      window.removeEventListener("online", handleWakeUp);
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsRealtimeConnected(false);
    };
  }, [
    asSeller,
    enabled,
    flushOutboundQueue,
    handleWsPayload,
    refetchConversationMessages,
    sendRaw,
  ]);

  const api = useMemo<SellerChatRealtimeApi>(
    () => ({
      asSeller,
      loadSessions,
      markSessionReadLocally,
      conversationAction,
      removeSession,
      updateSessionLocally,
      setSessions,
      subscribeConversation,
      unsubscribeConversation,
      sendConversationMessage,
      markConversationRead,
      markConversationDelivered,
      refetchConversationMessages,
    }),
    [
      asSeller,
      loadSessions,
      markSessionReadLocally,
      conversationAction,
      removeSession,
      updateSessionLocally,
      subscribeConversation,
      unsubscribeConversation,
      sendConversationMessage,
      markConversationRead,
      markConversationDelivered,
      refetchConversationMessages,
    ]
  );

  const state = useMemo<SellerChatRealtimeState>(
    () => ({
      sessions,
      unreadCount,
      isLoading,
      isRealtimeConnected,
      messagesByConversation,
      subscribedConversationId,
    }),
    [
      sessions,
      unreadCount,
      isLoading,
      isRealtimeConnected,
      messagesByConversation,
      subscribedConversationId,
    ]
  );

  return (
    <SellerChatRealtimeApiContext.Provider value={api}>
      <SellerChatRealtimeStateContext.Provider value={state}>
        {children}
      </SellerChatRealtimeStateContext.Provider>
    </SellerChatRealtimeApiContext.Provider>
  );
}

export function useOptionalSellerChatRealtimeApi() {
  return useContext(SellerChatRealtimeApiContext);
}

export function useOptionalSellerChatRealtimeState() {
  return useContext(SellerChatRealtimeStateContext);
}

export function useSellerChatRealtimeApi() {
  const ctx = useContext(SellerChatRealtimeApiContext);
  if (!ctx) {
    throw new Error(
      "useSellerChatRealtimeApi must be used within SellerChatRealtimeProvider"
    );
  }
  return ctx;
}

export function useSellerChatRealtimeState() {
  const ctx = useContext(SellerChatRealtimeStateContext);
  if (!ctx) {
    throw new Error(
      "useSellerChatRealtimeState must be used within SellerChatRealtimeProvider"
    );
  }
  return ctx;
}

export type SellerChatInboxSlice = {
  sessions: SellerSessionSummary[];
  unreadCount: number;
  isLoading: boolean;
  isRealtimeConnected: boolean;
  loadSessions: SellerChatRealtimeApi["loadSessions"];
  markSessionReadLocally: SellerChatRealtimeApi["markSessionReadLocally"];
  conversationAction: SellerChatRealtimeApi["conversationAction"];
  removeSession: SellerChatRealtimeApi["removeSession"];
  updateSessionLocally: SellerChatRealtimeApi["updateSessionLocally"];
  setSessions: SellerChatRealtimeApi["setSessions"];
};

export function useSellerChatInboxSlice(): SellerChatInboxSlice {
  const api = useSellerChatRealtimeApi();
  const state = useSellerChatRealtimeState();

  return useMemo(
    () => ({
      sessions: state.sessions,
      unreadCount: state.unreadCount,
      isLoading: state.isLoading,
      isRealtimeConnected: state.isRealtimeConnected,
      loadSessions: api.loadSessions,
      markSessionReadLocally: api.markSessionReadLocally,
      conversationAction: api.conversationAction,
      removeSession: api.removeSession,
      updateSessionLocally: api.updateSessionLocally,
      setSessions: api.setSessions,
    }),
    [api, state]
  );
}
