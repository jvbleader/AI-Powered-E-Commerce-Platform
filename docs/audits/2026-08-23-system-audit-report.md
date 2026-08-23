# Báo cáo Audit toàn hệ thống — 2026-08-23

## 1. Thông tin chung

| Mục | Giá trị |
|---|---|
| Ngày audit | 2026-08-23 |
| BASE commit | `0b26ef8` (branch `feature/ui-feature-improvements`, working tree dirty ~32 thay đổi — chính là vùng ưu tiên được audit) |
| Phạm vi | Frontend (`frontend/`, Next.js 16.2.9 + React 18 + TS strict), Backend (`backend/app`, FastAPI/Python 3.12), Hạ tầng/cấu hình (compose ×3, nginx, `.env*`, scripts, seed), Runtime smoke (dev environment Docker đang chạy) |
| Phương pháp | Audit tĩnh (`tsc --noEmit`, `npm audit`, `next build`, `compileall`, alembic offline, security greps, review thủ công vùng nóng) + runtime smoke test end-to-end trên dev stack (register → login → catalog → cart → checkout COD → AI chat stream → upload) |
| Tổng findings | **58** (FE 22 · BE 17 · INF 16 · RT 3), phân bố severity xem mục 2 |

**Giới hạn của đợt audit** (chi tiết tại Phụ lục): không test E2E sâu theo luồng nghiệp vụ; không deep-dive business flow ví/order end-to-end; không đọc giá trị `.env`; không thực thi alembic upgrade lên DB thật; không bắt console/trình duyệt thật ở frontend; payment gateway VNPAY ngoài phạm vi smoke.

> **Ghi chú môi trường xác nhận từ runtime (quan trọng khi đọc các finding liên quan):**
> LLM key (AI chat streaming hoạt động đầy đủ: status → token-by-token → products payload) và Azure Blob Storage (upload ảnh thành công, trả URL blob thực) **ĐÃ được cấu hình và hoạt động bình thường** trong môi trường dev — trái nghi ngờ ban đầu từ audit tĩnh. Các đề xuất fix cho finding nhóm AI/upload **không được** hướng theo giả định "thiếu credential".

---

## 2. Bảng tóm tắt theo severity × khu vực

| Severity | FE | BE | INF | RT | **Tổng** |
|---|---|---|---|---|---|
| P0 | 1 | 0 | 0 | 0 | **1** |
| P1 | 1 | 1 | 2 | 0 | **4** |
| P2 | 5 | 4 | 6 | 1 | **16** |
| P3 | 15 | 12 | 8 | 2 | **37** |
| **Tổng** | **22** | **17** | **16** | **3** | **58** |

Quy ước ID: prefix khu vực giữ mapping cũ với report nguồn — FE = Task 2 (frontend), BE = Task 3 (backend), INF = Task 4 (hạ tầng), RT = Task 5 (runtime smoke). Ví dụ `FE-07` ↔ `T2-F07`.

Điều chỉnh áp dụng khi hợp nhất (ruling controller):
1. **FE-07** hạ từ P2 → P3, viết lại cơ chế theo reviewer (guard `AbortError` khiến abort-từ-switch không kích hoạt onError) — giữ ghi chú tranh luận.
2. **FE-02** diễn đạt lại mức advisory theo GitHub (4 High / 5 Moderate), patched từ Next.js 16.2.11.
3. Ghi chú môi trường LLM key/Azure Blob đã cấu hình hoạt động (mục 1).

---

## 3. Chi tiết findings

### P0 — 1 finding

#### FE-01 — XSS qua bubble tin nhắn AI assistant (`dangerouslySetInnerHTML` không sanitize)
- **Vị trí:** `frontend/src/components/ai/ChatMessageItem.tsx:11-18` (hàm `formatMarkdown`), `:34-37` (useMemo tạo html), `:88-91` (`dangerouslySetInnerHTML={{ __html: html }}`)
- **Mô tả:** Nội dung tin nhắn assistant được đưa thẳng vào DOM sau khi chỉ biến đổi markdown bằng regex (`**bold**`, `*em*`, backtick, `\n`). `formatMarkdown` **không escape HTML**, project không có DOMPurify/sanitize-html/xss trong `package.json`. Kênh khai thác: prompt-injection khiến AI lặp lại payload `<img src=x onerror=...>`; seller đặt tên/mô tả sản phẩm chứa payload rồi AI trích vào câu trả lời; lịch sử chat có endpoint xem phía admin (`/admin/chats`) — nếu viewer dùng cùng component thì payload chạy trong trình duyệt admin.
- **Tác động:** XSS lưu/phản xạ: đánh cắp session (API dùng `withCredentials: true`), hành động thay mặt nạn nhân; nhánh admin là leo thang đặc quyền customer/seller → admin. User-bubble an toàn (render text thường tại dòng 102) — chỉ assistant-bubble nhiễm.
- **Đề xuất fix:** Escape HTML entities trước khi áp regex markdown, hoặc thay bằng `markdown-it` + `DOMPurify.sanitize()` (whitelist `strong/em/code/br`); rà soát mọi chỗ khác render nội dung AI bằng `dangerouslySetInnerHTML` (admin chat viewer).

### P1 — 4 findings

#### FE-02 — Cụm advisories bảo mật Next.js trên framework chạy runtime
- **Vị trí:** `frontend/package.json` → `node_modules/next` (Next.js **16.2.9**, dải lỗi `9.3.4-canary.0 - 16.3.0-preview.10`)
- **Mô tả:** **9 advisories ảnh hưởng runtime (GitHub chấm 4 High / 5 Moderate), đã được vá từ bản 16.2.11**: Middleware/Proxy bypass (GHSA-6gpp-xcg3-4w24); DoS App Router qua Server Actions (GHSA-m99w-x7hq-7vfj); SSRF Server Actions custom server (GHSA-89xv-2m56-2m9x); Cache confusion response body (GHSA-68g3-v927-f742, GHSA-4633-3j49-mh5q); Unbounded Server Action payload Edge runtime (GHSA-4c39-4ccg-62r3); SSRF rewrite hostname attacker-controlled (GHSA-p9j2-gv94-2wf4); DoS Image Optimization qua SVG (GHSA-q8wf-6r8g-63ch); Disclosure internal Server Function endpoints (GHSA-955p-x3mx-jcvp).
- **Tác động:** Bề mặt tấn công internet-facing của chính framework: bypass auth middleware, SSRF, DoS, lộ internal endpoints.
- **Đề xuất fix:** Nâng Next.js lên ≥ **16.2.11** (bản stable mới nhất có fix), chạy `npm audit fix`, regression test middleware + server actions sau nâng cấp.

