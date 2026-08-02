# Tích hợp Elasticsearch cho Thanh Tìm Kiếm Thông Minh

## Bối cảnh (Context)

Dự án **Shepoo E-Commerce** sử dụng **MySQL** (qua SQLAlchemy `asyncmy`) làm cơ sở dữ liệu chính.

**Hiện trạng tìm kiếm Backend:**
- API `GET /products` nhận tham số `keyword` và tìm bằng SQLAlchemy `.ilike()` (MySQL dịch thành `LOWER(col) LIKE LOWER(pattern)`) trên 2 trường: `Product.name` và `Product.short_description`.
- Không hỗ trợ tìm theo tên Shop, không có khả năng sửa lỗi chính tả (typo tolerance), không có cơ chế tính điểm liên quan (relevance scoring).

**Hiện trạng tìm kiếm Frontend:**
- Component `Navbar` có sẵn thanh tìm kiếm (`SearchField`) và hộp thoại Dropdown gợi ý.
- Hàm `searchSuggestions()` trong `@/lib/helpers.ts` thực hiện tìm kiếm **client-side** bằng `String.includes()` trên dữ liệu thật (products, shops, categories đã được fetch từ Backend và lưu trong Zustand Store). Hàm này trả về tối đa 8 kết quả thuộc 3 loại: **Sản phẩm** (tối đa 4), **Shop** (tối đa 3), **Danh mục** (tối đa 3). Mỗi kết quả có cấu trúc `{ label, href, type }`.
- Khi chưa gõ gì (chỉ focus vào ô search), Dropdown hiển thị danh sách "Từ khóa hot hôm nay" dạng tag cứng (hardcoded): `["iPhone 15 Pro", "Tai nghe Bluetooth", "Áo Nam Basic", "Bàn Phím Cơ", "Mỹ Phẩm Korea"]`.
- **Không có debounce** — hàm `searchSuggestions()` được gọi đồng bộ mỗi khi state `query` thay đổi (mỗi lần gõ phím).
- Khi user ấn Enter, chuyển hướng sang `/search?q=...` → Component `ProductListing` gọi API `GET /products` với tham số `keyword`.

## Mục tiêu (Goals)

1. Triển khai **Elasticsearch 8.x** (Single Node qua Docker) làm Search Engine chuyên dụng.
2. Hỗ trợ **tìm kiếm sai chính tả** (typo tolerance via Fuzzy matching + Levenshtein distance).
3. Hỗ trợ **gợi ý từ khóa thời gian thực** kiểu Shopee — Dropdown chỉ hiển thị **danh sách từ khóa dạng text** (không hiện thẻ sản phẩm có ảnh/giá). User click gợi ý hoặc ấn Enter → chuyển sang trang kết quả `/search?q=...`.
4. Tìm kiếm trên **nhiều trường**: tên sản phẩm, tên shop, mô tả ngắn sản phẩm.
5. Hỗ trợ **tiếng Việt không dấu** — gõ `"dien thoai"` tìm được `"Điện thoại"` (ASCII Folding).
6. **Xếp hạng thông minh (Popularity Boosting)** — sản phẩm bán chạy hơn (`sold_count`) và đánh giá tốt hơn (`average_rating`) được ưu tiên hiển thị cao hơn trong trang kết quả tìm kiếm.
7. **Lịch sử tìm kiếm cá nhân** — lưu lịch sử vào **`localStorage`** của trình duyệt (không cần đăng nhập), hiển thị khi focus vào ô search.
8. **Từ khóa hot động (Dynamic Hot Keywords)** — thay danh sách tag cứng bằng top từ khóa được tìm nhiều nhất trong 24h (truy vấn bảng `SearchLog`).
9. Tận dụng tối đa giao diện UI hiện có (Navbar Dropdown, ProductListing), không cần đập đi xây lại.

## Kiến trúc Hệ thống (Architecture)

```
MySQL (Primary DB)  ──BackgroundTasks──▸  Elasticsearch (Search Engine)
       │                                          │
       │ (ghi dữ liệu)                           │ (đọc tìm kiếm)
       ▼                                          ▼
   FastAPI Backend  ◂────────────────────  FastAPI Backend
       │                                          │
       ▼                                          ▼
  Seller APIs (CRUD)                    GET /products/autocomplete
                                        GET /products?keyword=...
```

