export type SupportAttachment = {
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
};

export type SupportMessage = {
  id: number;
  conversation_id: string;
  sender_type: "CUSTOMER" | "SUPPORTER" | "SYSTEM";
  content: string;
  attachment_type?: "IMAGE" | "VIDEO" | "FILE" | null;
  attachment_id?: string | null;
  attachments?: SupportAttachment[] | null;
  created_at: string;
};

export type SupportConversation = {
  id: string;
  status: string;
  supporter_id: number | null;
  supporter: {
    id: number;
    public_id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  customer_id?: number | null;
  customer?: {
    id: number;
    public_id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  guest_id?: string | null;
  created_at: string;
};

export type SupportSessionSummary = {
  id: string;
  status: string;
  customer_id: number | null;
  guest_id: string | null;
  supporter_id: number | null;
  created_at: string;
  updated_at: string;
  supporter: {
    id: number;
    public_id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  customer?: {
    id: number;
    public_id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  last_message: string | null;
  has_unread?: boolean;
};
