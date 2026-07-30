import { useState, useCallback } from 'react';
import { apiFetch } from "@/services/api";

export type SupportSessionSummary = {
  id: string;
  status: string;
  customer_id: number | null;
  guest_id: string | null;
  supporter_id: number | null;
  created_at: string;
  updated_at: string;
  supporter: {
    id: number;
    public_id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  last_message: string | null;
};

export function useSupportSessions() {
  const [supportSessions, setSupportSessions] = useState<SupportSessionSummary[]>([]);
  const [isLoadingSupportSessions, setIsLoadingSupportSessions] = useState(false);

  const loadSupportSessions = useCallback(async () => {
    setIsLoadingSupportSessions(true);
    try {
      let guestId = localStorage.getItem("guest_id");
      if (!guestId) {
        guestId = "guest_" + Math.random().toString(36).substring(2, 11);
        localStorage.setItem("guest_id", guestId);
      }
      const data = await apiFetch<SupportSessionSummary[]>(`/api/support-chat/conversations/my?guest_id=${guestId}`);
      if (data) {
        setSupportSessions(data);
      }
    } catch (error) {
      console.error("Failed to load support sessions", error);
    } finally {
      setIsLoadingSupportSessions(false);
    }
  }, []);

  return {
    supportSessions,
    isLoadingSupportSessions,
    loadSupportSessions
  };
}
