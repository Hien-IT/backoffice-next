# Data Model: Đóng gói triển khai (019)

Feature không thêm bảng, cột hay khóa Redis. Mô hình dưới đây là các đối tượng cấu hình và quan hệ của chúng.

## Instance

| Thuộc tính | Giá trị |
|------------|---------|
| loại | `backoffice-api` (image BE) hoặc `directus` (image Directus 11.17.4) |
| env | bộ cấu hình dùng chung; chế độ domain riêng đặt riêng `PUBLIC_URL` cho bản Backoffice (FR-071) |
| cổng | 8055 |
| trạng thái | `starting` → `ready` (health ≠ `error`) → `draining` (sau SIGTERM hoặc `preStop`) → `stopped` (mã 143) |
| thuộc pool | có khi pod/container mang nhãn pool (chart) hoặc nằm trong upstream `api_pool` (compose) |

Chuyển trạng thái:

- `starting` → `ready`: kết nối DB, Redis xong, kiểm migration đạt (001); startup probe `/server/ping` đạt rồi readiness
  `/server/health` đạt.
- `ready` → `draining`: `preStop` bắt đầu (Kubernetes) hoặc SIGTERM (compose). Trong `preStop`, instance vẫn nhận request;
  sau SIGTERM, health trả `error`, listener đóng, request dở chạy tối đa `SERVER_SHUTDOWN_TIMEOUT`.
- `draining` → `stopped`: đóng DB, Redis, job; thoát mã 143.
- `starting` → thoát mã 1: migration lệch (DB chưa bootstrap); Kubernetes khởi động lại, compose chờ Directus healthy trước.

## Bộ cấu hình dùng chung

- Nguồn: `.env` (compose), ConfigMap + Secret của Directus (Kubernetes).
- Một nguồn cho mọi instance; FE nhận phần không bí mật (ConfigMap) và chỉ đọc `PUBLIC_URL`, `CONTENT_SECURITY_POLICY_*`.
- Ràng buộc đa replica (cảnh báo của 001 nếu sai): có Redis; `CACHE_STORE`, `RATE_LIMITER_STORE` không phải `memory`;
  storage `s3` hoặc `local` trên volume dùng chung.

## Pool API

- Chung domain: replica BE + instance Directus có nhãn pool; nhận mọi path trừ `/admin`.
- Domain riêng: chỉ replica BE của bản Backoffice.
- Không sticky session.

## Bản triển khai (release)

| Thuộc tính | Chung domain | Domain riêng |
|------------|--------------|--------------|
| domain | domain đang có của Directus | domain mới của Backoffice |
| Ingress | `/admin` → FE, còn lại → pool | trên domain mới; Ingress Directus không đổi |
| Directus trong pool | có (nhãn) | không |
| biến đặt riêng | không | chỉ `PUBLIC_URL`; cookie domain không phủ domain mới → chart báo sửa env Directus (FR-076) |
| DB, Redis, storage | dùng chung | dùng chung |

## Image

| Image | Nhãn | User | Cổng | Probe |
|-------|------|------|------|-------|
| `hiennd23/backoffice-api:<sha>` | version, revision, `io.backoffice.directus-compat=11.17.4` | `node` (1000) | 8055 | `/server/ping`, `/server/health` |
| `hiennd23/backoffice-web:<sha>` | version, revision | nginx (101) | 8080 | `/admin/config.json` |