#### BE-01 — IDOR phiên chat AI (đọc chéo user + ghi chéo user)
- **Vị trí:** `backend/app/repositories/chat/chat_repository.py:30-53` (`get_or_create_session`) kết hợp `backend/app/api/chat/chat_ai_api.py:48-63`
- **Mô tả:** User đăng nhập POST `/ai/chat/message` với `session_id` của người khác → session được trả về mà KHÔNG kiểm tra `session.user_id == user_id` (chỉ bind user nếu session chưa có chủ, dòng 50-52). Endpoint ghi tin nhắn attacker vào session nạn nhân và nạp toàn bộ lịch sử chat nạn nhân làm context LLM. GET `/ai/chat/history` ngược lại CÓ check ownership (`chat_ai_api.py:220`) → đây là sơ hở, không phải chủ đích.
- **Tác động:** Attacker đăng nhập bất kỳ có thể (1) inject tin nhắn vào phiên chat AI người khác, (2) dùng prompt kiểu "liệt kê lại nội dung trước đó" để leak hội thoại riêng tư của nạn nhân ra stream của mình, (3) phá dữ liệu (assistant reply lưu sai session).
- **Đề xuất fix:** Trong `get_or_create_session`: khi có `user_id` và session tồn tại mà `session.user_id not in (None, user_id)` → trả None/raise 403. Áp tương tự cho nhánh `session_token`.

#### INF-01 — Prod compose publish Elasticsearch ra host, xpack security tắt
- **Vị trí:** `docker-compose.prod.yml:39-40` + `.env.example` (`ES_XPACK_SECURITY_ENABLED=false`)
- **Mô tả:** File compose "prod" publish ES ra host `0.0.0.0:${ES_HOST_PORT}` trong khi xpack security mặc định tắt (không auth, không TLS).
- **Tác động:** Bất kỳ ai truy cập IP server đều đọc/ghi/xoá toàn bộ index sản phẩm & knowledge base; leo thang sang service nội bộ khác.
- **Đề xuất fix:** Xoá block `ports:` của ES ở file prod (chỉ để internal network); hoặc tối thiểu bind `127.0.0.1:` + bật `xpack.security.enabled=true` cho prod.

#### INF-02 — Prod compose publish MySQL ra host với mật khẩu dạng dễ đoán
- **Vị trí:** `docker-compose.prod.yml:12-13`; giá trị working-tree cho thấy mật khẩu root dạng default dễ đoán (đã che giá trị)
- **Mô tả:** MySQL publish `0.0.0.0:${MYSQL_HOST_PORT}` trong file prod; lớp bảo vệ duy nhất là password MySQL.
- **Tác động:** DB thương mại (user, đơn hàng, ví) tiếp xúc Internet.
- **Đề xuất fix:** Prod không cần expose MySQL: xoá `ports:` (db-seed/db-migrate chạy trong network nội bộ). Nếu cần debug: bind `127.0.0.1:` + VPN/SSH tunnel. Đổi mật khẩu hiện tại.

### P2 — 16 findings

#### FE-03 — postcss (transitive của next) dính 4 advisory
- **Vị trí:** `node_modules/next/node_modules/postcss` (≤ 8.5.22)
- **Mô tả:** XSS qua `</style>` chưa escape trong CSS stringify (GHSA-qx2v-qp2m-jg93); đọc file tùy ý qua `sourceMappingURL` (GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp); path traversal auto-load source map (GHSA-r28c-9q8g-f849).
- **Tác động:** Chủ yếu build-time/tooling; rủi ro thấp hơn FE-02 nhưng vẫn high theo npm.
- **Đề xuất fix:** Được vá khi nâng `next` (FE-02); hoặc override `postcss` ≥ 8.5.23 trong package.json.

#### FE-04 — sharp < 0.35.0 thừa kế lỗ hổng libvips
- **Vị trí:** `node_modules/sharp` (< 0.35.0), dùng runtime bởi Next Image Optimization
- **Mô tả:** CVE-2026-33327/33328/35590/35591 (GHSA-f88m-g3jw-g9cj) trên libvips.
- **Tác động:** Xử lý ảnh user/nguồn ngoài qua optimizer → crash/RCE tiềm năng tuỳ CVE.
- **Đề xuất fix:** Nâng `sharp` ≥ 0.35.0 (override nếu next pin cũ); giới hạn nguồn ảnh optimizer chỉ domain tin cậy (`images.remotePatterns`).

#### FE-05 — Thiếu `NEXT_PUBLIC_API_BASE_URL`, client fallback âm thầm về localhost
- **Vị trí:** `frontend/.env` (thiếu biến) → warning từ `src/config/env.ts:7-8`; fallback hardcode `src/services/api.ts:7,17` (`http://localhost:8000`), `api.ts:14` (`http://backend:8000`)
- **Mô tả:** Build in cảnh báo 2 lần `Missing NEXT_PUBLIC_API_BASE_URL`; `.env` không định nghĩa biến (comment nói biến được inject khi chạy Docker). Khi thiếu, client silent fallback localhost.
- **Tác động:** Build prod chạy ngoài Docker (hoặc container mất env) gọi API sai đích → app hỏng mạng im lặng; hardcode URL che giấu cấu hình sai tới tận runtime.
- **Đề xuất fix:** Thêm biến vào `.env`; fail-fast (throw) ở `config/env.ts` khi thiếu trong production thay vì warn rồi fallback.

#### FE-06 — Rò rỉ tài nguyên khi unmount giữa stream AI (không cleanup)
- **Vị trí:** `frontend/src/hooks/useAIChatStream.ts:68` (`abortControllerRef`), `:291-308` (AbortController + `requestAnimationFrame(flushChunks)`), `:310-380`; hook không có effect cleanup nào gọi `abort()`
- **Mô tả:** Component unmount giữa stream: không ai abort; rAF không cancel; callback `onTextChunk/onProducts/onEnd...` vẫn fire → setState trên component chết; SSE connection giữ mở đến hết stream.
- **Tác động:** Memory leak + network/CPU vô ích; mount lại tạo stream song song.
- **Đề xuất fix:** Thêm cleanup effect gọi `abortControllerRef.current?.abort()`, `cancelAnimationFrame`, `clearPolling()` (đẩy `chunkRaf` vào ref).

#### FE-08 — Số liệu thống kê admin bị "bịa" khi fetch stats fail
- **Vị trí:** `frontend/src/app/admin/statistics/page.tsx:48-222` (khối fallback), đặc biệt `:139-149` (`revenue: (p.soldCount || 0) * (p.minPrice || p.price || 100000)`), `:58` (`store.state.orders` có thể rỗng/stale)
- **Mô tả:** Khi `fetchAdminDetailedStats` fail, trang tự tính từ dữ liệu store client-side: doanh thu dùng hệ số mặc định **100.000đ** khi không có giá; đơn hàng lấy từ zustand store (phụ thuộc việc admin từng load); không cảnh báo UI rằng là số ước lượng.
- **Tác động:** Dashboard admin hiển thị con số sai im lặng → quyết định kinh doanh sai.
- **Đề xuất fix:** Banner "dữ liệu ước lượng" khi vào nhánh fallback; bỏ default 100000 (hiển thị "N/A"); ưu tiên endpoint tổng hợp thay vì đoán từ store.

