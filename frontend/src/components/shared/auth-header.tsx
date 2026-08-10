"use client";

import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";

export function AuthHeader() {
  const pathname = usePathname() || "/";
  
  let pageTitle = "";
  if (pathname.includes("/login")) pageTitle = "Đăng nhập";
  else if (pathname.includes("/register")) pageTitle = "Đăng ký";
  else if (pathname.includes("/forgot-password") || pathname.includes("/reset-password")) pageTitle = "Lấy lại mật khẩu";
  else if (pathname.includes("/verify-email") || pathname.includes("/verify-phone")) pageTitle = "Xác minh";
  
  return (
    <header className="w-full bg-white border-b border-slate-200">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 h-[84px] flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* LOGO */}
          <a
            href="/"
            className="group flex shrink-0 items-center gap-2 sm:gap-2.5"
            aria-label={`${BRAND_NAME} Trang chủ`}
          >
            <div className="relative">
              <span className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-emerald-600 font-heading text-xl sm:text-2xl font-black text-white shadow-sm transition-all duration-500 group-hover:scale-105">
                S
              </span>
            </div>
            <div className="hidden sm:flex flex-col items-center justify-center">
              <span className="font-heading text-2xl font-black tracking-tight text-emerald-600 leading-none transition-all duration-500 sm:text-3xl">
                {BRAND_NAME}
              </span>
            </div>
          </a>
          
          {pageTitle && (
            <div className="text-xl sm:text-2xl font-medium text-slate-800 ml-2">
              {pageTitle}
            </div>
          )}
        </div>

        <a href="/support" className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
          <HelpCircle className="h-4 w-4" />
          Bạn cần giúp đỡ?
        </a>
      </div>
    </header>
  );
}
