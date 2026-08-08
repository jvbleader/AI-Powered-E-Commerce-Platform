"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadChatFile, uploadChatImage, uploadChatVideo } from "@/services/upload-api";
import {
  CHAT_MEDIA_LIMITS,
  CHAT_MEDIA_PLACEHOLDER,
  ChatMediaAttachmentType,
  getMediaAttachmentType,
  validateChatMediaFiles,
} from "@/lib/chat-media";

type SendMessageFn = (
  content: string,
  attachmentType?: string,
  attachmentId?: string,
  replyToId?: number,
  attachments?: Array<{ type: ChatMediaAttachmentType; url: string }>
) => void;

type UploadFn = (file: File, type: ChatMediaAttachmentType) => Promise<string>;

export type ChatMediaDraftItem = {
  id: string;
  file: File;
  previewUrl: string;
  type: ChatMediaAttachmentType;
};

export function useChatMediaDraft({
  sendMessage,
  replyToId,
  onError,
  onComplete,
  uploadFn,
  groupAttachments = false,
}: {
  sendMessage: SendMessageFn;
  replyToId?: number | null;
  onError?: (message: string) => void;
  onComplete?: (sentCount: number) => void;
  uploadFn?: UploadFn;
  groupAttachments?: boolean;
}) {
  const [draftItems, setDraftItems] = useState<ChatMediaDraftItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const draftItemsRef = useRef<ChatMediaDraftItem[]>([]);

  useEffect(() => {
    draftItemsRef.current = draftItems;
  }, [draftItems]);

  useEffect(() => {
    return () => {
      draftItemsRef.current.forEach((item) => {
        if (item.type !== "FILE") URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const resetInputs = () => {
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (addInputRef.current) addInputRef.current.value = "";
  };

  const revokeDraftItems = (items: ChatMediaDraftItem[]) => {
    items.forEach((item) => {
      if (item.type !== "FILE") URL.revokeObjectURL(item.previewUrl);
    });
  };

  const defaultUpload = async (file: File, type: ChatMediaAttachmentType) => {
    if (type === "IMAGE") return uploadChatImage(file);
    if (type === "VIDEO") return uploadChatVideo(file);
    return uploadChatFile(file);
  };

  const addFiles = useCallback(
    (files: FileList | File[] | null, filter?: "image" | "video" | "file") => {
      if (!files || uploading) return;

      let selected = Array.from(files);
      if (filter === "image") {
        selected = selected.filter((file) => file.type.startsWith("image/"));
      } else if (filter === "video") {
        selected = selected.filter((file) => file.type.startsWith("video/"));
      } else if (filter === "file") {
        selected = selected.filter(
          (file) =>
            !file.type.startsWith("image/") &&
            !file.type.startsWith("video/")
        );
      }

      const { valid, errors } = validateChatMediaFiles(selected, draftItems.length);
      if (errors.length) {
        onError?.(errors.join("\n"));
        resetInputs();
        return;
      }
      if (!valid.length) {
        resetInputs();
        return;
      }

      const newItems: ChatMediaDraftItem[] = valid.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: file.type.startsWith("image/") || file.type.startsWith("video/")
          ? URL.createObjectURL(file)
          : "",
        type: getMediaAttachmentType(file),
      }));

      setDraftItems((prev) => [...prev, ...newItems]);
      resetInputs();
    },
    [draftItems.length, onError, uploading]
  );

  const removeItem = useCallback((id: string) => {
    setDraftItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.type !== "FILE") URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraftItems((prev) => {
      revokeDraftItems(prev);
      return [];
    });
    resetInputs();
  }, []);

  const sendDraft = useCallback(
    async (caption?: string) => {
      if (!draftItems.length || uploading) return false;

      const itemsToSend = [...draftItems];
      const upload = uploadFn ?? defaultUpload;
      setUploading(true);
      setUploadProgress({ current: 0, total: itemsToSend.length });

      try {
        const uploaded: Array<{ type: ChatMediaAttachmentType; url: string }> = [];

        for (let i = 0; i < itemsToSend.length; i++) {
          const item = itemsToSend[i];
          setUploadProgress({ current: i + 1, total: itemsToSend.length });
          const url = await upload(item.file, item.type);
          uploaded.push({ type: item.type, url });
        }

        const trimmedCaption = caption?.trim();

        if (groupAttachments) {
          sendMessage(
            trimmedCaption || `[${uploaded.length} tệp đính kèm]`,
            undefined,
            undefined,
            replyToId ?? undefined,
            uploaded
          );
        } else {
          for (let i = 0; i < uploaded.length; i++) {
            const item = uploaded[i];
            sendMessage(
              CHAT_MEDIA_PLACEHOLDER[item.type],
              item.type,
              item.url,
              i === 0 ? replyToId ?? undefined : undefined
            );
            if (i < uploaded.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }

          if (trimmedCaption) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            sendMessage(trimmedCaption, undefined, undefined, replyToId ?? undefined);
          }
        }

        revokeDraftItems(itemsToSend);
        setDraftItems([]);
        onComplete?.(itemsToSend.length);
        return true;
      } catch (error) {
        onError?.(error instanceof Error ? error.message : "Không thể tải file lên.");
        return false;
      } finally {
        setUploading(false);
        setUploadProgress(null);
        resetInputs();
      }
    },
    [draftItems, uploading, sendMessage, replyToId, onError, onComplete, uploadFn, groupAttachments]
  );

  const openImagePicker = () => {
    if (uploading || draftItems.length >= CHAT_MEDIA_LIMITS.maxFiles) return;
    imageInputRef.current?.click();
  };

  const openVideoPicker = () => {
    if (uploading || draftItems.length >= CHAT_MEDIA_LIMITS.maxFiles) return;
    videoInputRef.current?.click();
  };

  const openFilePicker = () => {
    if (uploading || draftItems.length >= CHAT_MEDIA_LIMITS.maxFiles) return;
    fileInputRef.current?.click();
  };

  const openAddPicker = () => {
    if (uploading || draftItems.length >= CHAT_MEDIA_LIMITS.maxFiles) return;
    addInputRef.current?.click();
  };

  return {
    draftItems,
    hasDraft: draftItems.length > 0,
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
    handleImageChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      addFiles(event.target.files, "image"),
    handleVideoChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      addFiles(event.target.files, "video"),
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      addFiles(event.target.files, "file"),
    handleAddChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      addFiles(event.target.files),
    removeItem,
    clearDraft,
    sendDraft,
    canAddMore: draftItems.length < CHAT_MEDIA_LIMITS.maxFiles,
    maxFiles: CHAT_MEDIA_LIMITS.maxFiles,
  };
}
