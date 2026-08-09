"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  Send,
  ShoppingBag,
  Video,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";
import {
  ChatMediaDraftPreview,
  ChatMediaHiddenInputs,
  ChatMediaUploadStatus,
} from "./ChatMediaDraftPreview";
import type { ChatMediaDraftItem } from "@/hooks/useChatMediaDraft";

type SellerComposerInputProps = {
  shopId: number;
  initialValue?: string;
  onDraftChange: (shopId: number, value: string) => void;
  /** `false` = giữ nguyên nội dung ô nhập (ví dụ gửi media thất bại). */
  onSend: (text: string) => boolean | void | Promise<boolean | void>;
  mediaUploading: boolean;
  uploadProgress: { current: number; total: number } | null;
  mediaDraftItems: ChatMediaDraftItem[];
  hasMediaDraft: boolean;
  canAddMoreMedia: boolean;
  maxMediaFiles: number;
  hasProductDraft: boolean;
  hasOrderDraft: boolean;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  addInputRef: React.RefObject<HTMLInputElement | null>;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveMedia: (id: string) => void;
  onClearMedia: () => void;
  onAddMedia: () => void;
  openImagePicker: () => void;
  openVideoPicker: () => void;
  onToggleProductPopup: () => void;
  onToggleOrderPopup: () => void;
};

/** State local — gõ không re-render list tin nhắn. */
export function SellerComposerInput({
  shopId,
  initialValue = "",
  onDraftChange,
  onSend,
  mediaUploading,
  uploadProgress,
  mediaDraftItems,
  hasMediaDraft,
  canAddMoreMedia,
  maxMediaFiles,
  hasProductDraft,
  hasOrderDraft,
  imageInputRef,
  videoInputRef,
  addInputRef,
  onImageChange,
  onVideoChange,
  onAddChange,
  onRemoveMedia,
  onClearMedia,
  onAddMedia,
  openImagePicker,
  openVideoPicker,
  onToggleProductPopup,
  onToggleOrderPopup,
}: SellerComposerInputProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [shopId, initialValue]);

  const canSend =
    !mediaUploading &&
    (Boolean(value.trim()) || hasProductDraft || hasOrderDraft || hasMediaDraft);

  const updateValue = (next: string) => {
    setValue(next);
    onDraftChange(shopId, next);
  };

  const submit = async () => {
    if (!canSend) return;
    const result = await onSend(value.trim());
    if (result === false) return;
    setValue("");
    onDraftChange(shopId, "");
  };

  return (
    <>
      <ChatMediaUploadStatus uploading={mediaUploading} uploadProgress={uploadProgress} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="p-3"
      >
        <div className="bg-white rounded-xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all overflow-hidden flex flex-col shadow-sm">
          <ChatMediaHiddenInputs
            imageInputRef={imageInputRef}
            videoInputRef={videoInputRef}
            addInputRef={addInputRef}
            onImageChange={onImageChange}
            onVideoChange={onVideoChange}
            onAddChange={onAddChange}
            disabled={mediaUploading}
          />
          <ChatMediaDraftPreview
            items={mediaDraftItems}
            canAddMore={canAddMoreMedia}
            maxFiles={maxMediaFiles}
            onRemove={onRemoveMedia}
            onClear={onClearMedia}
            onAdd={onAddMedia}
          />
          <TextareaAutosize
            minRows={1}
            maxRows={5}
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Nhập nội dung tin nhắn"
            className="w-full min-h-[40px] py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent resize-none focus:outline-none no-scrollbar"
          />
          <div className="flex items-center justify-between p-1.5 border-t border-slate-50 bg-slate-50/50">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={mediaUploading || !canAddMoreMedia}
                onClick={openImagePicker}
                className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors disabled:opacity-50"
              >
                {mediaUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                <span className="absolute bottom-full left-0 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                  Hình ảnh (tối đa {maxMediaFiles}, 2MB/ảnh)
                  <span className="absolute top-full left-3 border-[4px] border-transparent border-t-slate-800" />
                </span>
              </button>
              <button
                type="button"
                disabled={mediaUploading || !canAddMoreMedia}
                onClick={openVideoPicker}
                className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors disabled:opacity-50"
              >
                <Video className="w-4 h-4" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                  Video (tối đa {maxMediaFiles}, 30MB/video)
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800" />
                </span>
              </button>
              <button
                id="product-popup-trigger"
                type="button"
                className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors"
                onClick={onToggleProductPopup}
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                  Gửi Sản phẩm
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800" />
                </span>
              </button>
              <button
                id="order-popup-trigger"
                type="button"
                className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors"
                onClick={onToggleOrderPopup}
              >
                <ClipboardList className="w-4 h-4" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                  Gửi Đơn hàng
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800" />
                </span>
              </button>
            </div>
            <button
              type="submit"
              disabled={!canSend}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all mr-0.5",
                !canSend
                  ? "text-slate-300 pointer-events-none"
                  : "text-emerald-600 hover:bg-emerald-100"
              )}
            >
              <Send className="w-5 h-5 -ml-0.5" />
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
