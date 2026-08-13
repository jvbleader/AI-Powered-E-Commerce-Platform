"use client";

import { useState } from "react";
import { Image as ImageIcon, Loader2, Send, Video, ShoppingBag, ClipboardList } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import {
  ChatMediaDraftPreview,
  ChatMediaHiddenInputs,
  ChatMediaUploadStatus,
} from "@/components/ai/ChatMediaDraftPreview";
import type { ChatMediaDraftItem } from "@/hooks/useChatMediaDraft";

type SellerDashboardComposerProps = {
  onSend: (text: string) => boolean | void | Promise<boolean | void>;
  mediaUploading: boolean;
  uploadProgress: { current: number; total: number } | null;
  mediaDraftItems: ChatMediaDraftItem[];
  hasMediaDraft: boolean;
  canAddMoreMedia: boolean;
  maxMediaFiles: number;
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
  hasProductDraft: boolean;
  hasOrderDraft: boolean;
  onToggleProductPopup: () => void;
  onToggleOrderPopup: () => void;
};

/** Ô nhập seller dashboard — state local, không re-render list tin. */
export function SellerDashboardComposer({
  onSend,
  mediaUploading,
  uploadProgress,
  mediaDraftItems,
  hasMediaDraft,
  canAddMoreMedia,
  maxMediaFiles,
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
  hasProductDraft,
  hasOrderDraft,
  onToggleProductPopup,
  onToggleOrderPopup,
}: SellerDashboardComposerProps) {
  const [value, setValue] = useState("");
  const canSend = !mediaUploading && (Boolean(value.trim()) || hasMediaDraft || hasProductDraft || hasOrderDraft);

  const submit = async () => {
    if (!canSend) return;
    const result = await onSend(value.trim());
    if (result === false) return;
    setValue("");
  };

  return (
    <div className="p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="max-w-4xl mx-auto"
      >
        <div className="bg-white rounded-2xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all overflow-hidden shadow-sm">
          <ChatMediaUploadStatus uploading={mediaUploading} uploadProgress={uploadProgress} />
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
            maxRows={6}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Nhập phản hồi của bạn..."
            className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-sm max-h-[150px] overflow-y-auto"
          />
          <div className="flex items-center justify-between p-2 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openImagePicker}
                disabled={mediaUploading || !canAddMoreMedia}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors disabled:opacity-50"
                title={`Gửi hình ảnh (tối đa ${maxMediaFiles}, 2MB/ảnh)`}
              >
                {mediaUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ImageIcon className="w-5 h-5" />
                )}
              </button>
              <button
                type="button"
                onClick={openVideoPicker}
                disabled={mediaUploading || !canAddMoreMedia}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors disabled:opacity-50"
                title={`Gửi video (tối đa ${maxMediaFiles}, 30MB/video)`}
              >
                <Video className="w-5 h-5" />
              </button>
              <button
                id="product-popup-trigger"
                type="button"
                onClick={onToggleProductPopup}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                title="Gửi Sản phẩm"
              >
                <ShoppingBag className="w-5 h-5" />
              </button>
              <button
                id="order-popup-trigger"
                type="button"
                onClick={onToggleOrderPopup}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                title="Gửi Đơn hàng"
              >
                <ClipboardList className="w-5 h-5" />
              </button>
            </div>
            <button
              type="submit"
              disabled={!canSend}
              className="p-2 text-emerald-600 hover:bg-emerald-100 disabled:text-slate-300 disabled:hover:bg-transparent rounded-lg transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
