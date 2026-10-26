# Contract: test đối chiếu và E2E (022)

## Profile `bootstrap` (`tests/parity/src/bootstrap`, Postgres mỗi PR, SQLite rút gọn)

| File | Thay đổi | Kiểm |
|------|----------|------|
| `dump.ts` | bỏ cột `bo_*` khỏi `tables[].columns`; bỏ dòng `directus_fields` có `field` bắt đầu `bo_` (D-180) | `schema.test.ts` giữ nguyên: cùng bảng, cột, dòng, 101 dòng `directus_migrations` |
| `normalize.ts` | `normalizeLogs`: bỏ dòng `Running Backoffice migrations...`, `Backoffice migrations are up to date`, `Applying <tên migration riêng>...` (FR-019 của spec 022) | `cli.test.ts` `bootstrap`, `init.test.ts`, `partial.test.ts` cùng output với Directus |
| `cross.test.ts` | thêm: sau baseline, DB của Backoffice có `backoffice_migrations` với đúng một dòng `20261026A` và ba cột; DB của Directus không có bảng; Directus khởi động trên DB của Backoffice (test có sẵn) | US4 kịch bản 1, 5 |
| `cross.test.ts` | chạy lại `bootstrap` của Backoffice trên DB đã migrate: `Backoffice migrations are up to date`, vẫn một dòng | US3 kịch bản 3 (chạy lại) |

## Env parity chính (DB chung, `backoffice-api` chạy `bootstrap` rồi `start`)

| File | Thay đổi | Kiểm |
|------|----------|------|
| `normalizers.ts` `normalizeBody` | `/collections`, `SEARCH /collections`: bỏ phần tử `collection` bắt đầu `backoffice_`; `/fields`: bỏ phần tử `collection` bắt đầu `backoffice_` (D-181) | request-set `GET /collections` admin và user, `SEARCH /collections`, `GET /fields` giống nhau |
| `accepted-differences.ts` | `D-180` (doc), `D-181` (doc, trỏ normalize) | `accepted-differences.test.ts`: id có trong spec 022 |
| blackbox collections/fields/schema (port) | không đổi; chạy trên DB có ba cột | FR-011, SC-003 |
| GraphQL (`tests/parity/src/graphql`) | SDL `/graphql`, `/graphql/system` so nguyên văn | R4 [Unverified]: nếu lệch ở `backoffice_migrations`, ghi D-181 và normalize |
| `db-unchanged.test.ts` | không đổi (chụp sau `start`) | API không ghi DB khi chạy |

## Deploy (`tests/parity/src/deploy`, 3 replica + 1 Directus, mỗi PR)

Test mới `backoffice-migrations.test.ts`: sau `up --wait`, qua DB của compose: `backoffice_migrations` có đúng một
dòng mỗi migration của `index.ts`; `directus_collections` có ba cột; log ba replica: đúng một `Applying Add Collection
UI Toggles...`, các replica khác `Backoffice migrations are up to date` (hoặc chờ lock rồi up to date); cả ba healthy;
`directus_migrations` không có dòng lạ. Chế độ standalone (`DEPLOY_MODE=standalone`): dòng do service `bootstrap` ghi,
replica không ghi. Chế độ kind: Job `bootstrap` ghi (log Job).

## E2E web (`apps/web-e2e`, ba cấu hình: proxy Directus, proxy API mới, cross-site)

`content-collection-toggles.spec.ts`:

| Case | Chuẩn bị (AdminApi) | Kiểm |
|------|---------------------|------|
| ẩn ô tìm kiếm | PATCH `/collections/bo_content` `{ meta: { bo_show_search: false } }` | admin và user thường: không `textbox` tìm kiếm, nút `Filter` mở popover, thêm điều kiện lọc được |
| bookmark có từ khóa | preset bookmark `search: 'x'` cho `bo_content` | mở bookmark: request items không có `search=`, bookmark giữ `search` |
| ẩn import | `bo_show_import: false` | mục Import/Export không có nút Import, còn Export và link CSV |
| ẩn export | `bo_show_export: false` | không `Export Items`, không `Download Page as CSV`, còn phần import |
| ẩn cả hai | cả hai false | không có nút `Import / Export` trong detail panel; các mục khác còn |
| bật lại | PATCH null | như trước |
| Data Model | mở `/settings/data-model/bo_content` | ba toggle có nhãn `Show Search`, `Show Import`, `Show Export` (vi-VN khi đổi ngôn ngữ), lưu → PATCH có `bo_show_*` |
| hệ thống | `/content/backoffice_migrations` | not found (`settings-data-model.spec.ts` case D-71) |

`afterEach`: PATCH ba cột về `null`. User thường: tài khoản của `content-permissions.spec.ts` (đọc `bo_content`).

## Unit (API, web, lib)

| File | Case |
|------|------|
| `backoffice-migrations/run.test.ts` (SQLite in-memory) | tạo bảng; chạy thiếu theo thứ tự; bỏ qua đã chạy; `flushCaches(true)` một lần; không áp → không flush, không lock; lỗi `up` → không ghi dòng |
| `backoffice-migrations/20261026A-….test.ts` (SQLite in-memory) | `up` hai lần: ba cột default true, ba dòng `directus_fields` với `special`, `translations`; cột có sẵn → không lỗi |
| `validate-migrations.test.ts` | `boMissing` → exit 1 với thông điệp; `boExtra` → exit 1; không có bảng → missing |
| `bootstrap` test | vendor khác: gọi runner khi `migrationsValid`, không gọi khi thiếu |
| `libs/system-data` `collections/index.test.ts` | `isSystemCollection('backoffice_migrations')` true; `backoffice_x` false; test tiền tố sửa |
| web | xem `contracts/web.md` |
