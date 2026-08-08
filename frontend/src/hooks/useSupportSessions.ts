import { useMemo } from "react";
import { useSupportChatInboxSlice } from "@/contexts/SupportChatRealtimeProvider";

export type { SupportSessionSummary } from "@/types/support-chat";

export function useSupportSessions() {
  const inbox = useSupportChatInboxSlice();

  return useMemo(
    () => ({
      supportSessions: inbox.sessions,
      isLoadingSupportSessions: inbox.isLoading,
      loadSupportSessions: inbox.loadSessions,
      updateSessionLocally: inbox.updateSessionLocally,
    }),
    [inbox]
  );
}