1. **MySQL** vẫn là nguồn chân lý duy nhất (Primary Database) cho toàn bộ dữ liệu sản phẩm.
2. **Elasticsearch** đóng vai trò "cỗ máy đọc" (read-optimized), chỉ phục vụ truy vấn tìm kiếm.
3. **Đồng bộ dữ liệu**: Sử dụng `FastAPI BackgroundTasks` để đồng bộ từ MySQL sang Elasticsearch mỗi khi có thao tác tạo / cập nhật / xóa sản phẩm qua Seller APIs. API chính không bị chậm vì đồng bộ chạy ngầm.

## Hạ tầng Docker

Thêm service `elasticsearch` vào `docker-compose.dev.yml` và `docker-compose.yml`:
- Image: `elasticsearch:8.17.0` (hoặc bản 8.x mới nhất ổn định).
- Chạy **Single Node** (`discovery.type=single-node`).
- Tắt xác thực (`xpack.security.enabled=false`) cho môi trường dev.
- Giới hạn RAM: `ES_JAVA_OPTS=-Xms512m -Xmx512m` để không làm nặng máy dev.
- Volume: `es_data_dev` để giữ dữ liệu index khi restart container.
- Service `backend` thêm biến môi trường `ELASTICSEARCH_URL=http://elasticsearch:9200` và `depends_on` service elasticsearch.

## Cấu trúc Dữ liệu Elasticsearch (Index Mapping)

### Index: `products`

Mỗi sản phẩm từ MySQL được chuyển thành 1 document JSON:

```json
{
  "id": 123,
  "public_id": "abc-xyz-123",
  "name": "Điện thoại iPhone 15 Pro Max",
  "slug": "dien-thoai-iphone-15-pro-max",
  "shop_name": "Apple Official Store",
  "shop_slug": "apple-official-store",
  "shop_logo_url": "https://...",
  "short_description": "Chip A17 Pro, Titan tự nhiên, Camera 48MP",
  "min_price": 25000000,
  "thumbnail_url": "https://...",
  "category_slugs": ["dien-thoai", "apple"],
  "status": "ACTIVE",
  "sold_count": 150,
  "average_rating": 4.8,
  "review_count": 42,
  "created_at": "2026-07-15T10:00:00Z"
}
```

### Custom Analyzer: `autocomplete_analyzer`

Sử dụng **Edge N-gram** tokenizer (min_gram=2, max_gram=20) để Elasticsearch tự động băm chữ khi lưu trữ:
- Ví dụ: "iPhone" → `ip`, `iph`, `ipho`, `iphon`, `iphone`
- Nhờ vậy, ngay khi khách gõ `iph`, hệ thống đã tìm thấy kết quả.

Bộ lọc (Filter chain) của analyzer:
1. `lowercase` — chuyển tất cả về chữ thường.
2. **`asciifolding`** — loại bỏ dấu tiếng Việt: `điện thoại` → `dien thoai`. Đây là bộ lọc quan trọng nhất để hỗ trợ tìm kiếm không dấu.
3. `edge_ngram` — băm chữ từ đầu chuỗi.

Trường `name`, `shop_name`, `short_description` sẽ được map với 2 analyzer:
- `autocomplete_analyzer` (dùng khi indexing) — để băm chữ + bỏ dấu sẵn.
- `autocomplete_search_analyzer` (dùng khi searching) — chỉ `lowercase` + `asciifolding`, không băm n-gram, để khớp nguyên cụm từ khách gõ.

### Truy vấn chống sai chính tả (Fuzzy Query)

Kích hoạt `fuzziness: "AUTO"` trong truy vấn `multi_match`. Elasticsearch sẽ tính toán khoảng cách Levenshtein và tự hiểu "iphoen" = "iphone".

Trọng số ưu tiên (boosting): `name^3` > `shop_name^2` > `short_description^1`.

### Xếp hạng thông minh (Popularity Boosting)

Sử dụng `function_score` query để kết hợp điểm khớp từ khóa (text relevance) với các yếu tố phổ biến:
- **`sold_count`**: Sử dụng `field_value_factor` với `modifier: "log1p"` — sản phẩm bán chạy hơn được boost nhẹ, nhưng không để sản phẩm bán 10.000 đơn lấn át hoàn toàn kết quả khớp từ khóa tốt hơn.
- **`average_rating`**: Sử dụng `field_value_factor` với `modifier: "none"`, `factor: 0.5` — sản phẩm đánh giá cao được ưu tiên nhẹ.
- Công thức kết hợp: `score_mode: "sum"`, `boost_mode: "multiply"`.