#### BE-02 — Path traversal khi xóa PDF local qua `article.file_name`
- **Vị trí:** `backend/app/services/knowledge_base/kb_admin_service.py:305-311` (`delete_article`); input không sanitize tại `create_article` (:178) / `update_article` (:240)
- **Mô tả:** `save_pdf_to_storage` có sanitize tên file, nhưng 2 API JSON cho phép đặt `file_name` tùy ý (vd chứa `..`). Khi DELETE, `UPLOAD_DIR / article.file_name` không được resolve/validate trước `os.remove`.
- **Tác động:** Admin xác thực có thể xóa file tùy ý trong phạm vi quyền process app ngoài thư mục policies (thiếu defense-in-depth).
- **Đề xuất fix:** `resolved = file_path.resolve()` rồi kiểm tra `resolved.is_relative_to(UPLOAD_DIR.resolve())` trước remove; sanitize `data.file_name` như `save_pdf_to_storage` ở create/update.

#### BE-03 — Tool AI `recommend_similar_products` hỏng âm thầm do thiếu eager-load `seller`
- **Vị trí:** `backend/app/ai/tools.py:355` (truy cập `item.seller`) vs `:295-310` (stmt_rec chỉ selectinload images + variants.inventory); `app/models/catalog/product.py:112` (relationship lazy mặc định)
- **Mô tả:** Async SQLAlchemy raise `MissingGreenlet` khi truy cập relationship chưa load; khối `except Exception` (:394) nuốt lỗi, trả `{"error": ...}` cho LLM.
- **Tác động:** Nhánh gợi ý theo danh mục LUÔN fail âm thầm → agent mất khả năng gợi ý chính, chỉ còn fallback best-selling; feature chết tiệm tiến khó phát hiện.
- **Đề xuất fix:** Thêm `selectinload(Product.seller)` vào options của `stmt_rec`; kiểm tra fallback `get_recommended_products` eager-load đủ chưa.

#### BE-04 — `close_conversation` thiếu kiểm tra quyền
- **Vị trí:** `backend/app/api/chat/support_chat_api.py:533-547`
- **Mô tả:** Chỉ check `supporter_id != current_user.id` khi có supporter. Hội thoại OPEN trong hàng chờ (`supporter_id IS NULL`) thì BẤT KỲ user đăng nhập biết `conversation_id` đều đóng được — không check staff (so sánh `join_conversation` :493-496 có check role) và không check chủ hội thoại.
- **Tác động:** User độc hại rỗng hàng chờ support (DoS nghiệp vụ), đóng hội thoại người khác trái phép, log nhiễu.
- **Đề xuất fix:** Áp rule của `join_conversation`: chỉ ADMIN/MANAGER/SUPPORTER hoặc chính customer/guest owner được close.

#### BE-05 — Upload attachment chat đọc TOÀN BỘ file vào RAM trước khi check size
- **Vị trí:** `backend/app/services/common/azure_blob_service.py:64-72` (`_upload_blob`: `read()` rồi mới so `len(content)`), `:124-128` (`upload_document` tương tự)
- **Mô tả:** `UploadFile.read()` không giới hạn nạp toàn bộ body vào RAM. `utils/file_validator.read_upload_file_bounded` đã làm đúng streaming-bounded nhưng KHÔNG dùng cho đường upload chat.
- **Tác động:** Payload lớn (nhiều GB) qua `/conversations/{id}/upload` (cho phép guest!) → memory spike/OOM kill khi vài request đồng thời.
- **Đề xuất fix:** Dùng `read_upload_file_bounded` cho `_upload_blob`/`upload_document`, hoặc check size trước khi read.

#### INF-03 — Prod compose publish backend trực tiếp, bypass nginx
- **Vị trí:** `docker-compose.prod.yml:115-116`
- **Mô tả:** Backend publish `0.0.0.0:${BACKEND_HOST_PORT}` bypass nginx (TLS, rate-limit, security headers) — mâu thuẫn kiến trúc file base (không publish backend).
- **Tác động:** Client gọi API qua HTTP không mã hoá, né rate-limit/header của gateway.
- **Đề xuất fix:** Xoá `ports:` backend ở prod; frontend SSR đã gọi nội bộ `http://backend:8000`.

#### INF-04 — Duplicate router mount `/api/v1` (bug leftover API versioning)
- **Vị trí:** `backend/app/main.py:137-140` (`admin_kb_router`, `policy_router` include 2 lần: root + `prefix="/api/v1"`)
- **Mô tả:** Đã verify: cả 2 đường mount đều vẫn yêu cầu `CurrentAdmin` (không lộ auth); frontend chỉ gọi path gốc (rg 0 match cho `/api/v1`, `/policies`); external `/api/v1/policies` qua nginx còn bị strip `/api` → 404. Kết luận: BUG leftover một nửa làm versioning, KHÔNG chủ ý.
- **Tác động:** Admin API tồn tại song song 2 đường dẫn; OpenAPI docs nhân đôi, khó audit, rủi ro lệch cấu hình về sau.
- **Đề xuất fix:** Xoá 2 dòng include `prefix="/api/v1"` (:138, :140); hoặc nếu muốn versioning thật thì làm nhất quán toàn bộ API + cập nhật nginx.

#### INF-05 — StaticFiles `/uploads` phục vụ PDF chưa publish không cần auth
- **Vị trí:** `backend/app/main.py:130` (+ `services/knowledge_base/kb_admin_service.py:30,73`)
- **Mô tả:** Mount `/uploads` phục vụ toàn bộ `backend/uploads/` không auth; PDF KB lưu `uploads/policies/{slug}_{clean_name}` (tên suy đoán được từ slug + tên gốc) → PDF bài **chưa publish** vẫn tải được, bypass check `is_published`.
- **Tác động:** Rò rỉ tài liệu chính sách chưa phát hành nếu đoán được tên file; static route không có auth/rate-limit.
- **Đề xuất fix:** Mount static vào thư mục con không chứa private file, hoặc serve PDF qua endpoint có check `is_published`/quyền; đặt tên file UUID ngẫu nhiên.

#### INF-06 — Thiếu Content-Security-Policy ở nginx
- **Vị trí:** `nginx/conf.d/default.conf:69-72`
- **Mô tả:** Thiếu header CSP (có HSTS, XFO, XCTO, X-XSS).
- **Tác động:** XSS frontend (cf. FE-01) không được giảm thiểu bởi CSP; điểm trừ security scan chuẩn.
- **Đề xuất fix:** CSP tối thiểu `default-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'` rồi nới dần theo nhu cầu Next.js.

