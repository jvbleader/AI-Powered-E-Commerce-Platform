import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, getApiBaseUrl } from "@/services/api";

export type SellerMessage = {
  id: number;
  conversation_id: string;
  sender_type: 'CUSTOMER' | 'SELLER' | 'SYSTEM';
  content: string;
  attachment_type?: 'PRODUCT' | 'ORDER' | 'IMAGE' | 'VIDEO' | null;
  attachment_id?: string | null;
  reply_to_id?: number | null;
  status: 'SENT' | 'DELIVERED' | 'READ';
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

export function useSellerChat(shopId?: number | null, conversationId?: string | null, senderType: 'CUSTOMER' | 'SELLER' = 'CUSTOMER') {
  const [messages, setMessages] = useState<SellerMessage[]>([]);
  const [conversation, setConversation] = useState<SellerConversation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId || null);
  const ws = useRef<WebSocket | null>(null);

  // Initialize or fetch conversation based on shopId
  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
      return;
    }
    
    if (!shopId) return;

    const initConversation = async () => {
      try {
        const data = await apiFetch<SellerConversation>(`/api/seller-chat/conversations?shop_id=${shopId}`, {
          method: 'POST'
        });
        if (data) {
          setConversation(data);
          setActiveConversationId(data.id);
        }
      } catch (error) {
        console.error("Failed to initialize seller conversation", error);
      }
    };

    initConversation();
  }, [shopId, conversationId]);

  // Load messages
  useEffect(() => {
    if (!activeConversationId) return;
    
    const fetchMessages = async () => {
      try {
        const data = await apiFetch<SellerMessage[]>(`/api/seller-chat/conversations/${activeConversationId}/messages`);
        if (data) {
          setMessages(data);
        }
      } catch (error) {
        console.error("Failed to fetch seller messages:", error);
      }
    };
    
    fetchMessages();
  }, [activeConversationId]);

  // Connect WebSocket
  useEffect(() => {
    if (!activeConversationId) return;

    let wsUrl = getApiBaseUrl().replace(/^http/, 'ws');
    
    const socket = new WebSocket(`${wsUrl}/api/seller-chat/ws/${activeConversationId}`);
    
    socket.onopen = () => {
      setIsConnected(true);
      socket.send(JSON.stringify({ action: 'MARK_READ', sender_type: senderType }));
    };
    socket.onclose = () => setIsConnected(false);
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'STATUS_UPDATE') {
          setMessages(prev => prev.map(m => 
            message.message_ids.includes(m.id) ? { ...m, status: message.status } : m
          ));
          return;
        }

        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      } catch (e) {
        console.error("Invalid message format", e);
      }
    };

    ws.current = socket;

    return () => {
      socket.close();
      ws.current = null;
    };
  }, [activeConversationId]);

  const sendMessage = useCallback((content: string, attachmentType?: string, attachmentId?: string, replyToId?: number) => {
    if (ws.current && isConnected && (content.trim() || attachmentType)) {
      ws.current.send(JSON.stringify({
        content: content || ' ', // ensure content is not empty if there's an attachment
        sender_type: senderType,
        attachment_type: attachmentType,
        attachment_id: attachmentId,
        reply_to_id: replyToId
      }));
    }
  }, [isConnected, senderType]);

  const markAsRead = useCallback(() => {
    if (ws.current && isConnected) {
      ws.current.send(JSON.stringify({
        action: 'MARK_READ',
        sender_type: senderType
      }));
    }
  }, [isConnected, senderType]);

  const markAsDelivered = useCallback(() => {
    if (ws.current && isConnected) {
      ws.current.send(JSON.stringify({
        action: 'MARK_DELIVERED',
        sender_type: senderType
      }));
    }
  }, [isConnected, senderType]);

  return { messages, conversation, isConnected, sendMessage, markAsRead, markAsDelivered, activeConversationId };
}
