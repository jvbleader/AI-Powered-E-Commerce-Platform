"use client";

import React, { memo } from "react";
import { FileText, ShieldCheck, ChevronRight } from "lucide-react";
import { AICitationItem } from "@/services/aiChatService";
import { cn } from "@/lib/utils";

export interface PolicyCitationBadgeProps {
  citations: AICitationItem[];
  onSelectCitation?: (citation: AICitationItem) => void;
  className?: string;
}

function PolicyCitationBadgeInner({
  citations,
  onSelectCitation,
  className,
}: PolicyCitationBadgeProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1.5 pt-1.5 max-w-full overflow-hidden", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Tài liệu trích dẫn</span>
      </div>
      <div className="flex flex-col gap-1.5 w-full max-w-full">
        {citations.map((cit, idx) => {
          const pageStr = cit.page_number ? `Trang ${cit.page_number}` : (cit.section_title || "");
          const label = pageStr ? `${cit.title} • ${pageStr}` : cit.title;

          return (
            <button
              key={`${cit.article_id || cit.slug || idx}-${cit.section_title || idx}-${cit.page_number || idx}`}
              type="button"
              onClick={() => onSelectCitation?.(cit)}
              title={cit.excerpt || label}
              className="flex items-center gap-2 w-full max-w-full px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-50/90 text-rose-900 border border-rose-200/90 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-950 transition-all text-left group cursor-pointer shadow-2xs active:scale-[0.99] overflow-hidden"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="truncate min-w-0 flex-1 font-medium">{label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-700 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const PolicyCitationBadge = memo(PolicyCitationBadgeInner);
