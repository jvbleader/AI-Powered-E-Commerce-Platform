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
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [chatSessions, setChatSessions] = useState<AIChatSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<AIChatMessage[]>(messages);
  messagesRef.current = messages;

  const loadSessions = useCallback(async () => {
    if (!sessionUserId) {
      setChatSessions([]);
      setIsLoadingSessions(false);
      return;
    }
    setIsLoadingSessions(true);
    const sessions = await fetchChatSessions();
    setChatSessions(sessions);
    setIsLoadingSessions(false);
  }, [sessionUserId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Initialize session & load history based on logged-in state
  useEffect(() => {
    const id = getOrCreateSessionId(sessionUserId);
    setSessionId(id);

    if (sessionUserId) {
      setIsLoadingHistory(true);
      fetchChatHistory(id)
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
      // Guest mode: do not load history from DB, start empty
      setMessages([]);
      setIsLoadingHistory(false);
    }
  }, [sessionUserId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || !sessionId) return;

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

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      abortControllerRef.current = new AbortController();

      await sendStreamChatMessage({
        message: trimmed,
        sessionId,
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
          loadSessions();
        },
        onError: (err) => {
          setIsStreaming(false);
          setCurrentStatus(null);
          setError(err.message || "Lỗi kết nối đến trợ lý AI");
        }
      });
    },
    [isStreaming, sessionId]
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
    const newId = getOrCreateSessionId(sessionUserId);
    setSessionId(newId);
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

