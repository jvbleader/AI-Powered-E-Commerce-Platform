import { apiFetch } from "./api";

export interface BackendAddressResponse {
  id: number;
  user_id: number;
  receiver_name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detail_address: string;
  address_type: string;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AddressCreatePayload {
  receiver_name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detail_address: string;
  address_type?: string;
  is_default?: boolean;
}

export interface AddressUpdatePayload {
  receiver_name?: string;
  phone?: string;
  province?: string;
  district?: string;
  ward?: string;
  detail_address?: string;
  address_type?: string;
  is_default?: boolean;
}

export const fetchAddressesApi = () => {
  return apiFetch<BackendAddressResponse[]>("/api/v1/addresses");
};

export const createAddressApi = (data: AddressCreatePayload) => {
  return apiFetch<BackendAddressResponse>("/api/v1/addresses", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateAddressApi = (id: number, data: AddressUpdatePayload) => {
  return apiFetch<BackendAddressResponse>(`/api/v1/addresses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteAddressApi = (id: number) => {
  return apiFetch<{ message: string }>(`/api/v1/addresses/${id}`, {
    method: "DELETE",
  });
};