#### INF-07 — Dump SQL gần như full DB được track trong git
- **Vị trí:** `database/seed/backup.sql:1787` (+ `ecommerce_db_backup_20260811_224740.sql`)
- **Mô tả:** Dump chứa toàn bộ bảng `users` (tên, email, SĐT, ngày sinh, argon2 hash — nhiều user dùng chung 1 hash), kèm 1 record `password_reset_tokens` (token đã hết hạn 2026-07-22). Data test/demo nhưng dạng nhạy cảm.
- **Tác động:** Ai clone repo có dữ liệu cá nhân + hash để brute-force offline; tăng rủi ro nếu seed nhầm vào prod.
- **Đề xuất fix:** Thay bằng fixture faker cho seed; giữ dump thật ngoài git (private storage); xoá token reset khỏi dump; cân nhắc xoá khỏi history nếu repo từng chia sẻ rộng.

#### INF-08 — Connection string có password demo trong `.env.example` tracked
- **Vị trí:** `backend/.env.example:15`
- **Mô tả:** `DATABASE_URL` chứa username/password demo dạng quen thuộc trong file track.
- **Tác động:** Copy nguyên `.env.example` lên môi trường thật → credential yếu quen thuộc.
- **Đề xuất fix:** Ghi chú bắt buộc đổi password ngay đầu file; hoặc bỏ URL mẫu, hướng dẫn ghép từ biến rời.

#### RT-01 — Background task log search crash mỗi lần search có keyword — SearchLog không bao giờ được ghi
- **Vị trí:** `backend/app/services/search/search_log_service.py:29` (`from core.database import async_session_factory`; try bắt đầu line 30 nên import nằm NGOÀI try); trigger từ `backend/app/api/catalog/product_api.py:87-92`; symbol đúng trong `core/database.py:16` là `AsyncSessionLocal`
- **Mô tả:** ImportError ném xuyên qua Starlette BackgroundTasks ra uvicorn với full traceback "Exception in ASGI application" sau MỖI request GET /products?keyword=... Client vẫn nhận 200 vì response đã gửi xong. Đã verify runtime (docker logs).
- **Tác động:** Bảng SearchLog rỗng vĩnh viễn → `/search/hot-keywords` mãi trả 5 keyword hardcoded mặc định (verify runtime); tính năng hot-keywords chết âm thầm; log backend nhiễu ERROR mỗi lượt search.
- **Đề xuất fix:** Đổi thành `from core.database import AsyncSessionLocal` + `async with AsyncSessionLocal() as session:`; hoặc đưa import vào trong try.

### P3 — 37 findings

#### FE-07 — Race switch session giữa stream/polling (HẠ từ P2, cơ chế viết lại theo reviewer)
- **Vị trí:** `frontend/src/hooks/useAIChatStream.ts:104-109` (`clearPolling` dùng chung 1 timer toàn cục), `:111-196` (`loadHistoryWithPendingCheck`, :113 gọi `clearPolling()` đầu hàm), `:355-379` (`onError` gọi reload history của session cũ), `:394-408` (`switchChat`); đối chiếu guard `aiChatService.ts:313-315`
- **Mô tả (cơ chế điều chỉnh theo ruling reviewer):** Guard `AbortError` tại `aiChatService.ts:313-315` khiến việc abort chủ động khi `switchChat` chuyển session **không kích hoạt** `onError` — kịch bản ban đầu mô tả ("abort → onError fire → clearPolling giết timer session mới") về cơ bản bất khả thi. Race chỉ còn khả dĩ khi **SSE-error/mạng lỗi THẬT trùng đúng lúc** user switch session: `onError` của stream session cũ gọi `loadHistoryWithPendingCheck(oldSessionId)` → `clearPolling()` giết timer đang poll pending reply của session mới → bubble "Đang suy nghĩ..." treo. Ngoài ra `setInterval(async...)` (:139) không có cờ in-flight → poll chồng nhau khi fetch > 2s (guard ID nên chủ yếu lãng phí).
- **Ghi chú tranh luận (giữ nguyên văn 2 phía cho đợt fix đánh giá lại):** Người audit ban đầu xếp P2 với cơ chế "abort chủ động trigger onError"; reviewer phản chứng bằng code guard AbortError; controller quyết định hạ P3 + ghi nhận cả hai. Nếu guard AbortError không bao phủ mọi đường (ví dụ throw xảy ra trước khi vào guard), race gốc có thể sống sót — cần test thủ công khi fix.
- **Tác động:** UI kẹt loading/pending khi mạng lỗi thật trùng lúc chuyển nhanh session; hiếm, khó tái hiện.
- **Đề xuất fix:** Gắn poll timer theo sessionId (map); trong `onError` chỉ reload nếu `activeSessionIdRef.current === activeSessionId`; bỏ reload cho session cũ khi đã abort chủ động (check `signal.aborted`).

#### FE-09 — nanoid ≤ 3.3.17 (advisory prod ít ảnh hưởng)
- **Vị trí:** `node_modules/nanoid`
- **Mô tả:** GHSA-28wg-ghj8-5hjv / GHSA-2v37-7h3g-55p8 — generator loop vô hạn với size âm/zero.
- **Tác động:** Thấp — chỉ nguy hiểm nếu app tự gọi nanoid tham số động.
- **Đề xuất fix:** `npm audit fix` / nâng transitive dependency kéo nanoid.

#### FE-10 — Dependency dev-only: brace-expansion, js-yaml
- **Vị trí:** `node_modules/brace-expansion` (qua `@ts-morph/common`, eslint typescript-estree), `node_modules/js-yaml` 4.0.0–4.3.0
- **Mô tả:** brace-expansion ReDoS/OOM (GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895); js-yaml quadratic CPU CVE-2026-59870. Chỉ trên chuỗi dev-tooling.
- **Tác động:** Không vào bundle production; rủi ro developer/CI.
- **Đề xuất fix:** `npm audit fix` định kỳ.

#### FE-11 — Encode path param không nhất quán trong admin-api
- **Vị trí:** `frontend/src/services/admin-api.ts:235,239,243` (nối thẳng `${productId}`) so với `:230` (có `encodeURIComponent`)
- **Mô tả:** Id đến từ dữ liệu nội bộ nên rủi ro thấp; ký tự lạ trong id làm URL sai.
- **Tác động:** Request 404/lỗi khó hiểu nếu id chứa ký tự đặc biệt.
- **Đề xuất fix:** Bọc `encodeURIComponent(productId)` ở cả 3 chỗ.

#### FE-12 — a11y: img thiếu alt trong ChatWidget
- **Vị trí:** `frontend/src/components/ai/ChatWidget.tsx:722,780,803`
- **Mô tả:** `<img>` avatar shop / preview draft không có `alt`.
- **Tác động:** Screen reader đọc URL; vi phạm WCAG 1.1.1.
- **Đề xuất fix:** Thêm `alt` mô tả hoặc `alt=""` nếu trang trí.

