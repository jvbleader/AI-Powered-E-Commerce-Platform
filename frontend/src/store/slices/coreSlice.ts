import { MarketplaceStore, persistState, STORAGE_KEY, ToastTone } from './types';
import { StateCreator } from "zustand";
import type { AppState, User, Conversation } from "@/types/models";

export const createCoreSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const toastTimeoutRef = { current: null as any };

  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === 'function' ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };
  const setToast = (toast: any) => set({ toast });
  const cloneState = () => typeof structuredClone === 'function' ? structuredClone(get().state) : JSON.parse(JSON.stringify(get().state));
  return {
    resetDemo: async () => {
      const { state, verificationContext } = get();

    const fresh = cloneState();
    setState(fresh);
    window.localStorage.removeItem(STORAGE_KEY);
  },
    showToast: async (message: string, tone: ToastTone = "info") => {
      const { state, verificationContext } = get();

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, tone });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(undefined);
      toastTimeoutRef.current = null;
    }, 2600);
  },
    setUsers: async (users: User[]) => {
      const { state, verificationContext } = get();

    setState((prev: AppState) => ({ ...prev, users }));
  },
    setConversations: async (conversations: Conversation[]) => {
      const { state, verificationContext } = get();

    setState((prev: AppState) => ({ ...prev, conversations }));
  },
  };
};
