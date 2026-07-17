import { MarketplaceStore, persistState } from './types';
import { StateCreator } from "zustand";
import type { AppState, Address } from "@/types/models";
import { ApiError } from "@/services/api";

export const createAddressSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === 'function' ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };
  const setToast = (toast: any) => set({ toast });
  const setReady = (ready: boolean) => set({ ready });
  const setVerificationContext = (ctx: any) => set({ verificationContext: ctx });
  const cloneState = () => typeof structuredClone === 'function' ? structuredClone(get().state) : JSON.parse(JSON.stringify(get().state));
  return {
    fetchAddresses: async () => {
      const { state, verificationContext } = get();

    if (!get().getCurrentUser()) return;
    try {
      const { fetchAddressesApi } = await import("@/services/address-api");
      const data = await fetchAddressesApi();
      setState((prev: Types.AppState) => ({
        ...prev,
        addresses: data.map((item) => ({
          id: String(item.id),
          userId: get().getCurrentUser()!.id, // Use current user's public ID
          receiverName: item.receiver_name,
          phone: item.phone,
          province: item.province,
          district: item.district,
          ward: item.ward,
          detailAddress: item.detail_address,
          addressType: item.address_type as "HOME" | "OFFICE",
          isDefault: item.is_default
        }))
      }));
    } catch (error) {
      console.error("Failed to fetch addresses", error);
    }
  },
    addAddress: async (address: Omit<Address, "id" | "userId">) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentUser()) return false;
    try {
      const { createAddressApi } = await import("@/services/address-api");
      const resp = await createAddressApi({
        receiver_name: address.receiverName,
        phone: address.phone,
        province: address.province,
        district: address.district,
        ward: address.ward,
        detail_address: address.detailAddress,
        address_type: address.addressType,
        is_default: address.isDefault
      });
      const newAddr: Address = {
        id: String(resp.id),
        userId: get().getCurrentUser()!.id, // Use current user's public ID
        receiverName: resp.receiver_name,
        phone: resp.phone,
        province: resp.province,
        district: resp.district,
        ward: resp.ward,
        detailAddress: resp.detail_address,
        addressType: resp.address_type as "HOME" | "OFFICE",
        isDefault: resp.is_default
      };
      
      setState((prev: Types.AppState) => ({
        ...prev,
        addresses: [
          ...prev.addresses.map((item) =>
            item.userId === get().getCurrentUser()!.id && newAddr.isDefault ? { ...item, isDefault: false } : item
          ),
          newAddr
        ]
      }));
      return true;
    } catch (error) {
      console.error("Failed to add address", error);
      return false;
    }
  },
    updateAddress: async (id: string, updates: Partial<Omit<Address, "id" | "userId">>) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentUser()) return false;
    try {
      const { updateAddressApi } = await import("@/services/address-api");
      const resp = await updateAddressApi(Number(id), {
        receiver_name: updates.receiverName,
        phone: updates.phone,
        province: updates.province,
        district: updates.district,
        ward: updates.ward,
        detail_address: updates.detailAddress,
        address_type: updates.addressType,
        is_default: updates.isDefault
      });
      
      const updatedAddr: Address = {
        id: String(resp.id),
        userId: get().getCurrentUser()!.id,
        receiverName: resp.receiver_name,
        phone: resp.phone,
        province: resp.province,
        district: resp.district,
        ward: resp.ward,
        detailAddress: resp.detail_address,
        addressType: resp.address_type as "HOME" | "OFFICE",
        isDefault: resp.is_default
      };

      setState((prev: Types.AppState) => ({
        ...prev,
        addresses: prev.addresses.map((item) => {
          if (item.id === id) return updatedAddr;
          if (item.userId === get().getCurrentUser()!.id && updatedAddr.isDefault) return { ...item, isDefault: false };
          return item;
        })
      }));
      return true;
    } catch (error) {
      console.error("Failed to update address", error);
      return false;
    }
  },
    removeAddress: async (id: string) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentUser()) return false;
    try {
      const { deleteAddressApi } = await import("@/services/address-api");
      await deleteAddressApi(Number(id));
      
      setState((prev: Types.AppState) => ({
        ...prev,
        addresses: prev.addresses.filter((item) => item.id !== id)
      }));
      return true;
    } catch (error) {
      console.error("Failed to delete address", error);
      return false;
    }
  },
  };
};