#### FE-13 — React key dự phòng theo index
- **Vị trí:** `frontend/src/components/ai/ChatMessageList.tsx:23` (`key={msg.id || idx}`)
- **Mô tả:** Fallback `idx` khi id rỗng; id sinh bằng `Date.now()` (`useAIChatStream.ts:236,244,129`) — prefix khác nhau tránh trùng trong 1 lần gửi, nhưng `Date.now()` không đảm bảo unique.
- **Tác động:** Nếu trùng id → reuse nhầm DOM, glitch animation/state.
- **Đề xuất fix:** Sinh id bằng `crypto.randomUUID()` cho mọi message.

#### FE-14 — Side-effect trong state updater (updater không pure)
- **Vị trí:** `frontend/src/hooks/useAIChatStream.ts:431-441` (`deleteSession` gán biến bên trong `setChatSessions(prev => ...)`)
- **Mô tả:** Dùng state updater để "trả" giá trị ra ngoài; StrictMode gọi updater 2 lần, logic phụ thuộc thứ tự gọi.
- **Tác động:** Dễ vỡ khi refactor.
- **Đề xuất fix:** Tính `remaining` từ state hiện tại ngoài updater rồi set; quyết định switch/clear sau.

#### FE-15 — CSV export: escaping + memory leak + label sai
- **Vị trí:** `frontend/src/app/admin/statistics/page.tsx:299-367` — `:337-351` wrap `"${p.name}"` không escape `"`, `:354-365` `createObjectURL` không revoke, `:413` nút ghi "Xuất Excel" nhưng xuất `.csv`
- **Mô tả:** Tên chứa `"`/`,` hỏng CSV; ô bắt đầu `=`/`+`/`-` có thể CSV injection khi mở Excel; blob URL không giải phóng.
- **Tác động:** Export lỗi định dạng; rò rỉ nhớ nhỏ tích lũy; nhãn gây hiểu lầm.
- **Đề xuất fix:** Escape `"` → `""`, prefix `'` cho ô bắt đầu `=/+/-@`, `revokeObjectURL` sau click, đổi nhãn "Xuất CSV".

#### FE-16 — Type-safety suy yếu dù TS strict (`as any`, `Promise<any>`)
- **Vị trí:** `frontend/src/app/admin/products/page.tsx:105,115,204-205`; `[productId]/page.tsx:30,48-60,128,233,239,295-306,335-352`; `admin-api.ts:78,83,176,212-218`; `statistics/page.tsx:33,47,53`; `ChatWidget.tsx:130-133`
- **Mô tả:** Nhiều `(x as any)`, `useState<any>` — tắt kiểm tra kiểu tại biên API↔UI.
- **Tác động:** Đổi field API sẽ không bị typecheck bắt.
- **Đề xuất fix:** Định nghĩa interface payload admin, loại dần `as any`.

#### FE-17 — Hardcode external image fallback (Unsplash)
- **Vị trí:** `frontend/src/app/admin/products/[productId]/page.tsx:65`
- **Mô tả:** Fallback trỏ Internet thay vì asset nội bộ (`/placeholder.png` dùng nơi khác).
- **Tác động:** Chặn Unsplash → broken image trang admin; lệch chuẩn asset.
- **Đề xuất fix:** Dùng `/placeholder.png` hoặc asset trong `public/`.

#### FE-18 — Axios client không có timeout
- **Vị trí:** `frontend/src/services/api.ts:120-138` (`axios.create` không set `timeout`)
- **Mô tả:** Request qua `apiFetch` (gồm toàn bộ admin-api) có thể treo vô hạn khi backend treo.
- **Tác động:** UI kẹt loading mãi, không thông báo lỗi.
- **Đề xuất fix:** Set timeout 15–30s; upload/stream cấu hình riêng.

#### FE-19 — Stream AI dùng fetch riêng, ngoài luồng refresh-token
- **Vị trí:** `frontend/src/services/aiChatService.ts:243-251` (fetch trực tiếp + `credentials: "include"`) vs interceptor 401-refresh ở `api.ts:147-186`; tương tự `chat-ai-api.ts:28`
- **Mô tả:** Access token hết hạn → POST stream trả 401 không có logic refresh → hook hiển thị lỗi chung chung.
- **Tác động:** Phiên còn hiệu lực (refresh cookie ok) nhưng AI chat báo lỗi tới khi 1 API axios khác kích hoạt refresh.
- **Đề xuất fix:** Refresh trước khi stream khi nhận 401 (dùng chung refreshRequest singleton), hoặc đi qua axios adapter fetch.

#### FE-20 — Deep-link không dọn query params widget chat
- **Vị trí:** `frontend/src/components/ai/ChatWidget.tsx:345-356`
- **Mô tả:** Đọc `tab=SELLER&shop_id=...` từ URL mở widget nhưng không replaceState/xóa param.
- **Tác động:** Refresh widget tự bật lại; share link lộ ngữ cảnh.
- **Đề xuất fix:** `history.replaceState({}, "", pathname)` sau xử lý.

#### FE-21 — List admin fetch 500 bản ghi, filter/sort/pagination client-side
- **Vị trí:** `frontend/src/app/admin/products/page.tsx:16,66,98-143` (`PAGE_SIZE = 100`, `limit: 500`)
- **Mô tả:** Backend hỗ trợ sẵn `page/limit/search/status/category_id/sort_by` (`admin-api.ts:159-227`) nhưng UI tải 500 bản ghi về tự xử lý.
- **Tác động:** Chậm khi catalog lớn; dữ liệu chỉ chính xác tới mốc 500 gần nhất.
- **Đề xuất fix:** Chuyển search/filter/sort xuống server-side, dùng `totalPages` có sẵn.

#### FE-22 — setState sau unmount trong statistics + thiếu cleanup
- **Vị trí:** `frontend/src/app/admin/statistics/page.tsx:35-230` (`loadStats` nhiều await), `:232-234` (useEffect không cờ mounted/hủy)
- **Mô tả:** Rời trang giữa fetch (nhánh fallback chạy 4 request tuần tự) → setState trên component unmounted.
- **Tác động:** Lãng phí request; không crash nhưng là leak logic.
- **Đề xuất fix:** AbortController + check mounted trong `loadStats`.

#### BE-06 — Version drift: 19/22 package requirements.txt chưa ghim version
- **Vị trí:** `backend/requirements.txt:1-22`
- **Mô tả:** Chỉ 3 dòng có ràng buộc (sqlalchemy floor, cachetools floor, elasticsearch range). 19 dòng trống hoàn toàn. Top-5 rủi ro: python-jose (CVE-2024-33663/33664 ở bản cũ), langchain/langchain-openai (breaking change thường xuyên), fastapi/starlette, httpx, PyJWT.
- **Tác động:** Build không tái lập; `pip install -U` có thể vỡ API.
- **Đề xuất fix:** Ghim range hẹp (`fastapi~=0.115`, `pyjwt~=2.8`, `python-jose[cryptography]~=3.3`) + lockfile (pip-tools/uv).

