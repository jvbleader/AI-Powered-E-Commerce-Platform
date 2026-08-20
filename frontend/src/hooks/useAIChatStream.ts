"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { STORAGE_KEYS } from "@/constants/storage-keys";
import {
  AIChatMessage,
  AIProductItem,
  AIChatSessionSummary,
  getOrCreateSessionId,
  fetchChatHistory,
  sendStreamChatMessage,
  clearSessionId,
  fetchChatSessions,
  setSessionIdLocal,
  deleteChatSession
} from "@/services/aiChatService";

export function useAIChatStream() {
  const sessionUserId = useMarketplaceStore((s) => s.state.sessionUserId);
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const activeKey = sessionUserId
        ? `${STORAGE_KEYS.AI_SESSION}_${sessionUserId}`
        : STORAGE_KEYS.AI_SESSION;
      return (
        sessionStorage.getItem("chat_active_ai_session_id") ||
        localStorage.getItem(activeKey) ||
        ""
      );
    }
    return "";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (sessionId) {
        sessionStorage.setItem("chat_active_ai_session_id", sessionId);
        if (sessionUserId) {
          setSessionIdLocal(sessionUserId, sessionId);
        }
      } else {
        sessionStorage.removeItem("chat_active_ai_session_id");
        if (sessionUserId) {
          clearSessionId(sessionUserId);
        }
      }
    }
  }, [sessionId, sessionUserId]);

  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [chatSessions, setChatSessions] = useState<AIChatSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);
  const isInitialLoad = useRef(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<AIChatMessage[]>(messages);
  messagesRef.current = messages;

  const hasAutoSelectedInitialSession = useRef(false);

  const loadSessions = useCallback(async (silent = false) => {
    if (!sessionUserId) {
      if (!silent) setIsLoadingSessions(false);
      return [];
    }
    if (!silent && isInitialLoad.current) setIsLoadingSessions(true);
    try {
      const sessions = await fetchChatSessions();
      if (sessions && Array.isArray(sessions)) {
        setChatSessions(sessions);
      }
      return sessions;
    } catch (err) {
      console.error("Failed to load chat sessions:", err);
      return [];
    } finally {
      isInitialLoad.current = false;
      if (!silent) setIsLoadingSessions(false);
    }
  }, [sessionUserId]);

  // Initial load of sessions (only auto-select most recent on initial mount)
  useEffect(() => {
    if (!sessionUserId) return;
    loadSessions().then((sessions) => {
      if (!hasAutoSelectedInitialSession.current && sessions && sessions.length > 0) {
        hasAutoSelectedInitialSession.current = true;
        setSessionId((prev) => {
          if (!prev) {
            const firstId = sessions[0].sessionId;
            if (sessionUserId) setSessionIdLocal(sessionUserId, firstId);
            return firstId;
          }
          return prev;
        });
      }
    });
  }, [loadSessions, sessionUserId]);

  const isInternalSessionChange = useRef(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeSessionIdRef = useRef<string>(sessionId);
  activeSessionIdRef.current = sessionId;

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadHistoryWithPendingCheck = useCallback(
    async (targetSessionId: string) => {
      clearPolling();
      if (!targetSessionId) {
        setMessages([]);
        setIsLoadingHistory(false);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const history = await fetchChatHistory(targetSessionId);
        if (activeSessionIdRef.current !== targetSessionId) return;

        // If the latest message is from user, AI is still generating in the background
        const lastMsg = history[history.length - 1];
        if (lastMsg && lastMsg.role === "user") {
          const pendingAssistantMsg: AIChatMessage = {
            id: `assistant-pending-${Date.now()}`,
            role: "assistant",
            content: "",
            products: [],
            createdAt: new Date().toISOString(),
          };
          setMessages([...history, pendingAssistantMsg]);

          // Poll for completed background reply
          let retryCount = 0;
          pollTimerRef.current = setInterval(async () => {
            retryCount++;
            if (activeSessionIdRef.current !== targetSessionId) {
              clearPolling();
              return;
            }

            if (retryCount > 15) {
              clearPolling();
              if (activeSessionIdRef.current === targetSessionId) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === pendingAssistantMsg.id
                      ? {
                          ...msg,
                          content:
                            "Phản hồi bị gián đoạn hoặc quá thời gian chờ. Bạn vui lòng nhấn thử lại nhé!",
                          isError: true,
                        }
                      : msg
                  )
                );
              }
              return;
            }

            try {
              const polledHistory = await fetchChatHistory(targetSessionId);
              if (activeSessionIdRef.current !== targetSessionId) {
                clearPolling();
                return;
              }
              const polledLast = polledHistory[polledHistory.length - 1];
              if (polledLast && polledLast.role === "assistant") {
                clearPolling();
                setMessages(polledHistory);
                loadSessions(true);
              }
            } catch {
              // continue polling
            }
          }, 1500);
        } else {
          setMessages(history);
        }
      } catch (err) {
        console.error("Failed to fetch chat history:", err);
        if (activeSessionIdRef.current === targetSessionId) {
          setMessages([]);
        }
      } finally {
        if (activeSessionIdRef.current === targetSessionId) {
          setIsLoadingHistory(false);
        }
      }
    },
    [clearPolling, loadSessions]
  );

  // Load history whenever active sessionId changes
  useEffect(() => {
    if (isInternalSessionChange.current) {
      isInternalSessionChange.current = false;
      return;
    }

    loadHistoryWithPendingCheck(sessionId);

    return () => {
      clearPolling();
    };
  }, [sessionId, sessionUserId, loadHistoryWithPendingCheck, clearPolling]);

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

      // Optimistically create or bump session in sidebar history immediately
      if (sessionUserId) {
        const sessionTitle =
          trimmed.length > 45 ? trimmed.substring(0, 45).trim() + "..." : trimmed;
        const nowIso = new Date().toISOString();
        setChatSessions((prev) => {
          const existingIdx = prev.findIndex((s) => s.sessionId === activeSessionId);
          if (existingIdx !== -1) {
            const existing = prev[existingIdx];
            const updated: AIChatSessionSummary = {
              ...existing,
              updatedAt: nowIso,
            };
            const next = [...prev];
            next.splice(existingIdx, 1);
            return [updated, ...next];
          } else {
            const newSession: AIChatSessionSummary = {
              sessionId: activeSessionId,
              title: sessionTitle,
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            return [newSession, ...prev];
          }
        });
      }

      abortControllerRef.current = new AbortController();

      let pendingChunk = "";
      let chunkRaf = 0;
      const flushChunks = () => {
        chunkRaf = 0;
        if (!pendingChunk) return;
        const text = pendingChunk;
        pendingChunk = "";
        setCurrentStatus(null);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + text }
              : msg
          )
        );
      };

      await sendStreamChatMessage({
        message: trimmed,
        sessionId: activeSessionId,
        history: historyPayload,
        signal: abortControllerRef.current.signal,
        onStatus: (status) => {
          setCurrentStatus(status);
        },
        onTextChunk: (chunk) => {
          // Gộp token theo frame — tránh setState mỗi chunk làm giật list
          pendingChunk += chunk;
          if (!chunkRaf) chunkRaf = requestAnimationFrame(flushChunks);
        },
        onProducts: (products: AIProductItem[]) => {
          flushChunks();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, products } : msg
            )
          );
        },
        onEnd: () => {
          if (chunkRaf) cancelAnimationFrame(chunkRaf);
          flushChunks();
          setIsStreaming(false);
          setCurrentStatus(null);
          // Reload sessions to update sidebar ordering and timestamps
          loadSessions(true);
        },
        onError: (err) => {
          if (chunkRaf) cancelAnimationFrame(chunkRaf);
          flushChunks();
          setIsStreaming(false);
          setCurrentStatus(null);
          const errMsg = err.message || "Lỗi kết nối đến trợ lý AI";
          setError(errMsg);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content:
                      "Xin lỗi bạn, đã xảy ra sự cố trong quá trình xử lý phản hồi. Bạn vui lòng nhấn thử lại nhé!",
                    isError: true,
                  }
                : msg
            )
          );
        }
      });
    },
    [isStreaming, sessionId, sessionUserId, loadSessions]
  );

  const retryLastMessage = useCallback(() => {
    const lastUserMsg = [...messagesRef.current]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMsg && lastUserMsg.content) {
      sendMessage(lastUserMsg.content);
    }
  }, [sendMessage]);

  const switchChat = useCallback(
    (newSessionId: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      clearPolling();
      setSessionIdLocal(sessionUserId, newSessionId);
      setSessionId(newSessionId);
      loadHistoryWithPendingCheck(newSessionId);
      setIsStreaming(false);
      setCurrentStatus(null);
      setError(null);
    },
    [sessionUserId, clearPolling, loadHistoryWithPendingCheck]
  );

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearPolling();
    clearSessionId(sessionUserId);
    setSessionId("");
    setMessages([]);
    setIsStreaming(false);
    setCurrentStatus(null);
    setError(null);
  }, [sessionUserId, clearPolling]);

  const deleteSession = useCallback(
    async (sessionIdToDelete: string) => {
      const ok = await deleteChatSession(sessionIdToDelete);
      if (!ok) return false;

      let nextSessionToSwitch: string | null = null;
      let shouldClear = false;

      setChatSessions((prev) => {
        const remaining = prev.filter((s) => s.sessionId !== sessionIdToDelete);
        if (sessionId === sessionIdToDelete) {
          if (remaining.length > 0) {
            nextSessionToSwitch = remaining[0].sessionId;
          } else {
            shouldClear = true;
          }
        }
        return remaining;
      });

      if (sessionId === sessionIdToDelete) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        if (nextSessionToSwitch) {
          switchChat(nextSessionToSwitch);
        } else if (shouldClear) {
          clearChat();
        }
      }
      return true;
    },
    [sessionId, switchChat, clearChat]
  );

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
    switchChat,
    deleteSession,
    loadSessions,
    retryLastMessage
  };
}


