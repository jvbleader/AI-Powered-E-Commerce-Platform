"use client";

import React, { useEffect, useState, useRef } from "react";
import { Bell, Check, Info, Package, AlertCircle, Headset, Store } from "lucide-react";
import { getApiBaseUrl, apiFetch } from "@/services/api";
import { formatDate } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

export function NotificationBell({ isScrolled }: { isScrolled?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const store = useMarketplaceStore();
  const user = store.getCurrentUser();

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    let eventSource: EventSource | null = null;
    let isMounted = true;

    async function initNotifications() {
      try {
        const data = await apiFetch<{ unread_count?: number, count?: number }>('/notifications/unread-count');
        const initialCount = data?.unread_count ?? data?.count ?? 0;
        if (isMounted) setUnreadCount(initialCount);

        const baseUrl = getApiBaseUrl();
        eventSource = new EventSource(`${baseUrl}/notifications/stream`, {
          withCredentials: true,
        });

        eventSource.onmessage = (event) => {
          if (isMounted) {
            setUnreadCount((prev) => prev + 1);
            try {
              const newNotif = JSON.parse(event.data);
              setNotifications((prev) => [newNotif, ...prev]);
              if (newNotif.action_url?.startsWith('/support') || newNotif.action_url?.includes('tab=SUPPORTER') || (newNotif.action_url?.startsWith('/chat') && !newNotif.action_url?.includes('tab=SELLER') && !newNotif.action_url?.includes('seller'))) {
                window.dispatchEvent(new CustomEvent('chat-unread-increment'));
              } else if (newNotif.action_url?.includes('tab=SELLER') || newNotif.type === 'seller_chat') {
                // Badge Chat seller dựa trên tin chưa đọc — refresh thay vì +1 mù
                window.dispatchEvent(new CustomEvent('chat-unread-refresh'));
              }
            } catch (e) {}
          }
        };

        eventSource.onerror = (error) => {
          eventSource?.close();
        };

      } catch (error: any) {
        if (error?.status === 401 || error?.message?.includes("đăng nhập")) {
          return; // Ignore auth errors for guests
        }
        console.error("Failed to init NotificationBell:", error);
      }
    }

    initNotifications();

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleRead = (e: CustomEvent) => {
      const { id } = e.detail;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    };
    const handleReadAll = () => {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    };
    const handleRefresh = async () => {
      try {
        const data = await apiFetch<{ unread_count?: number, count?: number }>('/notifications/unread-count');
        const count = data?.unread_count ?? data?.count ?? 0;
        setUnreadCount(count);
        // Force refresh notifications if open
        if (isOpen) {
          const notifs = await apiFetch<NotificationItem[]>('/notifications');
          setNotifications(notifs || []);
        }
      } catch (e) {}
    };

    window.addEventListener('notification-read', handleRead as EventListener);
    window.addEventListener('notification-read-all', handleReadAll);
    window.addEventListener('chat-unread-refresh', handleRefresh);
    window.addEventListener('notifications-refresh', handleRefresh);

    return () => {
      window.removeEventListener('notification-read', handleRead as EventListener);
      window.removeEventListener('notification-read-all', handleReadAll);
      window.removeEventListener('chat-unread-refresh', handleRefresh);
      window.removeEventListener('notifications-refresh', handleRefresh);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await apiFetch<NotificationItem[]>('/notifications');
      setNotifications(data || []);
    } catch (error: any) {
      if (error?.status === 401 || error?.message?.includes("đăng nhập")) {
        return;
      }
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
      const notif = notifications.find(n => n.id === id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent('notification-read', { detail: { id } }));
      if (notif?.action_url?.startsWith('/support') || notif?.action_url?.includes('tab=SUPPORTER') || (notif?.action_url?.startsWith('/chat') && !notif?.action_url?.includes('tab=SELLER'))) {
        window.dispatchEvent(new CustomEvent('chat-unread-decrement'));
      } else if (notif?.action_url?.includes('tab=SELLER') || notif?.type === 'seller_chat') {
        window.dispatchEvent(new CustomEvent('chat-unread-refresh'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch(`/notifications/read-all`, { method: "PUT" });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('notification-read-all'));
      window.dispatchEvent(new CustomEvent('chat-unread-clear'));
    } catch (e) {
      console.error(e);
    }
  };

  const getIcon = (notif: NotificationItem) => {
    const type = notif.action_url?.startsWith('/support')
      ? 'support'
      : notif.action_url?.startsWith('/chat')
      ? (notif.action_url.includes('tab=SELLER') || notif.type === 'seller_chat' ? 'seller_chat' : 'support')
      : notif.action_url?.startsWith('/seller/chat')
        ? 'seller_chat'
        : notif.type?.toLowerCase();
    switch (type) {
      case "order": return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Package className="h-5 w-5" />
        </div>
      );
      case "system": return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-coral/10 text-coral">
          <AlertCircle className="h-5 w-5" />
        </div>
      );
      case "support": return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky/10 text-sky">
          <Headset className="h-5 w-5" />
        </div>
      );
      case "seller_chat": return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Store className="h-5 w-5" />
        </div>
      );
      default: return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas border border-line text-muted">
          <Info className="h-5 w-5" />
        </div>
      );
    }
  };

  return (
    <div 
      className="relative" 
      ref={dropdownRef}
      onMouseEnter={() => {
        setIsOpen(true);
        if (notifications.length === 0) fetchNotifications();
      }}
      onMouseLeave={() => setIsOpen(false)}
    >
      <a
        href="/account/notifications"
        className={`relative inline-flex items-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
          isScrolled ? "px-2.5 py-1.5" : "px-3 py-2"
        } ${
          isOpen
            ? "bg-emerald-50 text-emerald-700"
            : "text-slate-700 hover:bg-slate-200/50 hover:text-emerald-700"
        }`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        <span>Thông báo</span>
        {unreadCount > 0 && (
          <span className="animate-bounce-subtle rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </a>

      {isOpen && (
        <div className="absolute right-0 top-11 z-50 w-80 animate-scale-in rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
            <span className="font-heading text-xs font-bold text-slate-900">Thông báo mới</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Đánh dấu đã đọc
                </button>
              )}
              <a href="/account/notifications" className="text-[10px] font-bold text-emerald-600 hover:underline">
                Xem tất cả
              </a>
            </div>
          </div>

          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Đang tải thông báo...</div>
            ) : notifications.length > 0 ? (
              notifications.map((notif) => (
                <a
                  key={notif.id}
                  href={notif.action_url || "#"}
                  onClick={(e) => {
                    if (!notif.is_read) markAsRead(notif.id, e);
                  }}
                  className={`flex gap-2.5 text-xs hover:bg-slate-50 p-1.5 rounded-xl transition-colors ${
                    !notif.is_read ? 'bg-emerald-50/60' : ''
                  }`}
                >
                  {getIcon(notif)}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className={`font-bold text-slate-900 truncate ${!notif.is_read ? 'text-emerald-700' : ''}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-500 mt-0.5"></span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                      {notif.content}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {formatDate(notif.created_at)}
                    </p>
                  </div>
                </a>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                <Bell className="mx-auto h-8 w-8 text-slate-200 mb-2" />
                Không có thông báo nào
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
