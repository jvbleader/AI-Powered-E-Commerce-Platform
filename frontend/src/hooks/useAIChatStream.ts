"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import {
  AIChatMessage,
  AIProductItem,
  AIChatSessionSummary,
  getOrCreateSessionId,
  fetchChatHistory,
  sendStreamChatMessage,
  clearSessionId,
  fetchChatSessions,
  setSessionIdLocal
} from "@/services/aiChatService";

export function useAIChatStream() {
  const sessionUserId = useMarketplaceStore((s) => s.state.sessionUserId);
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const isReload = window.performance?.navigation?.type === 1 || 
                       (window.performance?.getEntriesByType("navigation")?.[0] as PerformanceNavigationTiming)?.type === "reload";
      if (isReload) {
        return sessionStorage.getItem("chat_active_ai_session_id") || "";
      }
    }
    return "";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (sessionId) {
        sessionStorage.setItem("chat_active_ai_session_id", sessionId);
      } else {
        sessionStorage.removeItem("chat_active_ai_session_id");
      }
    }
  }, [sessionId]);

  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [chatSessions, setChatSessions] = useState<AIChatSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);
  const isInitialLoad = useRef(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<AIChatMessage[]>(messages);
  messagesRef.current = messages;

  const loadSessions = useCallback(async (silent = false) => {
    if (!sessionUserId) {
      setChatSessions([]);
      if (!silent) setIsLoadingSessions(false);
      return;
    }
    if (!silent && isInitialLoad.current) setIsLoadingSessions(true);
    const sessions = await fetchChatSessions();
    setChatSessions(sessions);
    isInitialLoad.current = false;
    if (!silent) setIsLoadingSessions(false);
  }, [sessionUserId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const isInternalSessionChange = useRef(false);

  // Initialize session & load history based on logged-in state
  useEffect(() => {
    if (isInternalSessionChange.current) {
      isInternalSessionChange.current = false;
      return;
    }

    // Only load history if a sessionId is explicitly set (e.g. clicked from sidebar)
    if (sessionId) {
      setIsLoadingHistory(true);
      fetchChatHistory(sessionId)
        .then((history) => {
          setMessages(history);
        })
        .catch((err) => {
          console.error("Failed to fetch chat history:", err);
          setMessages([]);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      setMessages([]);
      setIsLoadingHistory(false);
    }
  }, [sessionId, sessionUserId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      let activeSessionId = sessionId;
      if (!activeSessionId) {
        // Create a fresh session ID
        const generateUuid = () =>
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        activeSessionId = generateUuid();
        if (sessionUserId) {
          setSessionIdLocal(sessionUserId, activeSessionId);
        }
        isInternalSessionChange.current = true;
        setSessionId(activeSessionId);
      }

      setError(null);
      setCurrentStatus(null);
      setIsStreaming(true);

      const userMsgId = `user-${Date.now()}`;
      const userMsg: AIChatMessage = {
        id: userMsgId,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString()
      };

      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMsg: AIChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        products: [],
        createdAt: new Date().toISOString()
      };

      // Current message history before inserting new messages
      const historyPayload = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content
      }));

      // Append AI response skeleton
      const newMessages = [...messagesRef.current, userMsg, assistantMsg];
      setMessages(newMessages);

      abortControllerRef.current = new AbortController();

      await sendStreamChatMessage({
        message: trimmed,
        sessionId: activeSessionId,
        history: historyPayload,
        signal: abortControllerRef.current.signal,
        onStatus: (status) => {
          setCurrentStatus(status);
        },
        onTextChunk: (chunk) => {
          setCurrentStatus(null); // Clear status when text tokens begin
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          );
        },
        onProducts: (products: AIProductItem[]) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, products } : msg
            )
          );
        },
        onEnd: () => {
          setIsStreaming(false);
          setCurrentStatus(null);
          // Reload sessions to update sidebar ordering and timestamps
          loadSessions(true);
        },
        onError: (err) => {
          setIsStreaming(false);
          setCurrentStatus(null);
          setError(err.message || "Lỗi kết nối đến trợ lý AI");
        }
      });
    },
    [isStreaming, sessionId, sessionUserId, loadSessions]
  );

  const switchChat = useCallback((newSessionId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSessionIdLocal(sessionUserId, newSessionId);
    setSessionId(newSessionId);
    setIsLoadingHistory(true);
    fetchChatHistory(newSessionId)
      .then((history) => {
        setMessages(history);
      })
      .catch((err) => {
        console.error("Failed to fetch chat history:", err);
        setMessages([]);
      })
      .finally(() => {
        setIsLoadingHistory(false);
      });
    setIsStreaming(false);
    setCurrentStatus(null);
    setError(null);
  }, [sessionUserId]);

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearSessionId(sessionUserId);
    setSessionId("");
    setMessages([]);
    setIsStreaming(false);
    setCurrentStatus(null);
    setError(null);
    loadSessions();
  }, [sessionUserId, loadSessions]);

  return {
    sessionId,
    messages,
    isStreaming,
    currentStatus,
    isLoadingHistory,
    error,
    chatSessions,
    isLoadingSessions,
    sendMessage,
    clearChat,
    switchChat
  };
}

