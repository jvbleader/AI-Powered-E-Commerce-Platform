# Feature Design: Chat With Supporter (Realtime)

## 1. Overview
Tính năng "Chat with Supporter" cho phép khách hàng (bao gồm cả khách vãng lai và người dùng đã đăng nhập) có thể trò chuyện trực tiếp (real-time) với nhân viên Chăm sóc khách hàng (Supporter). Tính năng này được tích hợp vào hệ thống e-commerce hiện tại.

## 2. Architecture & Tech Stack
Sử dụng kiến trúc FastAPI WebSockets kết hợp Redis Pub/Sub để hỗ trợ khả năng scale.

- **Frontend:** Next.js (App Router).
- **Backend:** FastAPI, WebSockets (`fastapi.websockets`).
- **Broker:** Redis (cho Pub/Sub quản lý message giữa các worker/container).
- **Database:** MySQL + SQLAlchemy (Lưu trữ lịch sử chat).

## 3. Component Design

### 3.1. Infrastructure (Docker)
Cần bổ sung service `redis` vào 3 file docker-compose hiện tại của dự án (`docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.tunnel.yml`). Backend sẽ kết nối đến Redis thông qua biến môi trường `REDIS_URL`.

### 3.2. Database Models
- **Conversation Model:**
  - `id`: PK (UUID)
  - `customer_id`: FK (Nullable) -> Liên kết User (nếu login).
  - `guest_id`: String (Nullable) -> Dành cho khách vãng lai.
  - `supporter_id`: FK (Nullable) -> Liên kết User (role supporter).
  - `status`: Enum (OPEN, CLOSED).
- **Message Model:**
  - `id`: PK (UUID)
  - `conversation_id`: FK
  - `sender_type`: Enum (CUSTOMER, SUPPORTER)
  - `content`: Text
  - `created_at`: Datetime

### 3.3. Backend Logic (FastAPI)
- **Redis Connection Manager:** Class quản lý pub/sub và gửi message.
- **WebSocket Endpoint:** `ws://.../ws/chat/{session_id}`
  - Xác thực session (guest hoặc logged-in user).
  - Lắng nghe message. Khi nhận message:
    1. Lưu vào MySQL.
    2. Publish message lên kênh Redis (channel tương ứng của cuộc trò chuyện).
- **REST APIs:** API lấy lịch sử chat, API phân công Supporter.

### 3.4. Frontend Logic (Next.js)
- **Customer UI (`/chat`):**
  - Tích hợp hook quản lý WebSocket (`useChatWebSocket`).
  - Nếu là Guest, tạo một UUID lưu vào `localStorage` làm session ID.
- **Supporter UI (`/supporter/conversations`):**
  - Hiển thị danh sách các đoạn chat đang OPEN.
  - Quản lý trạng thái kết nối WebSocket tương tự.

## 4. Error Handling & Edge Cases
- **Mất kết nối mạng:** Tự động kết nối lại WebSocket sau 3-5 giây (Auto-reconnect fallback).
- **Đồng bộ trạng thái:** Nếu chưa có Supporter nào online hoặc tiếp nhận, tin nhắn vẫn được lưu vào DB để Supporter xem sau.

## 5. Testing Plan
- Test giao tiếp 2 chiều trên 2 trình duyệt độc lập.
- Test Redis pub/sub (chạy 2 server uvicorn giả lập scale).
- Test giữ vững session cho khách vãng lai sau khi reload trang.