## Thiết kế API (FastAPI)

*Router prefix hiện tại: `prefix=""` (không có `/api/`). Thư viện Python: `elasticsearch[async]` (official Elastic client, thêm vào `requirements.txt`).*

### [NEW] `GET /products/autocomplete?q=...`

- **Mục đích**: Phục vụ Dropdown gợi ý từ khóa (kiểu Shopee) khi user đang gõ.
- **Tham số**: `q` (string, từ khóa tìm kiếm, tối thiểu 1 ký tự).
- **Logic**:
  1. **Gợi ý từ khóa sản phẩm**: Truy vấn Elasticsearch trên trường `name` với Edge N-gram + Fuzzy, lấy tên sản phẩm khớp nhất, rồi trích xuất thành các cụm từ khóa gợi ý (tối đa 8).
  2. **Gợi ý tìm Shop**: Truy vấn riêng trên trường `shop_name`. Nếu có shop khớp, thêm 1 dòng đặc biệt `"Tìm Shop 'từ khóa'"` ở vị trí đầu tiên.
- **Response**: Danh sách từ khóa dạng text thuần — **không có** hình ảnh, giá tiền, hay link sản phẩm.

```json
{
  "suggestions": [
    { "keyword": "Tìm Shop \"áo thun\"", "type": "shop", "shop_slug": "ao-thun-store" },
    { "keyword": "áo thun nam", "type": "keyword" },
    { "keyword": "áo thun nam form rộng", "type": "keyword" },
    { "keyword": "áo thun boxy", "type": "keyword" },
    { "keyword": "áo thun local brand", "type": "keyword" },
    { "keyword": "áo thun polo nam", "type": "keyword" }
  ]
}
```

**Chiến lược trích xuất từ khóa gợi ý:**
Elasticsearch trả về danh sách sản phẩm khớp (ví dụ: `"Áo thun nam basic cotton"`, `"Áo thun nam form rộng oversize"`, `"Áo thun polo nam"`).
Backend sẽ trích xuất **tên sản phẩm đã được lowercase + loại bỏ phần thừa** để tạo danh sách gợi ý tự nhiên. Nếu nhiều sản phẩm cùng bắt đầu bằng cụm từ giống nhau, nhóm lại thành 1 gợi ý.

### [NEW] `GET /search/hot-keywords`

- **Mục đích**: Trả về danh sách từ khóa được tìm nhiều nhất trên toàn sàn trong 24h qua.
- **Logic**: Truy vấn bảng `SearchLog`, GROUP BY `keyword`, COUNT(*) DESC, lọc `created_at >= NOW() - 24h`, lấy tối đa 8 từ khóa. Nếu không đủ 8 (sàn mới ít dữ liệu), fallback về danh sách mặc định.
- **Không yêu cầu đăng nhập** (public API).
- **Response**:

```json
{
  "keywords": ["iPhone 15 Pro", "Tai nghe Bluetooth", "Áo Nam Basic"]
}
```

*Lưu ý: Lịch sử tìm kiếm cá nhân được quản lý hoàn toàn trên Frontend bằng `localStorage`, không cần API riêng. Xem phần Thiết kế Giao diện.*

### [UPDATE] `GET /products?keyword=...`

- **Thay đổi**: Khi tham số `keyword` được truyền vào, chuyển sang truy vấn Elasticsearch (với `function_score` + Popularity Boosting) để lấy danh sách `product_id`, sau đó query MySQL với danh sách ID đó (giữ nguyên logic phân trang, sorting, filtering hiện tại).
- **Ghi SearchLog**: Khi tìm kiếm thành công, ghi 1 bản ghi vào bảng `SearchLog` (keyword, user_id nếu có, result_count) qua BackgroundTasks.
- **Fallback**: Nếu Elasticsearch không khả dụng (container chưa khởi động, lỗi kết nối), tự động fallback về tìm kiếm MySQL `ilike` như cũ.

## Thiết kế Giao diện (Next.js)

### Navbar Dropdown — Kiểu Shopee (Keyword Suggestions)

