import React, { useState, useCallback } from 'react';
import { apiFetch } from "@/services/api";

export type SellerSessionSummary = {
  id: string;
  status: string;
  customer_id: number | null;
  shop_id: number | null;
  created_at: string;
  updated_at: string;
  shop_name: string | null;
  shop_avatar: string | null;
  customer_name: string | null;
  customer_avatar: string | null;
  last_message: string | null;
  has_unread?: boolean;
};

export function useSellerChatSessions(asSeller: boolean = false) {
  const [sessions, setSessions] = useState<SellerSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isInitialLoad = React.useRef(true);

  const loadSessions = useCallback(async (silent = false) => {
    if (!silent && isInitialLoad.current) setIsLoading(true);
    try {
      const data = await apiFetch<SellerSessionSummary[]>(`/api/seller-chat/conversations/my?as_seller=${asSeller}`);
      if (data) {
        setSessions(data);
        isInitialLoad.current = false;
      }
    } catch (error) {
      console.error("Failed to load seller chat sessions", error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [asSeller]);

  return {
    sessions,
    isLoading,
    loadSessions
  };
}
