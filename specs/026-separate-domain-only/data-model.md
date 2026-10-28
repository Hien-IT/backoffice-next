# Data Model: Backoffice chạy cạnh Directus chỉ ở domain riêng (026)

Feature không thêm bảng, cột, khóa Redis hay biến env. Mô hình là các đối tượng cấu hình của 019 (`data-model.md` của
019) sau khi bỏ chế độ chung domain.

## Domain

| Domain | Phục vụ | `/admin` | Path khác | `PUBLIC_URL` |
|--------|---------|----------|-----------|--------------|
| D (Directus) | Directus (Deployment, Service, Ingress, compose `directus`) | Directus app | API Directus | giá trị của env chung |
| B (Backoffice) | FE + pool API Backoffice | Backoffice app (FE) | replica BE | URL của domain B, đặt riêng cho bản Backoffice |

Quan hệ: hai domain, một DB, một Redis, một storage, một `SECRET`; token do app này cấp dùng được ở app kia (Nguyên tắc
IV 3.3.0); cookie theo host nên phiên trình duyệt không chia sẻ giữa D và B (cả hai cùng nằm trong `directus_sessions`).

## Pool API

- Thành viên: replica BE của bản Backoffice (compose: upstream `bo_pool`; chart: Service `<release>-api` chọn
  `app.kubernetes.io/{name,instance,component=api}` của release).
- Directus không bao giờ là thành viên; một pod Directus còn nhãn `backoffice.io/api-pool` cũ không khớp selector nào.
- Không sticky session; thay đổi ở replica nào cũng hiện ở replica khác (019 US4).

## Bộ cấu hình dùng chung

- Nguồn: `.env` (compose), ConfigMap + Secret của Directus (chart `mode: shared`).
- Bản Backoffice đặt riêng đúng một biến: `PUBLIC_URL` (compose `environment`, chart `domain.publicUrl`).
- Điều kiện cài (chart): FR-053 (Redis, store, `SECRET`, DB, storage, `EXTENSIONS_LOCATION`) và FR-076 (cookie domain phủ
  host B) ở mọi lần cài/nâng cấp `mode: shared`; thiếu `domain.publicUrl` → dừng.

## Bản triển khai (release)

| Thuộc tính | `mode: shared` (cạnh Directus) | `mode: standalone` (021) |
|------------|--------------------------------|--------------------------|
| domain | B, bắt buộc khai báo | host của `ingress.host`; không `domain.publicUrl` |
| Ingress | `/admin` → FE, `/` → BE, `extraPaths` trước | như cũ |
| Directus | giữ Deployment, Service, Ingress, domain D; chart không đọc, không sửa | không có |
| biến đặt riêng | `PUBLIC_URL` | không (ConfigMap riêng của Backoffice) |
| bootstrap DB | Directus làm trước; replica chạy CMD của image | Job `pre-install`/`pre-upgrade` |

Chuyển trạng thái của một release chung domain cũ (US3): `helm upgrade` không `domain.publicUrl` → dừng (không đổi tài
nguyên) → đội vận hành đặt domain B, `PUBLIC_URL`, DNS, trả host D về Ingress của Directus, gỡ tay nhãn pool trên
Directus (tùy chọn, vô hại nếu để) → `helm upgrade` → Service `-api` chỉ chọn pod BE, Ingress một host B, Service
`-api-only` bị Helm xóa.

## Instance

Không đổi so với 019: `backoffice-api` (image BE) hoặc `directus`; cổng 8055; `starting` → `ready` → `draining` →
`stopped` (mã 143). "Thuộc pool" chỉ còn cho `backoffice-api`.