#### BE-07 — JWT: không validate độ dài secret; truyền `algorithms` dạng string
- **Vị trí:** `backend/app/core/config.py:16`; `backend/app/services/auth/jwt_service.py:39,79`
- **Mô tả:** HS256 secret từ env không default → không phải yếu cứng nhắc, nhưng (1) không validator ép độ dài tối thiểu ≥32 bytes; (2) `decode_jwt_token` truyền `algorithms="HS256"` string thay vì list (PyJWT chấp nhận nhờ substring match — không phải lỗ hổng none, nhưng code smell).
- **Tác động:** Ops đặt secret ngắn → brute-force offline token khả thi; không chặn sớm lúc boot.
- **Đề xuất fix:** `field_validator("ACCESS_TOKEN_SECRET")` ép `len >= 32`; đổi thành `algorithms=[ALGORITHM]`.

#### BE-08 — N+1 queries cụm admin/public listing
- **Vị trí:** (a) `backend/app/api/admin/admin_api.py:443-455` (list_users → tới 201 queries với limit 200); (b) `admin_api.py:259-282` (top products: 2 query/product); (c) `admin_api.py:229-243` (monthly stats 12 query riêng); (d) `backend/app/api/catalog/product_api.py:156-161` (`/shops/featured` get_shop_stats từng shop ≤50 queries)
- **Mô tả:** Loop query trong response serialization thay vì join/group-by gộp.
- **Tác động:** Latency dashboard/listing tăng tuyến tính; tải DB thừa.
- **Đề xuất fix:** (a) eager-load roles 1 query IN; (b) GROUP BY product_id; (c) group theo tháng `func.date_format`; (d) materialize shop_stats/join gộp.

#### BE-09 — Race condition check-then-insert/update (chat)
- **Vị trí:** (a) `backend/app/api/chat/seller_chat_api.py:359-405` (`get_or_create_conversation` không unique constraint → 2 request song song tạo 2 hội thoại OPEN); (b) `backend/app/api/chat/support_chat_api.py:487-530` (join_conversation: 2 supporter claim đồng thời đều thấy NULL → double-assign)
- **Mô tả:** Thiếu khóa/unique/atomic update.
- **Tác động:** Trùng hội thoại; 2 supporter cùng nhận 1 ticket.
- **Đề xuất fix:** Unique index `(customer_id, shop_id)` cho hội thoại OPEN (bắt IntegrityError rồi fetch); claim bằng `UPDATE ... SET supporter_id=:uid WHERE id=:cid AND supporter_id IS NULL` + check rowcount.

#### BE-10 — Guest support chat tin tưởng tuyệt đối `guest_id` client-supplied
- **Vị trí:** `backend/app/services/chat/support_chat_ws.py:120-127`; `backend/app/api/chat/support_chat_api.py:69-92`
- **Mô tả:** Query param `guest_id` khớp là đọc/ghi toàn bộ hội thoại guest — không HMAC/signature/expiry.
- **Tác động:** guest_id đoán được → đọc toàn bộ nội dung hỗ trợ của khách khác.
- **Đề xuất fix:** Server cấp guest_id (UUID v4) kèm signed token ngắn hạn.

#### BE-11 — Upload attachment chat chỉ tin Content-Type/filename khai báo (MIME bypass)
- **Vị trí:** `backend/app/api/chat/support_chat_api.py:249-264`; `backend/app/services/common/azure_blob_service.py:74-84`
- **Mô tả:** Phân loại IMAGE/VIDEO/FILE dựa content_type client gửi; không magic bytes (trái chuẩn file_validator đặt cho KB PDF).
- **Tác động:** Lưu HTML/SVG/script dưới `image/*` lên blob public → phishing/storage abuse (không RCE trực tiếp).
- **Đề xuất fix:** Magic-byte check image/video/pdf; ép `content_settings.content_type` theo kết quả sniff.

#### BE-12 — ILIKE wildcard không escape trong fuzzy category search
- **Vị trí:** `backend/app/ai/catalog_search.py:104-106`
- **Mô tả:** An toàn SQLi (bind param) nhưng `%`/`_` user không escape → pattern matching tùy ý.
- **Tác động:** Pattern `%%%` quét toàn bảng category trong tier fuzzy (ảnh hưởng thấp — bảng nhỏ).
- **Đề xuất fix:** Escape `\ % _` trước khi wrap `%…%`.

#### BE-13 — Blocking I/O + tải toàn bộ dataset trong luồng async (embeddings/reindex)
- **Vị trí:** (a) `backend/app/ai/embeddings.py:41-54` (đọc jsonl cache đồng bộ trong request loop); (b) `backend/app/services/knowledge_base/kb_indexing_service.py:117-162` (`reindex_all_articles` load mọi article LONGTEXT + embed toàn bộ chunks 1 lần)
- **Mô tả:** Blocking file I/O chặn event loop; reindex không giới hạn bộ nhớ, dễ vượt rate/quota embedding API.
- **Tác động:** Đóng băng worker khi cache lớn; `/admin/knowledge-base/reindex` treo/OOM với kho tài liệu lớn.
- **Đề xuất fix:** Đọc cache bằng `asyncio.to_thread`/chunked lazy; reindex chia trang theo id, index theo lô article.

#### BE-14 — Fire-and-forget `asyncio.create_task` không giữ reference, không cap concurrency
- **Vị trí:** `backend/app/api/chat/chat_ai_api.py:163` (`generate_and_save` gồm LLM stream + persist DB)
- **Mô tả:** Reference task không lưu (rủi ro GC giữa chừng); không semaphore; không hủy dọn khi shutdown.
- **Tác động:** Thỉnh thoảng mất persist phản hồi AI; under load cao cạn connection pool.
- **Đề xuất fix:** Set nền + done-callback discard; bọc semaphore (~20); cân nhắc background queue cho persist.

#### BE-15 — Retry sau rate-limit giữa stream có thể phát text trùng lặp
- **Vị trí:** `backend/app/ai/service.py:486-544` (`stream_chat_message` retry reset state nhưng text đã yield không thu hồi)
- **Mô tả:** Stream đứng giữa chừng do 429 → attempt retry sinh lại từ đầu → client nhận đoạn đầu hai lần; metadata `full_text` (`chat_ai_api.py:87`) cộng dồn trùng.
- **Tác động:** Chat hiển thị văn bản lặp.
- **Đề xuất fix:** Chỉ retry khi chưa yield byte nào của turn; nếu đã yield thì kết thúc turn với thông báo lỗi.

#### BE-16 — Nuốt exception im lặng rải rác (`except Exception: pass`/trả rỗng)
- **Vị trí:** (a) `backend/app/ai/service.py:308-309,334-335,347-348`; (b) `kb_search_service.py:200-202`; (c) `catalog_search.py:245,271,291,315`; (d) `chat_ai_api.py:117-118`
- **Mô tả:** Graceful degradation hợp lý cho luồng AI nhưng quá rộng: lỗi cấu hình/DB/ES bị nuốt về cùng hành vi "không có kết quả".
- **Tác động:** Sự cố hạ tầng biểu hiện như "AI không tìm thấy gì", triage chậm; metric/alert không thấy error rate.
- **Đề xuất fix:** Thu hẹp scope except; structured-log ERROR cho case rỗng bất thường; circuit breaker.

