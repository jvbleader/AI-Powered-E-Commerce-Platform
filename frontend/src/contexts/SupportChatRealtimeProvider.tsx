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
import { parseApiDateTime } from "@/lib/helpers";
import type {
  SupportConversation,
  SupportMessage,
  SupportSessionSummary,
  SupportAttachment,
} from "@/types/support-chat";

type SupportChatRealtimeProviderProps = {
  mode: "customer" | "supporter";
  guestId?: string | null;
  asCustomer?: boolean;
  enabled?: boolean;
  supporterPublicId?: string | null;
  children: ReactNode;
};

const MAX_QUEUED_COMMANDS = 50;
const MAX_HANDSHAKE_FAILURES = 5;
const PING_INTERVAL_MS = 20000;

function toWsBaseUrl() {
  return getApiBaseUrl().replace(/^http/, "ws");
}

function sortSessions(sessions: SupportSessionSummary[]) {
  return [...sessions].sort(
    (a, b) => (parseApiDateTime(b.updated_at)?.getTime() || 0) - (parseApiDateTime(a.updated_at)?.getTime() || 0)
  );
}

function resolveGuestIdForWs(propGuestId?: string | null): string | null {
  if (propGuestId) return propGuestId;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("guest_id");
}

function buildWsUrl(
  mode: "customer" | "supporter",
  guestId?: string | null,
  asCustomer = false
) {
  const base = `${toWsBaseUrl()}/api/support-chat/ws`;
  const params = new URLSearchParams();
  const effectiveGuestId = mode === "customer" ? resolveGuestIdForWs(guestId) : null;
  if (mode === "customer" && effectiveGuestId) {
    params.set("guest_id", effectiveGuestId);
  }
  if (mode === "customer" && asCustomer) {
    params.set("as_customer", "true");
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

type SupportChatRealtimeApi = {
  mode: "customer" | "supporter";
  loadSessions: (silent?: boolean) => Promise<void>;
  loadSupporterLists: (silent?: boolean) => Promise<void>;
  updateSessionLocally: (
    conversationId: string,
    patch: Partial<SupportSessionSummary>
  ) => void;
  upsertQueueSession: (conversation: SupportSessionSummary) => void;
  removeQueueSession: (conversationId: string) => void;
  subscribeConversation: (conversationId: string) => void;
  unsubscribeConversation: (conversationId?: string | null) => void;
  sendConversationMessage: (
    conversationId: string,
    payload: {
      content: string;
      attachment_type?: string;
      attachment_id?: string;
      attachments?: SupportAttachment[];
    }
  ) => void;
  refetchConversationMessages: (conversationId: string) => Promise<void>;
  refetchConversationDetails: (conversationId: string) => Promise<void>;
  receiveConversationMessage: (message: SupportMessage) => void;
};

type SupportChatRealtimeState = {
  sessions: SupportSessionSummary[];
  queueSessions: SupportSessionSummary[];
  activeSessions: SupportSessionSummary[];
  unreadCount: number;
  isLoading: boolean;
  isRealtimeConnected: boolean;
  messagesByConversation: Record<string, SupportMessage[]>;
  conversationsById: Record<string, SupportConversation>;
  subscribedConversationId: string | null;
};

const SupportChatRealtimeApiContext = createContext<SupportChatRealtimeApi | null>(null);
const SupportChatRealtimeStateContext = createContext<SupportChatRealtimeState | null>(
  null
);

export function SupportChatRealtimeProvider({
  mode,
  guestId = null,
  asCustomer = false,
  enabled = true,
  supporterPublicId = null,
  children,
}: SupportChatRealtimeProviderProps) {
  const [sessions, setSessions] = useState<SupportSessionSummary[]>([]);
  const [queueSessions, setQueueSessions] = useState<SupportSessionSummary[]>([]);
  const [activeSessions, setActiveSessions] = useState<SupportSessionSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, SupportMessage[]>
  >({});
  const [conversationsById, setConversationsById] = useState<
    Record<string, SupportConversation>
  >({});
  const [subscribedConversationId, setSubscribedConversationId] = useState<
    string | null
  >(null);

  const isInitialLoad = useRef(true);
  const inFlightLoad = useRef<Promise<void> | null>(null);
  const inFlightSupporterLoad = useRef<Promise<void> | null>(null);
  const inFlightMessagesRef = useRef<Record<string, Promise<void>>>({});
  const lastMessagesFetchAtRef = useRef<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempt = useRef(0);
  const handshakeFailures = useRef(0);
  const outboundQueue = useRef<Record<string, unknown>[]>([]);
  const activeSubscriptionRef = useRef<string | null>(null);
  const fetchGenerationRef = useRef<Record<string, number>>({});
  const resubscribeActiveConversationRef = useRef<() => void>(() => {});
  const subscribeRetryCountsRef = useRef<Record<string, number>>({});
  const guestIdRef = useRef(guestId);
  const supporterPublicIdRef = useRef(supporterPublicId);
  const asCustomerRef = useRef(asCustomer);

  guestIdRef.current = guestId;
  supporterPublicIdRef.current = supporterPublicId;
  asCustomerRef.current = asCustomer;

  const upsertSession = useCallback((conversation: SupportSessionSummary) => {
    setSessions((prev) => {
      const without = prev.filter((s) => s.id !== conversation.id);
      return sortSessions([...without, conversation]);
    });
  }, []);

  const upsertActiveSession = useCallback((conversation: SupportSessionSummary) => {
    setActiveSessions((prev) => {
      const without = prev.filter((s) => s.id !== conversation.id);
      return sortSessions([...without, conversation]);
    });
  }, []);

  const upsertQueueSession = useCallback((conversation: SupportSessionSummary) => {
    setQueueSessions((prev) => {
      const without = prev.filter((s) => s.id !== conversation.id);
      return sortSessions([...without, conversation]);
    });
  }, []);

  const removeQueueSession = useCallback((conversationId: string) => {
    setQueueSessions((prev) => prev.filter((s) => s.id !== conversationId));
  }, []);

  const updateSessionLocally = useCallback(
    (conversationId: string, patch: Partial<SupportSessionSummary>) => {
      setSessions((prev) =>
        sortSessions(prev.map((s) => (s.id === conversationId ? { ...s, ...patch } : s)))
      );
      setActiveSessions((prev) =>
        sortSessions(prev.map((s) => (s.id === conversationId ? { ...s, ...patch } : s)))
      );
      setQueueSessions((prev) =>
        sortSessions(prev.map((s) => (s.id === conversationId ? { ...s, ...patch } : s)))
      );
    },
    []
  );

  const loadSessions = useCallback(
    async (silent = false) => {
      if (mode !== "customer") return;
      if (inFlightLoad.current) return inFlightLoad.current;

      if (!silent && isInitialLoad.current) setIsLoading(true);

      const request = (async () => {
        try {
          const effectiveGuestId = resolveGuestIdForWs(guestIdRef.current);
          const query = effectiveGuestId
            ? `?guest_id=${encodeURIComponent(effectiveGuestId)}`
            : "";
          const data = await apiFetch<SupportSessionSummary[]>(
            `/api/support-chat/conversations/my${query}`
          );
          if (data) {
            setSessions(sortSessions(data));
            setUnreadCount(data.filter((s) => s.has_unread).length);
            isInitialLoad.current = false;
          }
        } catch (error) {
          console.error("Failed to load support chat sessions", error);
        } finally {
          if (!silent) setIsLoading(false);
          inFlightLoad.current = null;
        }
      })();

      inFlightLoad.current = request;
      return request;
    },
    [mode]
  );

  const loadSupporterLists = useCallback(
    async (silent = false) => {
      if (mode !== "supporter") return;
      if (inFlightSupporterLoad.current) return inFlightSupporterLoad.current;

      if (!silent && isInitialLoad.current) setIsLoading(true);

      const request = (async () => {
        try {
          const [queueData, activeData] = await Promise.all([
            apiFetch<SupportSessionSummary[]>(
              "/api/support-chat/conversations?unassigned=true"
            ),
            apiFetch<SupportSessionSummary[]>(
              "/api/support-chat/conversations?active=true"
            ),
          ]);
          if (queueData) setQueueSessions(sortSessions(queueData));
          if (activeData) setActiveSessions(sortSessions(activeData));
          isInitialLoad.current = false;
        } catch (error) {
          console.error("Failed to load supporter chat lists", error);
        } finally {
          if (!silent) setIsLoading(false);
          inFlightSupporterLoad.current = null;
        }
      })();

      inFlightSupporterLoad.current = request;
      return request;
    },
    [mode]
  );

  const mergeMessagesForConversation = useCallback(
    (conversationId: string, incoming: SupportMessage[]) => {
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
    (conversationId: string, message: SupportMessage) => {
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

  const refetchConversationMessages = useCallback(
    async (conversationId: string, options?: { force?: boolean }) => {
      const inFlight = inFlightMessagesRef.current[conversationId];
      if (inFlight) return inFlight;

      const now = Date.now();
      const lastFetchAt = lastMessagesFetchAtRef.current[conversationId] ?? 0;
      if (!options?.force && now - lastFetchAt < 2000) return;

      const generation = (fetchGenerationRef.current[conversationId] ?? 0) + 1;
      fetchGenerationRef.current[conversationId] = generation;
      lastMessagesFetchAtRef.current[conversationId] = now;

      const request = (async () => {
        try {
          const effectiveGuestId = resolveGuestIdForWs(guestIdRef.current);
          const query = effectiveGuestId
            ? `?guest_id=${encodeURIComponent(effectiveGuestId)}`
            : "";
          const data = await apiFetch<SupportMessage[]>(
            `/api/support-chat/conversations/${conversationId}/messages${query}`
          );
          if (!data) return;
          if (fetchGenerationRef.current[conversationId] !== generation) return;
          mergeMessagesForConversation(conversationId, data);
        } catch (error) {
          console.error("Failed to refetch support messages:", error);
        } finally {
          delete inFlightMessagesRef.current[conversationId];
        }
      })();

      inFlightMessagesRef.current[conversationId] = request;
      return request;
    },
    [mergeMessagesForConversation]
  );

  const receiveConversationMessage = useCallback(
    (message: SupportMessage) => {
      if (typeof message.id !== "number" || typeof message.conversation_id !== "string") {
        return;
      }
      appendMessageForConversation(message.conversation_id, message);
    },
    [appendMessageForConversation]
  );

  const refetchConversationDetails = useCallback(async (conversationId: string) => {
    try {
      const effectiveGuestId = resolveGuestIdForWs(guestIdRef.current);
      const query = effectiveGuestId
        ? `?guest_id=${encodeURIComponent(effectiveGuestId)}`
        : "";
      const data = await apiFetch<SupportConversation>(
        `/api/support-chat/conversations/${conversationId}${query}`
      );
      if (!data) return;
      setConversationsById((prev) => ({ ...prev, [conversationId]: data }));
    } catch (error) {
      console.error("Failed to refetch support conversation details:", error);
    }
  }, []);

  const sendRaw = useCallback((payload: Record<string, unknown>) => {
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

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

  const sendSubscribeCommand = useCallback(
    (conversationId: string) => {
      const guest = resolveGuestIdForWs(guestIdRef.current);
      sendOrQueue({
        action: "SUBSCRIBE_CONVERSATION",
        conversation_id: conversationId,
        ...(guest ? { guest_id: guest } : {}),
      });
    },
    [sendOrQueue]
  );

  const resubscribeActiveConversation = useCallback(() => {
    const sub = activeSubscriptionRef.current;
    if (!sub) return;
    sendSubscribeCommand(sub);
  }, [sendSubscribeCommand]);

  resubscribeActiveConversationRef.current = resubscribeActiveConversation;

  const subscribeConversation = useCallback(
    (conversationId: string) => {
      const current = activeSubscriptionRef.current;
      const alreadyActive = current === conversationId;

      activeSubscriptionRef.current = conversationId;
      setSubscribedConversationId(conversationId);

      if (!alreadyActive) {
        if (current && current !== conversationId) {
          sendOrQueue({
            action: "UNSUBSCRIBE_CONVERSATION",
            conversation_id: current,
          });
        }

        sendSubscribeCommand(conversationId);
        void refetchConversationMessages(conversationId);
      }
    },
    [refetchConversationMessages, sendSubscribeCommand]
  );

  const unsubscribeConversation = useCallback(
    (conversationId?: string | null) => {
      const current = activeSubscriptionRef.current;
      if (!current) return;
      if (conversationId && current !== conversationId) return;

      sendOrQueue({
        action: "UNSUBSCRIBE_CONVERSATION",
        conversation_id: current,
      });

      activeSubscriptionRef.current = null;
      setSubscribedConversationId(null);
    },
    [sendOrQueue]
  );

  const sendConversationMessage = useCallback(
    (
      conversationId: string,
      payload: {
        content: string;
        attachment_type?: string;
        attachment_id?: string;
        attachments?: SupportAttachment[];
      }
    ) => {
      sendOrQueue({
        action: "SEND_MESSAGE",
        conversation_id: conversationId,
        content: payload.content || " ",
        attachment_type: payload.attachment_type,
        attachment_id: payload.attachment_id,
        attachments: payload.attachments,
      });
    },
    [sendOrQueue]
  );

  const handleWsPayload = useCallback(
    (payload: Record<string, unknown>) => {
      const type = payload.type as string | undefined;

      if (type === "pong") return;

      if (type === "INBOX_UPSERT" && payload.conversation) {
        const conv = payload.conversation as SupportSessionSummary;
        if (mode === "customer") {
          upsertSession(conv);
        } else if (conv.supporter?.public_id === supporterPublicIdRef.current) {
          upsertActiveSession(conv);
        }
        return;
      }

      if (type === "INBOX_UNREAD_COUNT") {
        setUnreadCount((payload.unread_count as number | undefined) ?? 0);
        return;
      }

      if (type === "INBOX_READY") {
        if (mode === "customer") void loadSessions(true);
        else void loadSupporterLists(true);
        resubscribeActiveConversationRef.current();
        return;
      }

      if (type === "QUEUE_UPSERT" && payload.conversation) {
        if (mode === "supporter") {
          upsertQueueSession(payload.conversation as SupportSessionSummary);
        }
        return;
      }

      if (type === "QUEUE_REMOVE") {
        const conversationId = payload.conversation_id as string | undefined;
        if (conversationId && mode === "supporter") {
          removeQueueSession(conversationId);
        }
        return;
      }

      if (type === "ACK") {
        if (
          payload.action === "SUBSCRIBE_CONVERSATION" &&
          typeof payload.conversation_id === "string"
        ) {
          activeSubscriptionRef.current = payload.conversation_id as string;
          setSubscribedConversationId(payload.conversation_id as string);
          delete subscribeRetryCountsRef.current[payload.conversation_id as string];
        }
        if (
          payload.action === "SEND_MESSAGE" &&
          payload.message &&
          typeof payload.message === "object"
        ) {
          const msg = payload.message as SupportMessage;
          if (typeof msg.id === "number" && typeof msg.conversation_id === "string") {
            appendMessageForConversation(msg.conversation_id, msg);
          }
        }
        return;
      }

      if (type === "ERROR") {
        if (
          payload.error === "Forbidden" &&
          payload.action === "SUBSCRIBE_CONVERSATION" &&
          typeof payload.conversation_id === "string"
        ) {
          const conversationId = payload.conversation_id as string;
          if (activeSubscriptionRef.current !== conversationId) {
            return;
          }
          const attempts = subscribeRetryCountsRef.current[conversationId] ?? 0;
          if (attempts < 2) {
            subscribeRetryCountsRef.current[conversationId] = attempts + 1;
            window.setTimeout(() => {
              if (activeSubscriptionRef.current === conversationId) {
                sendSubscribeCommand(conversationId);
              }
            }, 300 * (attempts + 1));
            return;
          }
        }

        if (
          payload.error !== "Forbidden" ||
          payload.action !== "SUBSCRIBE_CONVERSATION"
        ) {
          console.error("Support chat websocket error event", payload);
        }
        return;
      }

      if (typeof payload.id === "number" && typeof payload.conversation_id === "string") {
        const msg = payload as unknown as SupportMessage;
        appendMessageForConversation(msg.conversation_id, msg);
        if (msg.sender_type === "SYSTEM") {
          void refetchConversationDetails(msg.conversation_id);
        }
      }
    },
    [
      appendMessageForConversation,
      loadSessions,
      loadSupporterLists,
      mode,
      refetchConversationDetails,
      removeQueueSession,
      sendSubscribeCommand,
      upsertActiveSession,
      upsertQueueSession,
      upsertSession,
    ]
  );

  useEffect(() => {
    if (!enabled) return;
    if (mode === "customer") void loadSessions();
    else void loadSupporterLists();
  }, [enabled, loadSessions, loadSupporterLists, mode]);

  useEffect(() => {
    if (!enabled) {
      setIsRealtimeConnected(false);
      activeSubscriptionRef.current = null;
      handshakeFailures.current = 0;
      reconnectAttempt.current = 0;
      isInitialLoad.current = true;
      setSubscribedConversationId(null);
      setMessagesByConversation({});
      setConversationsById({});
      setSessions([]);
      setQueueSessions([]);
      setActiveSessions([]);
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

    const connect = () => {
      if (cancelled) return;
      if (mode === "customer" && !resolveGuestIdForWs(guestIdRef.current)) return;

      const socket = new WebSocket(
        buildWsUrl(mode, guestIdRef.current, asCustomerRef.current)
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
        const activeConversationId = activeSubscriptionRef.current;
        resubscribeActiveConversationRef.current();
        if (activeConversationId) {
          void refetchConversationMessages(activeConversationId, { force: true });
        }
        flushOutboundQueue();

        pingTimer.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: "ping" }));
          }
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = (event) => {
        try {
          if (!event.data?.trim()) return;
          const parsed = JSON.parse(event.data) as Record<string, unknown>;
          handleWsPayload(parsed);
        } catch (error) {
          console.error("Invalid support chat websocket payload", error);
        }
      };

      socket.onclose = () => {
        setIsRealtimeConnected(false);
        clearTimers();
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (cancelled) return;

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
    enabled,
    mode,
    guestId,
    asCustomer,
    flushOutboundQueue,
    handleWsPayload,
    refetchConversationMessages,
    sendRaw,
  ]);

  const api = useMemo<SupportChatRealtimeApi>(
    () => ({
      mode,
      loadSessions,
      loadSupporterLists,
      updateSessionLocally,
      upsertQueueSession,
      removeQueueSession,
      subscribeConversation,
      unsubscribeConversation,
      sendConversationMessage,
      refetchConversationMessages,
      refetchConversationDetails,
      receiveConversationMessage,
    }),
    [
      mode,
      loadSessions,
      loadSupporterLists,
      updateSessionLocally,
      upsertQueueSession,
      removeQueueSession,
      subscribeConversation,
      unsubscribeConversation,
      sendConversationMessage,
      refetchConversationMessages,
      refetchConversationDetails,
      receiveConversationMessage,
    ]
  );

  const state = useMemo<SupportChatRealtimeState>(
    () => ({
      sessions,
      queueSessions,
      activeSessions,
      unreadCount,
      isLoading,
      isRealtimeConnected,
      messagesByConversation,
      conversationsById,
      subscribedConversationId,
    }),
    [
      sessions,
      queueSessions,
      activeSessions,
      unreadCount,
      isLoading,
      isRealtimeConnected,
      messagesByConversation,
      conversationsById,
      subscribedConversationId,
    ]
  );

  return (
    <SupportChatRealtimeApiContext.Provider value={api}>
      <SupportChatRealtimeStateContext.Provider value={state}>
        {children}
      </SupportChatRealtimeStateContext.Provider>
    </SupportChatRealtimeApiContext.Provider>
  );
}

export function useOptionalSupportChatRealtimeApi() {
  return useContext(SupportChatRealtimeApiContext);
}

export function useOptionalSupportChatRealtimeState() {
  return useContext(SupportChatRealtimeStateContext);
}

export function useSupportChatRealtimeApi() {
  const ctx = useContext(SupportChatRealtimeApiContext);
  if (!ctx) {
    throw new Error(
      "useSupportChatRealtimeApi must be used within SupportChatRealtimeProvider"
    );
  }
  return ctx;
}

export function useSupportChatRealtimeState() {
  const ctx = useContext(SupportChatRealtimeStateContext);
  if (!ctx) {
    throw new Error(
      "useSupportChatRealtimeState must be used within SupportChatRealtimeProvider"
    );
  }
  return ctx;
}

export type SupportChatInboxSlice = {
  sessions: SupportSessionSummary[];
  unreadCount: number;
  isLoading: boolean;
  isRealtimeConnected: boolean;
  loadSessions: SupportChatRealtimeApi["loadSessions"];
  updateSessionLocally: SupportChatRealtimeApi["updateSessionLocally"];
};

export function useSupportChatInboxSlice(): SupportChatInboxSlice {
  const api = useSupportChatRealtimeApi();
  const state = useSupportChatRealtimeState();

  return useMemo(
    () => ({
      sessions: state.sessions,
      unreadCount: state.unreadCount,
      isLoading: state.isLoading,
      isRealtimeConnected: state.isRealtimeConnected,
      loadSessions: api.loadSessions,
      updateSessionLocally: api.updateSessionLocally,
    }),
    [api, state]
  );
}

export type SupportSupporterInboxSlice = {
  queueSessions: SupportSessionSummary[];
  activeSessions: SupportSessionSummary[];
  isLoading: boolean;
  isRealtimeConnected: boolean;
  loadSupporterLists: SupportChatRealtimeApi["loadSupporterLists"];
  updateSessionLocally: SupportChatRealtimeApi["updateSessionLocally"];
};

export function useSupportSupporterInboxSlice(): SupportSupporterInboxSlice {
  const api = useSupportChatRealtimeApi();
  const state = useSupportChatRealtimeState();

  return useMemo(
    () => ({
      queueSessions: state.queueSessions,
      activeSessions: state.activeSessions,
      isLoading: state.isLoading,
      isRealtimeConnected: state.isRealtimeConnected,
      loadSupporterLists: api.loadSupporterLists,
      updateSessionLocally: api.updateSessionLocally,
    }),
    [api, state]
  );
}
