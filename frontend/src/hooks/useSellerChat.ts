import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiFetch } from "@/services/api";
import {
  useOptionalSellerChatRealtimeApi,
  useOptionalSellerChatRealtimeState,
} from "@/contexts/SellerChatRealtimeProvider";
import { EMPTY_CHAT_MESSAGES } from "@/lib/chat-messages";

export type SellerMessage = {
  id: number;
  conversation_id: string;
  sender_type: "CUSTOMER" | "SELLER" | "SYSTEM";
  content: string;
  attachment_type?: "PRODUCT" | "ORDER" | "IMAGE" | "VIDEO" | null;
  attachment_id?: string | null;
  reply_to_id?: number | null;
  status: "SENT" | "DELIVERED" | "READ";
  created_at: string;
};

export type SellerConversation = {
  id: string;
  customer_id: number | null;
  shop_id: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type UseSellerChatOptions = {
  deferCreate?: boolean;
  onConversationCreated?: (conversation: SellerConversation) => void;
};

/**
 * Conversation adapter over the shared seller-chat multiplex websocket.
 * Does not open its own socket — requires SellerChatRealtimeProvider ancestor.
 */
export function useSellerChat(
  shopId?: number | null,
  conversationId?: string | null,
  senderType: "CUSTOMER" | "SELLER" = "CUSTOMER",
  options: UseSellerChatOptions = {}
) {
  const { deferCreate = false, onConversationCreated } = options;
  const realtimeApi = useOptionalSellerChatRealtimeApi();
  const realtimeState = useOptionalSellerChatRealtimeState();

  const [conversation, setConversation] = useState<SellerConversation | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId || null
  );
  const creatingConversation = useRef<Promise<string | null> | null>(null);
  const senderTypeRef = useRef(senderType);
  senderTypeRef.current = senderType;

  useEffect(() => {
    setConversation(null);
    setActiveConversationId(conversationId || null);
  }, [shopId, conversationId]);

  useEffect(() => {
    if (!deferCreate || conversationId || !shopId) return;
    setActiveConversationId(null);
    setConversation(null);
  }, [deferCreate, conversationId, shopId]);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (activeConversationId) return activeConversationId;
    if (!shopId) return null;
    if (creatingConversation.current) return creatingConversation.current;

    creatingConversation.current = (async () => {
      try {
        const data = await apiFetch<SellerConversation>(
          `/api/seller-chat/conversations?shop_id=${shopId}`,
          { method: "POST" }
        );
        if (data) {
          setConversation(data);
          setActiveConversationId(data.id);
          onConversationCreated?.(data);
          return data.id;
        }
        return null;
      } catch (error) {
        console.error("Failed to create seller conversation", error);
        return null;
      } finally {
        creatingConversation.current = null;
      }
    })();

    return creatingConversation.current;
  }, [activeConversationId, shopId, onConversationCreated]);

  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
      return;
    }

    if (!shopId || deferCreate) return;
    if (activeConversationId) return;

    const initConversation = async () => {
      try {
        const data = await apiFetch<SellerConversation>(
          `/api/seller-chat/conversations?shop_id=${shopId}`,
          { method: "POST" }
        );
        if (data) {
          setConversation(data);
          setActiveConversationId(data.id);
        }
      } catch (error) {
        console.error("Failed to initialize seller conversation", error);
      }
    };

    initConversation();
  }, [shopId, conversationId, deferCreate, activeConversationId]);

  useEffect(() => {
    if (!realtimeApi) return;

    if (!activeConversationId) {
      realtimeApi.unsubscribeConversation();
      return;
    }

    realtimeApi.subscribeConversation(activeConversationId, senderTypeRef.current);

    return () => {
      realtimeApi.unsubscribeConversation(activeConversationId);
    };
  }, [realtimeApi, activeConversationId, senderType]);

  const messagesByConversation = realtimeState?.messagesByConversation;
  const messages = useMemo<SellerMessage[]>(() => {
    if (!activeConversationId || !messagesByConversation) return EMPTY_CHAT_MESSAGES;
    return messagesByConversation[activeConversationId] ?? EMPTY_CHAT_MESSAGES;
  }, [activeConversationId, messagesByConversation]);

  const isConnected = Boolean(
    realtimeState?.isRealtimeConnected &&
      activeConversationId &&
      realtimeState.subscribedConversationId === activeConversationId
  );

  const sendMessage = useCallback(
    async (
      content: string,
      attachmentType?: string,
      attachmentId?: string,
      replyToId?: number
    ) => {
      if (!realtimeApi) return;
      if (!content.trim() && !attachmentType) return;

      const convId =
        activeConversationId || conversationId || (await ensureConversation());
      if (!convId) return;

      if (convId !== activeConversationId) {
        setActiveConversationId(convId);
        realtimeApi.subscribeConversation(convId, senderTypeRef.current);
      }

      realtimeApi.sendConversationMessage(convId, {
        content: content || " ",
        sender_type: senderTypeRef.current,
        attachment_type: attachmentType,
        attachment_id: attachmentId,
        reply_to_id: replyToId,
      });
    },
    [activeConversationId, conversationId, ensureConversation, realtimeApi]
  );

  const markAsRead = useCallback(() => {
    if (!realtimeApi || !activeConversationId) return;
    realtimeApi.markConversationRead(activeConversationId, senderTypeRef.current);
  }, [activeConversationId, realtimeApi]);

  const markAsDelivered = useCallback(() => {
    if (!realtimeApi || !activeConversationId) return;
    realtimeApi.markConversationDelivered(activeConversationId, senderTypeRef.current);
  }, [activeConversationId, realtimeApi]);

  return {
    messages,
    conversation,
    isConnected,
    sendMessage,
    markAsRead,
    markAsDelivered,
    activeConversationId,
    ensureConversation,
  };
}
