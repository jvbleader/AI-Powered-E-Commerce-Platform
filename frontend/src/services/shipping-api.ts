import { ShippingProvider } from "@/types/models";
import { apiFetch } from "@/services/api";

export const shippingApi = {
  getProviders: async () => {
    const res = await apiFetch<any>("/shipping/providers", {
      method: "GET",
    });
    console.log("SHIPPING API RES:", res);
    
    // In case it's nested
    const list = Array.isArray(res) ? res : (res.data || res.items || []);
    
    return list.map((p: any) => ({
      publicId: p.publicId || p.public_id,
      name: p.name,
      code: p.code,
      fixedFee: p.fixedFee || p.fixed_fee,
      logoUrl: p.logoUrl || p.logo_url,
    })) as ShippingProvider[];
  }
};
