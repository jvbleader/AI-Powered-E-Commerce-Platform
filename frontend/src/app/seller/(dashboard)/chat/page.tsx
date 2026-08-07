import React from "react";
import { ChatDashboard } from "@/components/seller/ChatDashboard";

export const metadata = {
  title: "Quản lý tin nhắn - Kênh Người Bán",
};

export default function SellerChatPage() {
  return (
    <div className="flex-1 flex overflow-hidden">
      <ChatDashboard />
    </div>
  );
}
