"use client";

import { type ReactNode } from "react";
import { SupportChatRealtimeProvider } from "@/contexts/SupportChatRealtimeProvider";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

type SupporterSupportInboxProviderProps = {
  children: ReactNode;
};

export function SupporterSupportInboxProvider({
  children,
}: SupporterSupportInboxProviderProps) {
  const ready = useMarketplaceStore((s) => s.ready);
  const sessionUserId = useMarketplaceStore((s) => s.state.sessionUserId);
  const roles = useMarketplaceStore((s) => {
    const user = s.state.users.find((u) => u.id === s.state.sessionUserId);
    return user?.roles ?? [];
  });
  const enabled = ready && !!sessionUserId && roles.includes("SUPPORTER");

  return (
    <SupportChatRealtimeProvider
      mode="supporter"
      enabled={enabled}
      supporterPublicId={sessionUserId}
    >
      {children}
    </SupportChatRealtimeProvider>
  );
}