Thiết kế lại Dropdown theo đúng phong cách Shopee: **chỉ hiển thị từ khóa dạng text**, không hiện thẻ sản phẩm có ảnh/giá.

**Khi user đang gõ từ khóa:**

1. **Thay đổi nguồn dữ liệu**: Thay hàm `searchSuggestions()` (client-side filtering) bằng gọi API `GET /products/autocomplete?q=...`.
2. **Thêm debounce 300ms**: Chỉ gọi API sau khi user ngừng gõ 300ms.
3. **Cấu trúc Dropdown khi có kết quả**:
   - **Dòng đầu tiên (nếu có shop khớp)**: Icon 🏪 + `"Tìm Shop 'từ khóa'"` → click chuyển đến `/shops/{shop_slug}`.
   - **Các dòng tiếp theo**: Icon 🔍 + từ khóa gợi ý dạng text thuần → click sẽ set `query` = keyword đó và chuyển hướng sang `/search?q=keyword`.
4. **Điều hướng bàn phím**: User dùng phím `↑↓` để di chuyển giữa các gợi ý, `Enter` để chọn gợi ý đang highlight hoặc tìm kiếm với từ khóa đã gõ.
5. **Thêm trạng thái loading**: Hiển thị spinner nhỏ khi đang chờ API.

**Mockup Dropdown (khi gõ "áo thun"):**
```
┌──────────────────────────────────┐
│ 🏪  Tìm Shop "áo thun"          │  ← link đến /shops/ao-thun-store
│──────────────────────────────────│
│ 🔍  áo thun nam                  │  ← link đến /search?q=áo thun nam
│ 🔍  áo thun nam form rộng        │
│ 🔍  áo thun boxy                 │
│ 🔍  áo thun local brand          │
│ 🔍  áo thun polo nam             │
│ 🔍  áo thun tay dài              │
│ 🔍  áo thun lạnh                 │
└──────────────────────────────────┘
```

### Dropdown khi chưa gõ (Focus state)

Khi user click vào ô search nhưng chưa gõ gì, Dropdown hiển thị 2 phần:

1. **Lịch sử tìm kiếm gần đây** (lưu trên `localStorage`, không cần đăng nhập):
   - Mỗi khi user thực hiện tìm kiếm (ấn Enter hoặc click gợi ý), lưu keyword vào `localStorage` key `search_history` (mảng tối đa 10 items, LIFO).
   - Hiển thị dạng danh sách với icon 🕐, mỗi item click sẽ set `query` = keyword đó và chuyển hướng sang `/search?q=keyword`.
   - Có nút "X" để xóa từng keyword và nút "Xóa tất cả" để clear toàn bộ lịch sử.
   - Dữ liệu nằm hoàn toàn trên client, không cần gọi API.

2. **Từ khóa hot hôm nay** (luôn hiển thị):
   - Gọi API `GET /search/hot-keywords` khi component mount.
   - Thay thế danh sách tag cứng `["iPhone 15 Pro", ...]` bằng dữ liệu động từ API.
   - Giữ nguyên UI dạng tag pills hiện tại.

**Mockup Dropdown (khi focus, chưa gõ):**
```
┌──────────────────────────────────┐
│ 🕐  Lịch sử tìm kiếm   [Xóa ↗] │
│   🕐  iPhone 15 Pro          ✕  │
│   🕐  tai nghe bluetooth     ✕  │
│   🕐  áo nam basic           ✕  │
│──────────────────────────────────│
│ 🔥  Từ khóa hot hôm nay         │
│  [iPhone 15 Pro] [Bàn Phím Cơ]  │
│  [Tai nghe BT]  [Mỹ Phẩm Korea] │
└──────────────────────────────────┘
```

### Trang kết quả tìm kiếm (`/search?q=...`)

- Component `ProductListing` đã gọi `fetchPublicProducts({ keyword })` → API `GET /products`.
- Không cần sửa Frontend ở đây — chỉ cần Backend cập nhật logic API `GET /products` để dùng Elasticsearch là trang kết quả tự động được hưởng lợi (Popularity Boosting, Fuzzy match, tiếng Việt không dấu).

## Module Backend mới

### `backend/app/core/elasticsearch.py`
- Khởi tạo `AsyncElasticsearch` client.
- Đọc `ELASTICSEARCH_URL` từ biến môi trường.
- Hàm `get_es_client()` trả về singleton client.

