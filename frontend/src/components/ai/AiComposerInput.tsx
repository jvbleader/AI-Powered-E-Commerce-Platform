"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";

type AiComposerInputProps = {
  isStreaming: boolean;
  onSend: (text: string) => void;
};

/** State local — gõ không re-render vùng tin nhắn. */
export function AiComposerInput({ isStreaming, onSend }: AiComposerInputProps) {
  const [value, setValue] = useState("");
  const canSend = Boolean(value.trim()) && !isStreaming;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="p-3 border-t border-slate-200 bg-slate-50"
    >
      <div className="flex items-end gap-2 bg-white rounded-xl border border-slate-200 p-1 pl-3 shadow-sm focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
        <TextareaAutosize
          minRows={1}
          maxRows={5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Hỏi AI..."
          className="flex-1 min-h-[40px] py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent resize-none focus:outline-none no-scrollbar"
        />
        <button
          type="submit"
          disabled={!canSend}
          className={cn(
            "m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all",
            !canSend
              ? "text-slate-300 pointer-events-none"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          )}
        >
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}
