"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/services/api";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("shepoo_session_id");
  if (!sid) {
    sid =
      "sess_" +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36);
    sessionStorage.setItem("shepoo_session_id", sid);
  }
  return sid;
}

export function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    const queryString = searchParams?.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

    if (lastTrackedPath.current === fullPath) return;
    lastTrackedPath.current = fullPath;

    const baseUrl = getApiBaseUrl();
    const sessionId = getOrCreateSessionId();
    const referrer = typeof document !== "undefined" ? document.referrer : "";

    fetch(`${baseUrl}/analytics/pageview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        session_id: sessionId,
        path: fullPath,
        referrer: referrer,
      }),
    }).catch(() => {
      // Background analytics fail silently without disturbing UI
    });
  }, [pathname, searchParams]);

  return null;
}