### `backend/app/services/search_service.py`
- `create_products_index()`: Tạo index `products` với mapping và custom analyzer (bao gồm `asciifolding`).
- `index_product(product_data)`: Đẩy 1 document sản phẩm vào Elasticsearch.
- `delete_product_from_index(product_id)`: Xóa 1 document khỏi index.
- `search_autocomplete(query, limit=8)`: Truy vấn Elasticsearch, trích xuất danh sách **từ khóa gợi ý** từ tên sản phẩm khớp. Truy vấn riêng `shop_name` để tạo gợi ý "Tìm Shop".
- `search_products(query, limit=20)`: Truy vấn tìm kiếm đầy đủ với Popularity Boosting, trả về danh sách product IDs.
- `bulk_index_products(products)`: Đẩy hàng loạt sản phẩm (dùng cho lần đồng bộ đầu tiên).

### `backend/app/services/search_log_service.py`
- `get_hot_keywords(hours=24, limit=8)`: Truy vấn `SearchLog` GROUP BY keyword, COUNT DESC, lọc trong khoảng thời gian chỉ định.
- `log_search(keyword, user_id, result_count)`: Ghi 1 bản ghi vào `SearchLog`.

*Lưu ý: Lịch sử tìm kiếm cá nhân được quản lý hoàn toàn trên Frontend (`localStorage`), nên không cần hàm `get_user_search_history` hay `delete_user_search_keyword` ở Backend.*

### Cập nhật Seller Product APIs
- Trong các hàm tạo / cập nhật / xóa sản phẩm ở `seller_product_api.py`, thêm `BackgroundTasks` để gọi `index_product()` hoặc `delete_product_from_index()` sau khi thao tác MySQL thành công.

### Cập nhật App Startup (`main.py`)
- Trong `lifespan`, thêm logic: khi app khởi động, kiểm tra và tạo index Elasticsearch nếu chưa tồn tại, sau đó chạy `bulk_index_products()` để đồng bộ toàn bộ sản phẩm ACTIVE từ MySQL sang Elasticsearch.

## Kế hoạch Xác minh (Verification Plan)

1. **Kiểm tra Docker**: Elasticsearch container khởi động thành công, truy cập `http://localhost:9200` trả về thông tin cluster.
2. **Kiểm tra Index**: Sau khi Backend khởi động, gọi `GET http://localhost:9200/products/_mapping` xác nhận mapping đúng (bao gồm `asciifolding` trong analyzer).
3. **Kiểm tra Autocomplete (typo)**: Gọi `GET /products/autocomplete?q=iphne` (gõ sai), xác nhận trả về gợi ý từ khóa liên quan đến iPhone.
4. **Kiểm tra Tiếng Việt không dấu**: Gọi `GET /products/autocomplete?q=dien thoai` (không dấu), xác nhận trả về gợi ý liên quan đến "Điện thoại".
5. **Kiểm tra gợi ý Shop**: Gọi `GET /products/autocomplete?q=apple`, xác nhận dòng đầu tiên là `"Tìm Shop 'apple'"` (nếu có shop tên Apple).
6. **Kiểm tra Popularity Boosting**: Trên trang `/search?q=tai nghe`, xác nhận sản phẩm bán chạy nhất xuất hiện trước sản phẩm ít bán hơn.
7. **Kiểm tra Lịch sử tìm kiếm (localStorage)**: Tìm vài từ khóa → focus lại ô search → xác nhận Dropdown hiển thị lịch sử. Xóa 1 keyword → xác nhận biến mất. Clear localStorage → xác nhận lịch sử trống.
8. **Kiểm tra Hot Keywords**: Gọi `GET /search/hot-keywords`, xác nhận trả về danh sách từ khóa (động hoặc fallback mặc định).
9. **Kiểm tra Fallback**: Tắt container Elasticsearch, gọi `GET /products?keyword=iphone`, xác nhận vẫn trả về kết quả (fallback MySQL).
10. **Kiểm tra Frontend E2E**: Gõ từ khóa → Dropdown hiện từ khóa gợi ý (không phải thẻ sản phẩm) → click gợi ý → chuyển sang `/search?q=...` → trang hiển thị sản phẩm đầy đủ.
