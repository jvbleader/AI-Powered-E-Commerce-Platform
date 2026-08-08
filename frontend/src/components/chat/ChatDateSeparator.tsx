"use client";

import { formatChatDateSeparator } from "@/lib/chat-message-layout";

export function ChatDateSeparator({ date }: { date?: string }) {
  const label = formatChatDateSeparator(date);
  if (!label) return null;

  return (
    <div className="flex justify-center my-3">
      <span className="text-[11px] text-slate-500 font-medium bg-slate-100/90 px-3 py-1 rounded-full shadow-sm">
        {label}
      </span>
    </div>
  );
}
