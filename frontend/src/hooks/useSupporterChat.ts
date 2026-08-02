import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, getApiBaseUrl } from "@/services/api";

export type Message = {
  id: number;
  conversation_id: string;
  sender_type: 'CUSTOMER' | 'SUPPORTER' | 'SYSTEM';
  content: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  status: string;
  supporter_id: number | null;
  supporter: { id: number; public_id: string; full_name: string; avatar_url: string | null } | null;
  customer_id?: number | null;
  customer?: { id: number; public_id: string; full_name: string; avatar_url: string | null } | null;
  guest_id?: string | null;
  created_at: string;
};

export function useSupporterChat(conversationId: string | null, senderType: 'CUSTOMER' | 'SUPPORTER') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  // Load conversation details and old messages
  useEffect(() => {
    if (!conversationId) return;

    const fetchDetails = async () => {
      try {
        const convData = await apiFetch<Conversation>(`/api/support-chat/conversations/${conversationId}`);
        if (convData) {
          setConversation(convData);
        }
      } catch (error) {
        console.error("Failed to fetch conversation details:", error);
      }
    };

    const fetchMessages = async () => {
      try {
        const data = await apiFetch<Message[]>(`/api/support-chat/conversations/${conversationId}/messages`);
        if (data) {
          setMessages(data);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };
    
    fetchDetails();
    fetchMessages();
  }, [conversationId]);

  // Connect WebSocket
  useEffect(() => {
    if (!conversationId) return;

    let wsUrl = getApiBaseUrl().replace(/^http/, 'ws');
    
    const socket = new WebSocket(`${wsUrl}/api/support-chat/ws/${conversationId}`);
    
    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // If it's a SYSTEM message, it might mean the supporter joined or left.
        // We can refetch conversation details to get the new supporter_id
        if (message.sender_type === 'SYSTEM') {
          apiFetch<Conversation>(`/api/support-chat/conversations/${conversationId}`).then(convData => {
            if (convData) setConversation(convData);
          });
        }
        
        setMessages(prev => {
          // Prevent duplicates
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
  }, [conversationId]);

  const sendMessage = useCallback((content: string) => {
    if (ws.current && isConnected && content.trim()) {
      ws.current.send(JSON.stringify({
        content,
        sender_type: senderType
      }));
    }
  }, [isConnected, senderType]);

  const refetchConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const convData = await apiFetch<Conversation>(`/api/support-chat/conversations/${conversationId}`);
      if (convData) {
        setConversation(convData);
      }
    } catch (error) {
      console.error("Failed to fetch conversation details:", error);
    }
  }, [conversationId]);

  return { messages, conversation, isConnected, sendMessage, refetchConversation };
}
