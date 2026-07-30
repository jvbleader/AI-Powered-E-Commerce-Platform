# Notification System Design (Customer)

## 1. Overview
Hệ thống In-app Notification theo thời gian thực (Real-time) dành riêng cho tài khoản Customer trên Web platform.
Mục tiêu là thông báo cho người dùng về trạng thái đơn hàng, tin nhắn CSKH/Hệ thống, và cấp phát mã giảm giá.
Sử dụng kiến trúc Server-Sent Events (SSE) kết hợp Redis Pub/Sub để đảm bảo tính thời gian thực mà không gây quá tải cho Database.

## 2. Architecture & Data Flow
- **Event Trigger (Gửi thông báo):** Khi có sự kiện (ví dụ đơn hàng cập nhật), Backend lưu 1 bản ghi thông báo vào database và ĐỒNG THỜI `PUBLISH` nội dung vào một Redis channel cụ thể của user đó (Ví dụ: `channel:notify:user_{user_id}`).
- **Event Consumer (Nhận thông báo):** Trình duyệt người dùng kết nối tới Backend thông qua một endpoint SSE.
- **Delivery:** Backend giữ kết nối SSE đó, `SUBSCRIBE` Redis channel tương ứng và đẩy thẳng dữ liệu về trình duyệt ngay khi bắt được event từ Redis.

## 3. Database Schema
Tạo bảng/model `Notification` (Sử dụng SQLAlchemy):
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key liên kết tới bảng users, đánh Index)
- `type`: String (`ORDER`, `SYSTEM`, `COUPON`) - Dùng để phân loại trên UI.
- `title`: String - Tiêu đề ngắn gọn của thông báo.
- `content`: Text - Nội dung chi tiết.
- `is_read`: Boolean (Default: False) - Đánh dấu trạng thái đọc.
- `action_url`: String (Nullable) - Đường dẫn để điều hướng người dùng khi click vào thông báo (VD: `/account/orders/123`).
- `created_at`: DateTime (Default: func.now())

## 4. API Endpoints
Backend (FastAPI) cung cấp 5 endpoints:
1. `GET /api/v1/notifications/stream`: Endpoint giữ kết nối SSE liên tục. Trả về event dữ liệu khi có thông báo mới (Yêu cầu Authentication JWT).
2. `GET /api/v1/notifications`: API lấy danh sách thông báo. Hỗ trợ phân trang (limit, offset) và sắp xếp theo `created_at` giảm dần.
3. `GET /api/v1/notifications/unread-count`: Trả về tổng số lượng thông báo chưa đọc (để load lần đầu).
4. `PUT /api/v1/notifications/{id}/read`: Cập nhật `is_read = true` cho 1 thông báo cụ thể.
5. `PUT /api/v1/notifications/read-all`: Cập nhật `is_read = true` cho toàn bộ thông báo chưa đọc của user hiện tại.

## 5. Frontend UI (Next.js + TailwindCSS)
- **`NotificationBell` (Header Component):** 
  - Chứa biểu tượng quả chuông, hiển thị `unreadCount` dạng badge chấm đỏ. 
  - Khởi tạo kết nối `EventSource` tới endpoint `/stream` để tự động cập nhật biến state `unreadCount` khi có event mới gửi về.
- **`NotificationDropdown` (Pop-over):** 
  - Hiển thị bảng danh sách các thông báo rút gọn khi click vào quả chuông. 
  - Hỗ trợ cuộn Infinite Scroll để tải thêm.
  - Phân loại icon và style dựa theo trường `type` (Đơn hàng, Hệ thống, Mã giảm giá).
  - Khi click vào thông báo: Gọi ngầm API `/read`, cập nhật local state (xóa chấm đỏ), và dùng `next/router` chuyển trang đến `action_url`.
- **`Notification Center Page` (`/account/notifications`):** 
  - Một trang riêng biệt chứa toàn bộ lịch sử thông báo của khách hàng.
  - Cung cấp các Tab để lọc theo danh mục: Tất cả | Đơn hàng | Khuyến mãi | Hệ thống.
