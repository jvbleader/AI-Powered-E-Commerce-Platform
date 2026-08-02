"use client";

import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";

export default function Unauthorized({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex w-full items-center justify-center bg-[#faf6f0] px-4 overflow-hidden">
      {/* Prominent Card Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-10 text-center animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Badge Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200/80 mb-4">
          <Lock className="h-3 w-3 text-rose-600" />
          <span>Giới hạn truy cập</span>
        </div>

        {/* Icon Badge */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80">
          <ShieldAlert className="h-8 w-8 text-rose-600" />
        </div>

        {/* Main Title & Description */}
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight font-heading">
          {title}
        </h2>
        <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600 max-w-sm mx-auto font-medium">
          {description}
        </p>

        {/* Subtle Back to Home link */}
        <div className="mt-8 border-t border-slate-100 pt-5">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay về trang chủ</span>
          </a>
        </div>
      </div>
    </div>
  );
}
