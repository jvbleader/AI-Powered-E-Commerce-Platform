"use client";

import React from "react";
import { FileText, Plus, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMediaDraftItem } from "@/hooks/useChatMediaDraft";

export function ChatMediaDraftPreview({
  items,
  canAddMore,
  maxFiles,
  onRemove,
  onClear,
  onAdd,
  showDivider = true,
}: {
  items: ChatMediaDraftItem[];
  canAddMore: boolean;
  maxFiles: number;
  onRemove: (id: string) => void;
  onClear: () => void;
  onAdd: () => void;
  showDivider?: boolean;
}) {
  if (!items.length) return null;

  return (
    <div className={cn("px-3 pt-2 pb-1", showDivider && "border-b border-slate-100")}>
      <div className="flex items-start gap-2">
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {items.map((item) => (
            <div key={item.id} className="relative group shrink-0">
              <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                {item.type === "IMAGE" ? (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : item.type === "VIDEO" ? (
                  <div className="relative w-full h-full">
                    <video
                      src={item.previewUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center">
                    <FileText className="w-5 h-5 text-slate-500" />
                    <span className="text-[8px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                      {item.file.name}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                aria-label="Xóa file"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {canAddMore && (
            <button
              type="button"
              onClick={onAdd}
              className="w-14 h-14 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-emerald-400 transition-colors flex items-center justify-center shrink-0"
              aria-label="Thêm ảnh hoặc video"
              title={`Thêm file (${items.length}/${maxFiles})`}
            >
              <Plus className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClear}
          className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
          aria-label="Xóa tất cả"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ChatMediaHiddenInputs({
  imageInputRef,
  videoInputRef,
  fileInputRef,
  addInputRef,
  onImageChange,
  onVideoChange,
  onFileChange,
  onAddChange,
  disabled,
  fileAccept = "image/*,video/*",
}: {
  imageInputRef: React.RefObject<HTMLInputElement>;
  videoInputRef: React.RefObject<HTMLInputElement>;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  addInputRef: React.RefObject<HTMLInputElement>;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFileChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAddChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  fileAccept?: string;
}) {
  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onImageChange}
        disabled={disabled}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={onVideoChange}
        disabled={disabled}
      />
      {fileInputRef && onFileChange && (
        <input
          ref={fileInputRef}
          type="file"
          accept={fileAccept.includes("application/pdf") ? fileAccept : "application/pdf,.pdf,.docx,.txt,text/plain"}
          multiple
          className="hidden"
          onChange={onFileChange}
          disabled={disabled}
        />
      )}
      <input
        ref={addInputRef}
        type="file"
        accept={fileAccept}
        multiple
        className="hidden"
        onChange={onAddChange}
        disabled={disabled}
      />
    </>
  );
}

export function ChatMediaUploadStatus({
  uploading,
  uploadProgress,
  className,
  showDivider = true,
}: {
  uploading: boolean;
  uploadProgress: { current: number; total: number } | null;
  className?: string;
  showDivider?: boolean;
}) {
  if (!uploading || !uploadProgress) return null;

  return (
    <div className={cn("px-3 py-1.5 text-xs text-slate-500 bg-slate-50", showDivider && "border-b border-slate-100", className)}>
      Đang tải lên {uploadProgress.current}/{uploadProgress.total}...
    </div>
  );
}
