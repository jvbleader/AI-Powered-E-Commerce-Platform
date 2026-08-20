import axios, { AxiosError, AxiosRequestConfig, Method } from "axios";

import { ENV } from "@/config/env";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = ENV.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const hostname = window.location.hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return envUrl.replace(/localhost|127\.0\.0\.1/, hostname);
    }
    return envUrl;
  }
  return ENV.INTERNAL_API_BASE_URL || "http://backend:8000";
}

const API_BASE_URL = ENV.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
export const AUTH_BASE_PATH = ENV.NEXT_PUBLIC_AUTH_BASE_PATH;
const REFRESH_PATH = `${AUTH_BASE_PATH}/refresh`;
const SKIP_REFRESH_PATHS = new Set([
  `${AUTH_BASE_PATH}/login`,
  `${AUTH_BASE_PATH}/register`,
  `${AUTH_BASE_PATH}/verify-email`,
  `${AUTH_BASE_PATH}/verify-email/send`,
  `${AUTH_BASE_PATH}/verify-phone`,
  `${AUTH_BASE_PATH}/verify-phone/send`,
  `${AUTH_BASE_PATH}/reset-password`,
  `${AUTH_BASE_PATH}/reset-password/send-email`,
  `${AUTH_BASE_PATH}/logout`,
  REFRESH_PATH
]);

type RetryableAxiosRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  detail?: unknown;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error?.message ?? payload.message ?? detailMessage(payload.detail) ?? "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.code = payload.error?.code;
    this.details = payload.error?.details;
  }
}

function detailMessage(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item: any) => (typeof item === "string" ? item : item?.msg || item?.message))
      .filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  }
  if (detail && typeof detail === "object") {
    const obj = detail as any;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.msg === "string") return obj.msg;
  }
  return undefined;
}

function normalizeErrorPayload(data: unknown, fallbackMessage: string): ApiErrorPayload {
  if (!data) return { message: fallbackMessage };

  if (typeof data === "string") {
    try {
      return JSON.parse(data) as ApiErrorPayload;
    } catch {
      return { message: data || fallbackMessage };
    }
  }

  return data as ApiErrorPayload;
}

function requestPath(url?: string) {
  if (!url) return "";

  try {
    return new URL(url, getApiBaseUrl()).pathname;
  } catch {
    return url.split("?")[0];
  }
}

function toApiError(error: unknown): unknown {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const status = error.response?.status ?? 0;
    const fallbackMsg = error.response?.statusText ||
      (error.message === "Network Error" ? "Lỗi kết nối máy chủ (Network Error). Vui lòng kiểm tra lại kết nối." : error.message) ||
      "Request failed";
    const payload = normalizeErrorPayload(
      error.response?.data,
      fallbackMsg
    );
    return new ApiError(status, payload);
  }

  return error;
}


export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  transformResponse: [
    (data) => {
      if (data === null || data === undefined) return null;
      if (typeof data === "string") {
        const trimmed = data.trim();
        if (!trimmed) return null;
        try {
          return JSON.parse(trimmed);
        } catch {
          return data;
        }
      }
      return data;
    },
  ],
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

let refreshRequest: Promise<unknown> | undefined;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;
    const pathname = requestPath(originalRequest?.url);

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest.headers?.["X-Retry"] &&
      !SKIP_REFRESH_PATHS.has(pathname)
    ) {
      if (!originalRequest.headers) {
        originalRequest.headers = {};
      }
      originalRequest.headers["X-Retry"] = "true";

      try {
        refreshRequest ??= apiClient.post(REFRESH_PATH);
        await refreshRequest;
        return apiClient(originalRequest);
      } catch (refreshError) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        return Promise.reject(toApiError(refreshError));
      } finally {
        refreshRequest = undefined;
      }
    }

    if (error.response?.status === 401 && originalRequest?.headers?.["X-Retry"]) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
    }

    return Promise.reject(toApiError(error));
  }
);

function requestInitToAxiosConfig(path: string, options: RequestInit = {}): AxiosRequestConfig {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return {
    url: path,
    method: (options.method ?? "GET") as Method,
    headers: Object.fromEntries(headers.entries()),
    data: options.body,
    signal: options.signal ?? undefined
  };
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiClient.request<T>(requestInitToAxiosConfig(path, options));
  return response.data;
}
