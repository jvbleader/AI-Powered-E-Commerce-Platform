export const EMPTY_CHAT_MESSAGES: never[] = [];

export function mergeChatMessagesById<T extends { id: number; created_at?: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<number, T>();
  for (const message of existing) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return [...map.values()].sort((a, b) => {
    const byTime = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    return byTime !== 0 ? byTime : a.id - b.id;
  });
}

/** Shallow comparison used to keep React state identity stable across re-fetches. */
export function areChatMessageListsEqual<
  T extends { id: number; status?: string; content?: string }
>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === right) continue;
    if (
      left.id !== right.id ||
      left.status !== right.status ||
      left.content !== right.content
    ) {
      return false;
    }
  }
  return true;
}
