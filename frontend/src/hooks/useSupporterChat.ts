import { useCallback, useEffect, useMemo } from "react";
import {
  useOptionalSupportChatRealtimeApi,
  useOptionalSupportChatRealtimeState,
} from "@/contexts/SupportChatRealtimeProvider";
import { EMPTY_CHAT_MESSAGES } from "@/lib/chat-messages";
import { apiFetch } from "@/services/api";
import type {
  SupportAttachment,
  SupportConversation,
  SupportMessage,
} from "@/types/support-chat";

export type { SupportAttachment, SupportMessage as Message, SupportConversation as Conversation } from "@/types/support-chat";

function resolveGuestIdForSend(propGuestId?: string | null): string | null {
  if (propGuestId) return propGuestId;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("guest_id");
}

function buildSendMessagesQuery(guestId?: string | null) {
  const effectiveGuestId = resolveGuestIdForSend(guestId);
  return effectiveGuestId ? `?guest_id=${encodeURIComponent(effectiveGuestId)}` : "";
}

/**
 * Conversation adapter over the shared support-chat multiplex websocket.
 * Does not open its own socket — requires SupportChatRealtimeProvider ancestor.
 */
export function useSupporterChat(
  conversationId: string | null,
  _senderType: "CUSTOMER" | "SUPPORTER",
  guestId?: string | null
) {
  const realtimeApi = useOptionalSupportChatRealtimeApi();
  const realtimeState = useOptionalSupportChatRealtimeState();

  useEffect(() => {
    if (!realtimeApi) return;

    if (!conversationId) {
      realtimeApi.unsubscribeConversation();
      return;
    }

    realtimeApi.subscribeConversation(conversationId);
    void realtimeApi.refetchConversationDetails(conversationId);

    return () => {
      realtimeApi.unsubscribeConversation(conversationId);
    };
  }, [realtimeApi, conversationId]);

  const messagesByConversation = realtimeState?.messagesByConversation;
  const messages = useMemo<SupportMessage[]>(() => {
    if (!conversationId || !messagesByConversation) return EMPTY_CHAT_MESSAGES;
    return messagesByConversation[conversationId] ?? EMPTY_CHAT_MESSAGES;
  }, [conversationId, messagesByConversation]);

  const conversation = useMemo<SupportConversation | null>(() => {
    if (!conversationId || !realtimeState?.conversationsById) return null;
    return realtimeState.conversationsById[conversationId] ?? null;
  }, [conversationId, realtimeState?.conversationsById]);

  const isConnected = Boolean(
    realtimeState?.isRealtimeConnected &&
      conversationId &&
      realtimeState.subscribedConversationId === conversationId
  );

  const sendMessage = useCallback(
    async (
      content: string,
      attachmentType?: string,
      attachmentId?: string,
      attachments?: SupportAttachment[],
      targetConversationId?: string | null
    ) => {
      const convId = targetConversationId ?? conversationId;
      if (!realtimeApi || !convId) return;

      const trimmed = content.trim();
      const hasSingle = Boolean(attachmentType && attachmentId);
      const hasMulti = Boolean(attachments?.length);
      if (!trimmed && !hasSingle && !hasMulti) return;

      realtimeApi.subscribeConversation(convId);

      const payload = {
        content: trimmed || content,
        attachment_type: attachmentType,
        attachment_id: attachmentId,
        attachments,
      };

      try {
        const message = await apiFetch<SupportMessage>(
          `/api/support-chat/conversations/${convId}/messages${buildSendMessagesQuery(guestId)}`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
        if (message) {
          realtimeApi.receiveConversationMessage(message);
        }
      } catch (error) {
        console.error("Support chat HTTP send failed, falling back to websocket", error);
        realtimeApi.sendConversationMessage(convId, payload);
      }
    },
    [conversationId, guestId, realtimeApi]
  );

  const prepareConversation = useCallback(
    (targetConversationId: string) => {
      if (!realtimeApi) return;
      realtimeApi.subscribeConversation(targetConversationId);
    },
    [realtimeApi]
  );

  const refetchConversation = useCallback(async () => {
    if (!realtimeApi || !conversationId) return;
    await realtimeApi.refetchConversationDetails(conversationId);
  }, [conversationId, realtimeApi]);

  return { messages, conversation, isConnected, sendMessage, prepareConversation, refetchConversation };
}
