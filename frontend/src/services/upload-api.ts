import { apiClient, ApiError } from "@/services/api";

async function uploadFile(endpoint: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await apiClient.post<{ url: string }>(endpoint, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (!response.data?.url) {
      throw new Error("Không nhận được URL file sau khi tải lên.");
    }
    return response.data.url;
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(error.message);
    }
    throw error instanceof Error ? error : new Error("Không thể tải file lên.");
  }
}

export async function uploadImage(file: File): Promise<string> {
  return uploadFile("/api/upload/image", file);
}

export async function uploadChatImage(file: File): Promise<string> {
  return uploadFile("/api/upload/image", file);
}

export async function uploadChatVideo(file: File): Promise<string> {
  return uploadFile("/api/upload/video", file);
}

export async function uploadChatFile(file: File): Promise<string> {
  return uploadFile("/api/upload/file", file);
}

export async function uploadSupportChatAttachment(
  conversationId: string,
  file: File,
  guestId?: string | null
): Promise<{ url: string; attachment_type: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const query = guestId ? `?guest_id=${encodeURIComponent(guestId)}` : "";

  try {
    const response = await apiClient.post<{ url: string; attachment_type: string }>(
      `/api/support-chat/conversations/${conversationId}/upload${query}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    if (!response.data?.url) {
      throw new Error("Không nhận được URL file sau khi tải lên.");
    }
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(error.message);
    }
    throw error instanceof Error ? error : new Error("Không thể tải file lên.");
  }
}
