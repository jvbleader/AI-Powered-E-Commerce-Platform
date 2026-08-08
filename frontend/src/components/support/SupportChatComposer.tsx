"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Send, Video } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";
import { useChatMediaDraft } from "@/hooks/useChatMediaDraft";
import { ChatMediaDraftPreview, ChatMediaHiddenInputs, ChatMediaUploadStatus } from "@/components/ai/ChatMediaDraftPreview";
import { uploadSupportChatAttachment } from "@/services/upload-api";
import { CHAT_FILE_ACCEPT } from "@/lib/chat-media";
import type { ChatMediaAttachmentType } from "@/lib/chat-media";

type SendMessageFn = (
  content: string,
  attachmentType?: string,
  attachmentId?: string,
  attachments?: Array<{ type: "IMAGE" | "VIDEO" | "FILE"; url: string }>,
  targetConversationId?: string | null
) => void;

export function SupportChatComposer({
  conversationId,
  guestId,
  isConnected,
  disabled = false,
  sendMessage,
  onEnsureConversation,
  placeholder = "Nhập tin nhắn...",
  onError,
  compact = false,
}: {
  conversationId: string | null;
  guestId?: string | null;
  isConnected: boolean;
  disabled?: boolean;
  sendMessage: SendMessageFn;
  onEnsureConversation?: () => Promise<string | null>;
  placeholder?: string;
  onError?: (message: string) => void;
  compact?: boolean;
}) {
  const [input, setInput] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isEnsuringConversation, setIsEnsuringConversation] = useState(false);
  const activeConversationIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  const uploadFn = useCallback(
    async (file: File, type: ChatMediaAttachmentType) => {
      let activeConversationId = activeConversationIdRef.current;
      if (!activeConversationId && onEnsureConversation) {
        activeConversationId = await onEnsureConversation();
        if (activeConversationId) {
          activeConversationIdRef.current = activeConversationId;
        }
      }
      if (!activeConversationId) {
        throw new Error("Không thể tạo hội thoại để gửi file.");
      }
      const result = await uploadSupportChatAttachment(activeConversationId, file, guestId);
      return result.url;
    },
    [guestId, onEnsureConversation]
  );

  const wrappedSendMessage = useCallback(
    (
      content: string,
      attachmentType?: string,
      attachmentId?: string,
      _replyToId?: number,
      attachments?: Array<{ type: "IMAGE" | "VIDEO" | "FILE"; url: string }>
    ) => {
      const convId = activeConversationIdRef.current;
      if (attachments?.length) {
        sendMessage(content, undefined, undefined, attachments, convId);
        return;
      }
      sendMessage(content, attachmentType, attachmentId, undefined, convId);
    },
    [sendMessage]
  );

  const {
    draftItems,
    hasDraft,
    imageInputRef,
    videoInputRef,
    fileInputRef,
    addInputRef,
    uploading,
    uploadProgress,
    openImagePicker,
    openVideoPicker,
    openFilePicker,
    openAddPicker,
    handleImageChange,
    handleVideoChange,
    handleFileChange,
    handleAddChange,
    removeItem,
    clearDraft,
    sendDraft,
    canAddMore,
    maxFiles,
  } = useChatMediaDraft({
    sendMessage: wrappedSendMessage,
    uploadFn,
    groupAttachments: true,
    onError: (message) => {
      setMediaError(message);
      onError?.(message);
    },
    onComplete: () => setMediaError(null),
  });

  // Không khóa input khi WS chưa subscribe — sendOrQueue sẽ xếp hàng khi offline.
  const inputDisabled = disabled || uploading || isEnsuringConversation;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputDisabled && !hasDraft) return;

    if (hasDraft) {
      if (onEnsureConversation && !activeConversationIdRef.current) {
        setIsEnsuringConversation(true);
        try {
          const newId = await onEnsureConversation();
          if (!newId) return;
          activeConversationIdRef.current = newId;
        } finally {
          setIsEnsuringConversation(false);
        }
      }
      const sent = await sendDraft(input);
      if (sent) setInput("");
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) return;

    if (!activeConversationIdRef.current && onEnsureConversation) {
      setIsEnsuringConversation(true);
      try {
        const newId = await onEnsureConversation();
        if (!newId) return;
        activeConversationIdRef.current = newId;
      } finally {
        setIsEnsuringConversation(false);
      }
    }

    sendMessage(trimmed, undefined, undefined, undefined, activeConversationIdRef.current);
    setInput("");
  };

  const fileAccept = useMemo(
    () => `image/*,video/*,${CHAT_FILE_ACCEPT}`,
    []
  );

  return (
    <div className={cn("bg-slate-100 border-t border-slate-200", compact ? "p-3" : "p-3 md:p-4")}>
      {mediaError && (
        <div className="max-w-4xl mx-auto mb-2">
          <p className="text-xs text-red-600 whitespace-pre-line">{mediaError}</p>
        </div>
      )}
      <form onSubmit={handleSend} className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border-2 border-slate-200 focus-within:border-blue-500 transition-all overflow-hidden shadow-sm">
          <ChatMediaUploadStatus uploading={uploading} uploadProgress={uploadProgress} showDivider={false} />
          <ChatMediaHiddenInputs
            imageInputRef={imageInputRef}
            videoInputRef={videoInputRef}
            fileInputRef={fileInputRef}
            addInputRef={addInputRef}
            onImageChange={handleImageChange}
            onVideoChange={handleVideoChange}
            onFileChange={handleFileChange}
            onAddChange={handleAddChange}
            disabled={inputDisabled}
            fileAccept={fileAccept}
          />
          <ChatMediaDraftPreview
            items={draftItems}
            canAddMore={canAddMore}
            maxFiles={maxFiles}
            onRemove={removeItem}
            onClear={clearDraft}
            onAdd={openAddPicker}
            showDivider={false}
          />
          <TextareaAutosize
            minRows={1}
            maxRows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 shadow-none resize-none py-2 px-3 text-sm max-h-[120px] overflow-y-auto no-scrollbar"
            disabled={inputDisabled}
          />
          <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
            <div className="flex items-center">
              <button
                type="button"
                onClick={openImagePicker}
                disabled={inputDisabled || !canAddMore}
                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                title={`Gửi hình ảnh (tối đa ${maxFiles}, 2MB/ảnh)`}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={openVideoPicker}
                disabled={inputDisabled || !canAddMore}
                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                title={`Gửi video (tối đa ${maxFiles}, 30MB/video)`}
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={openFilePicker}
                disabled={inputDisabled || !canAddMore}
                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                title="Gửi tệp PDF, DOCX, TXT (tối đa 10MB)"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
            <button
              type="submit"
              disabled={inputDisabled || (!input.trim() && !hasDraft)}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 shadow-sm",
                inputDisabled || (!input.trim() && !hasDraft)
                  ? "bg-slate-200 text-slate-400 pointer-events-none"
                  : "bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 active:scale-95"
              )}
            >
              {uploading || isEnsuringConversation ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 -ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
