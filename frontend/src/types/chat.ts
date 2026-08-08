export type SellerSessionSummary = {
  id: string;
  status: string;
  customer_id: number | null;
  shop_id: number | null;
  created_at: string;
  updated_at: string;
  shop_name: string | null;
  shop_avatar: string | null;
  customer_name: string | null;
  customer_avatar: string | null;
  last_message: string | null;
  has_unread?: boolean;
  unread_count?: number;
  is_pinned?: boolean;
  is_muted?: boolean;
};