#### BE-17 — Hygiene công cụ/migration/config
- **Vị trí:** (a) `backend/.venv/Scripts/alembic.exe` hỏng (exit 1 kể cả `--help`) — phải dùng `python -m alembic`; (b) `alembic/versions/a524958c1990_add_shipping_providers.py` và `3d929640a551_add_shipping_providers.py` trùng docstring; (c) migration `20260820_*`/`20260821_*` đặt filename theo date trong khi rev-id nội bộ khác — lệch convention; (d) `backend/app/core/config.py:33` — `AZURE_CONTAINER_NAME: str = None` sai type hint (phải `Optional[str]`)
- **Mô tả:** Vận hành/truy vết khó khăn; type hint sai误导 IDE/checker.
- **Tác động:** Người mới chạy alembic gặp exit 1 bí ẩn; tra cứu migration dễ nhầm 2 file shipping providers.
- **Đề xuất fix:** Rebuild venv tái tạo exe; đổi docstring phân biệt (base table vs junction); thống nhất tên file theo rev-id hoặc thêm comment map; sửa `Optional[str]`.

#### INF-09 — Regex CORS dev quá rộng + allow_credentials
- **Vị trí:** `backend/app/main.py:95,101`
- **Mô tả:** Dev allow_origin cho phép http/https mọi port trên toàn dải private IP (192.168/10/172.16-31) kết hợp `allow_credentials=True`. Chỉ active khi APP_ENV khác production/prod (cả 3 compose đều set production).
- **Tác động:** Dev trên LAN: bất kỳ trang/host nội bộ nào gửi request credentialed tới backend dev.
- **Đề xuất fix:** Thu hẹp regex `localhost|127.0.0.1` + whitelist port; cân nhắc tách allow_credentials theo origin.

#### INF-10 — Nginx `add_header` không kế thừa trong location có add_header riêng
- **Vị trí:** `nginx/conf.d/default.conf:102-108,125-129` (so với `:64,70-72`)
- **Mô tả:** Location `/_next/static/` và `/nginx-health` mất HSTS/XFO/XCTO do cơ chế inheritance của add_header.
- **Tác động:** Response các location này thiếu security headers (static asset: thấp nhưng không nhất quán).
- **Đề xuất fix:** Khai báo lại header trong location có add_header riêng, hoặc gom vào include chung.

#### INF-11 — nginx `client_max_body_size 50M` lớn hơn giới hạn backend nhiều nhất 20MB
- **Vị trí:** `nginx/conf.d/default.conf:67` vs `azure_blob_service.py:14-16` (max 30MB video), `file_validator.py:6` (PDF 25MB)
- **Mô tả:** Nginx nhận/buffer request tới 50MB trước khi backend từ chối.
- **Tác động:** Lãng phí băng thông, DoS nhẹ.
- **Đề xuất fix:** Giảm ~35M (30MB + margin); đồng bộ khi nâng limit backend.

#### INF-12 — seed.sh truyền mật khẩu MySQL qua command line
- **Vị trí:** `database/seed/seed.sh:12,25,37` (`-p"${MYSQL_PASSWORD}"`)
- **Mô tả:** Password xuất hiện trong process list (`ps`) bên trong container.
- **Tác động:** Rò rỉ credential cho user/process cùng container.
- **Đề xuất fix:** Dùng `MYSQL_PWD` env var hoặc `--defaults-extra-file` (chmod 600).

#### INF-13 — Compose `${VAR}` không có required-guard; fallback CORS prod là localhost
- **Vị trí:** `docker-compose.prod.yml:8-11,108-109` (tương tự 3 file)
- **Mô tả:** Không dùng `${VAR:?err}` cho secret bắt buộc; thiếu `CORS_ORIGINS` → CORS rơi về `http://localhost:*`.
- **Tác động:** Thiếu biến → compose chạy với giá trị rỗng/sai; CORS localhost với credentials.
- **Đề xuất fix:** `${MYSQL_ROOT_PASSWORD:?missing}` cho secret; xoá fallback localhost ở prod.

#### INF-14 — `ACCESS_TOKEN_SECRET` không validate độ mạnh; example chứa placeholder
- **Vị trí:** `backend/app/core/config.py:16` (+ `backend/.env.example`)
- **Mô tả:** Bắt buộc từ env nhưng không validate; example chứa placeholder dạng `dev-access-token-secret-change-me`. (Liên quan BE-07.)
- **Tác động:** Copy example nguyên bản lên prod → token ký bằng secret công khai → forge identity bất kỳ.
- **Đề xuất fix:** Startup check: khi APP_ENV=production, từ chối boot nếu secret ∈ danh sách placeholder hoặc len < 32.

#### INF-15 — Dev compose publish mysql/es/backend/frontend trên 0.0.0.0
- **Vị trí:** `docker-compose.dev.yml:12-13,39-40,119-120,147-148`
- **Mô tả:** Máy dev trong mạng chung (coworking/WiFi) expose DB + ES không auth.
- **Tác động:** Người cùng mạng truy cập MySQL/ES dev.
- **Đề xuất fix:** Bind `127.0.0.1:` cho tất cả port dev.

#### INF-16 — Header `Access-Control-Allow-Origin: *` hardcode trên response PDF public
- **Vị trí:** `backend/app/api/v1/policy_api.py:62-66`
- **Mô tả:** Header thủ công chồng chéo CORSMiddleware (`allow_credentials=True`).
- **Tác động:** Nhất quán CORS bị phá; trình duyệt có thể drop response khi credentials tham gia.
- **Đề xuất fix:** Bỏ header thủ công, để middleware xử lý.

#### RT-02 — WebSocket seller-chat 403 lặp lại liên tục cho guest session
- **Vị trí:** `WS /api/seller-chat/ws?as_seller=false` → 403 "connection rejected" (backend logs: 15 lần trong cửa sổ ~400 dòng); nguồn từ frontend container
- **Mô tả:** Frontend chưa đăng nhập mở WS chat, backend từ chối 403, reconnect liên tục không thấy backoff/circuit-breaker.
- **Tác động:** Noise log lớn khi nhiều guest; tiêu tài nguyên connection; khó phát hiện lỗi WS thật.
- **Đề xuất fix:** Frontend chỉ mở WS khi có auth session hợp lệ, hoặc exponential backoff + giới hạn retry khi 403.

#### RT-03 — EmailStr chặn TLD reserved (.local/.test) — ảnh hưởng test env
- **Vị trí:** `POST /auth/register` (pydantic EmailStr validate tại `backend/app/schemas/auth/auth_schema.py:34`) — 422 "special-use or reserved name"
- **Mô tả:** email-validator từ chối mọi reserved name. Không phải bug sản phẩm (hành vi đúng chuẩn); smoke test chuyển sang domain hợp lệ và pass ngay.
- **Tác động:** Chỉ friction cho automation test nếu dùng .local/.test; user cuối không ảnh hưởng.
- **Đề xuất fix:** Cập nhật convention tài liệu test: dùng subdomain hợp lệ không nằm trong danh sách chặn.

