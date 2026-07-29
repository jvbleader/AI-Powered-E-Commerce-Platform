import { apiFetch, getApiBaseUrl } from "./api";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatRequestPayload = {
  message: string;
  history?: ChatMessage[];
};

export async function sendChatMessage(message: string, history?: ChatMessage[]) {
  return apiFetch<{ reply: string; model: string }>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export async function streamChatMessage(
  message: string,
  history: ChatMessage[] | undefined,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: Error) => void
) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      buffer = lines.pop() || ""; // Keep the incomplete line in the buffer
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          if (dataStr.trim() === "[DONE]") {
            continue;
          }
          
          try {
            const data = JSON.parse(dataStr);
            if (data.content) {
              onChunk(data.content);
            }
            if (data.done) {
              // Complete
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", dataStr);
          }
        }
      }
    }
    
    onDone();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
