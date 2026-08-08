export const CHAT_MEDIA_LIMITS = {
  maxFiles: 9,
  maxImageBytes: 2 * 1024 * 1024,
  maxVideoBytes: 30 * 1024 * 1024,
  maxFileBytes: 10 * 1024 * 1024,
} as const;

export const CHAT_MEDIA_PLACEHOLDER = {
  IMAGE: "[Hình ảnh]",
  VIDEO: "[Video]",
  FILE: "[Tệp đính kèm]",
} as const;

export const CHAT_FILE_ACCEPT =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt";

export type ChatMediaAttachmentType = "IMAGE" | "VIDEO" | "FILE";

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  return `${Math.ceil(bytes / 1024)}KB`;
}

export function getMediaAttachmentType(file: File): ChatMediaAttachmentType {
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("image/")) return "IMAGE";
  return "FILE";
}

function isAllowedDocument(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "text/plain" ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt")
  );
}

export function validateChatMediaFiles(
  files: File[],
  existingCount = 0
): { valid: File[]; errors: string[] } {
  const errors: string[] = [];

  if (!files.length) {
    return { valid: [], errors: ["Không có file nào được chọn."] };
  }

  const remaining = CHAT_MEDIA_LIMITS.maxFiles - existingCount;
  if (remaining <= 0) {
    return {
      valid: [],
      errors: [`Đã đạt tối đa ${CHAT_MEDIA_LIMITS.maxFiles} file trong một lần nháp.`],
    };
  }

  if (files.length > remaining) {
    errors.push(
      `Chỉ thêm được ${remaining} file nữa (tối đa ${CHAT_MEDIA_LIMITS.maxFiles} file mỗi lần).`
    );
  }

  const selected = files.slice(0, remaining);
  const valid: File[] = [];

  for (const file of selected) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isDocument = isAllowedDocument(file);

    if (!isImage && !isVideo && !isDocument) {
      errors.push(`"${file.name}" không phải ảnh, video hoặc tệp PDF/DOCX/TXT hợp lệ.`);
      continue;
    }

    if (isImage && file.size > CHAT_MEDIA_LIMITS.maxImageBytes) {
      errors.push(`"${file.name}" vượt quá 2MB (${formatFileSize(file.size)}).`);
      continue;
    }

    if (isVideo && file.size > CHAT_MEDIA_LIMITS.maxVideoBytes) {
      errors.push(`"${file.name}" vượt quá 30MB (${formatFileSize(file.size)}).`);
      continue;
    }

    if (isDocument && file.size > CHAT_MEDIA_LIMITS.maxFileBytes) {
      errors.push(`"${file.name}" vượt quá 10MB (${formatFileSize(file.size)}).`);
      continue;
    }

    valid.push(file);
  }

  return { valid, errors };
}

export function getFileLabelFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").pop() || "file";
    return decodeURIComponent(name);
  } catch {
    return "Tệp đính kèm";
  }
}