---

## 4. Top ưu tiên hành động cho đợt fix

1. **P0 — ngay lập tức:**
   - FE-01: sanitize markdown AI chat (escape/DOMPurify) + rà admin chat viewer. Đây là XSS internet-facing có đường leo thang admin — sửa trước tiên.
2. **P1 — ngay sau đó:**
   - BE-01: thêm ownership check trong `get_or_create_session` (IDOR chat AI).
   - INF-01 + INF-02 + INF-03: gỡ publish MySQL/Elasticsearch/backend khỏi `docker-compose.prod.yml` (prod không cần expose ra host) và rotate mật khẩu DB hiện tại.
   - FE-02 (+FE-03, FE-04 đi kèm): nâng Next.js ≥ 16.2.11, override sharp ≥ 0.35.0 / postcss ≥ 8.5.23, regression test middleware + server actions.
3. **P2 — tuần kế tiếp:**
   - RT-01 (fix 1 dòng import SearchLog), INF-05 (khoanh vùng static `/uploads`), INF-06 (CSP), INF-07 (thay seed dump bằng fixture), INF-08 (password demo trong .env.example), INF-04 (gỡ duplicate router `/api/v1`), BE-02 (path traversal delete PDF), BE-03 (eager-load seller cho tool gợi ý), BE-04 (authz close_conversation), BE-05 (bounded upload chat), FE-05 (env fail-fast), FE-06 (cleanup stream unmount), FE-08 (banner dữ liệu ước lượng statistics).
4. **P3 — hardening dần:** theo danh sách mục 3 (dependency pinning + lockfile, secret validators, N+1, race chat, MIME sniff, timeout, a11y, hygiene...). Riêng FE-07 cần test thủ công tái hiện trước khi quyết hướng fix (xem ghi chú tranh luận).

Lưu ý xuyên suốt: LLM key và Azure Blob đã xác nhận cấu hình hoạt động ở runtime — các fix nhóm AI/upload không được dựa trên giả định thiếu credential.

---

## 5. Phụ lục — Những gì KHÔNG test được / không phát hiện vấn đề

### 5.1 Giới hạn phạm vi của đợt audit
- Không test E2E sâu theo luồng nghiệp vụ; không deep-dive business flow wallet/order end-to-end — audit tĩnh chỉ rà nhanh các điểm `with_for_update()` ở wallet/inventory/payment (BE: không phát hiện race ở các điểm này, nhưng chưa verify end-to-end).
- Không đọc giá trị `.env` thật (tránh phơi secret) → độ mạnh thực tế của `ACCESS_TOKEN_SECRET` chưa kiểm chứng (BE-07, INF-14 đánh giá theo code, không theo giá trị).
- Không thực thi `alembic upgrade` lên DB thật (audit offline: history/heads + kiểm tra chéo 26 revision files thủ công).
- `main.py` chỉ được review ở tầng hạ tầng/cấu hình (INF) — backend auditor không deep-dive CORS/settings theo biên giới phân công.
- Upload Azure Blob service chỉ review ở mức phục vụ findings BE-05/BE-11 — toàn bộ service không nằm trong vùng nóng.
- Không load/perf testing, không test thiết bị di động.

### 5.2 Runtime smoke — không test được và lý do
- **Frontend console/browser rendering:** không bắt được qua curl (giới hạn công cụ) — thay thế bằng HTTP status check 4 trang chính (/ , /products , /login , /admin): đều 200.
- **Verify email flow:** không cần thiết — register cho login luôn không yêu cầu verify; không tìm token từ mail box (không SMTP catch-all trong scope).
- **Thanh toán VNPAY/thực:** chỉ test COD; payment gateway external ngoài phạm vi smoke.
- **Upload video/file lớn:** chỉ spot-check `/upload/image` đại diện (Azure credential xác nhận hoạt động).
- Test data đã tạo trong lúc smoke (theo phép của brief): user id=83 (`audit-smoke+...@audit-smoke.dev`), address id=48, cart item id=103, order `ORD-AA027F5E1B07`, 1 file PNG test trên Azure Blob.

### 5.3 Các mục checklist đã kiểm — KHÔNG phát hiện vấn đề

**Frontend (FE):** `tsc --noEmit` pass 0 lỗi (TS strict); không còn import/route treo tới 2 file policies đã xóa (grep toàn frontend: 0 match); `next build` thành công toàn bộ 57 route; không hardcode secret/token trong vùng nóng (auth qua cookie); không có React key trùng thực tế (chỉ rủi ro lý thuyết → FE-13).

**Backend (BE):** compileall exit 0; single alembic head, chuỗi tuyến tính 26 revisions liền mạch; migration mới nhất đều có model khớp (order_returns/DELIVERED/COD, knowledge_base_articles); không phát hiện SQL injection (query SQLAlchemy parameterized); không `eval/exec/pickle.loads/yaml.load` unsafe; không secret hardcode; JWT pin HS256 + require claims + verify iss/aud (không `none`); không `debug=True`/`print(` lộ dữ liệu; toàn bộ endpoint admin KB/admin_api dùng `CurrentAdmin` (gap duy nhất thuộc support chat → BE-04); tool AI đơn hàng luôn filter `user_id` (không IDOR qua AI).

**Hạ tầng (INF):** không có file `.env` thật nào từng được commit (toàn bộ git history chỉ có 3 `.env.example`); không pattern `sk-*`/`AKIA*`/`PRIVATE KEY` trong tracked files; compose/scripts không secret hardcode; deploy/init-ssl/renew-ssl/entrypoint/seed.sh đều có `set -e(-uo pipefail)`; cả 3 compose file validate pass; base compose không publish MySQL/ES/Redis/backend ra host, Redis không bao giờ publish ở cả 3 file; tất cả service long-running có healthcheck; volume mount hợp lý; nginx có redirect HTTP→HTTPS, HSTS, TLSv1.2/1.3, ssl_session_tickets off, WebSocket upgrade headers; middleware auth không có danh sách bypass route, các admin route được audit đều gắn dependency bảo vệ (kể cả bản duplicate INF-04).

### 5.4 Minor deferred từ các report nguồn (minh bạch quy trình)
- Report T2 không đính kèm raw log tsc/audit/build (kết quả đã được reviewer verify); cách diễn đạt "9 high" đã hiệu chỉnh thành "9 advisories (GitHub chấm 4 High / 5 Moderate)" trong FE-02.
- T4 chưa kiểm độc lập publish claims của base docker-compose.yml (checklist T4 ghi nhận base compose sạch nhưng chưa cross-check độc lập).
- RT-02 đếm 403 WS không kèm log nguyên văn (số liệu từ scan cửa sổ log ~400 dòng).

— Hết báo cáo —
