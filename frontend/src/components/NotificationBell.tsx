"use client";

import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getApiBaseUrl, apiFetch } from "@/services/api";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;

    async function initNotifications() {
      try {
        // Fetch initial unread count
        const data = await apiFetch<{ unread_count?: number, count?: number }>('/notifications/unread-count');
        const initialCount = data?.unread_count ?? data?.count ?? 0;
        if (isMounted) {
          setUnreadCount(initialCount);
        }

        // Connect to EventSource for SSE stream
        const baseUrl = getApiBaseUrl();
        // Since we rely on cookies/withCredentials, we might not need token in URL, 
        // but if the backend expects a token or uses cookies, withCredentials: true will send cookies.
        eventSource = new EventSource(`${baseUrl}/notifications/stream`, {
          withCredentials: true,
        });

        eventSource.onmessage = (event) => {
          if (isMounted) {
            setUnreadCount((prev) => prev + 1);
          }
        };

        eventSource.onerror = (error) => {
          console.error("EventSource error in NotificationBell:", error);
          eventSource?.close();
        };

      } catch (error) {
        console.error("Failed to init NotificationBell:", error);
      }
    }

    initNotifications();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        className="relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/50 hover:text-emerald-700 transition-all duration-300 active:scale-95"
        aria-label="Thông báo"
      >
        <div className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-455 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          )}
        </div>
        <span>Thông báo {unreadCount > 0 && `(${unreadCount > 99 ? '99+' : unreadCount})`}</span>
      </button>
    </div>
  );
}
