export const ENV = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL || process.env.BACKEND_INTERNAL_URL,
  NEXT_PUBLIC_AUTH_BASE_PATH: process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/auth",
};

if (!ENV.NEXT_PUBLIC_API_BASE_URL) {
  console.warn("⚠️ [Config] Missing NEXT_PUBLIC_API_BASE_URL in environment variables!");
}
