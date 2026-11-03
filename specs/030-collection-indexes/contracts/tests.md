# Contract: Kiểm thử

## Unit (`apps/api`, Vitest)

| File | Kiểm |
|------|------|
| `database/backoffice-migrations/20261103A-create-backoffice-indexes.test.ts` | version/name, danh sách `['20261026A','20261028A','20261101A','20261103A']`, cột và null/default, index `collection` + unique `name`, không FK, chạy lại, race (`hasTable` mock false) — như test 20261101A |
| `database/validate-migrations.test.ts`, `20261101A-*.test.ts:33` | danh sách version cập nhật |
| `database/helpers/schema/dialects/{postgres,mysql,sqlite,default}.test.ts` | `createIndex` với mảng cột: SQL `(??, ??)`; trigram Postgres `USING gin (lower(??) gin_trgm_ops)` có/không `CONCURRENTLY`; MySQL inplace + fallback với 2 cột; lớp cơ sở ném cho trigram; `dropIndex`; caller một chuỗi cho SQL y như trước (snapshot cũ xanh nguyên) |
| `utils/get-default-index-name.test.ts` (có sẵn) | thêm `type: 'trgm'` |
| `services/backoffice-indexes.service.test.ts` (knex-mock-client) | validate (R6: mọi nhánh 400/403), tên sinh, trùng định nghĩa, tên có trong catalog, insert `creating` + 202, job: ready, failed + dọn INVALID, pg_trgm 42501, `failRunningIndexJobs`, GET `missing`/quá hạn, DELETE 400 khi creating, `dropForField`, `deleteForCollection` |
| `services/backoffice-indexes/catalog.test.ts` | câu catalog theo client (mock knex raw), `null` cho mssql/oracle |
| `services/fields.service.test.ts` (có sẵn) | `deleteField` gọi `dropForField` trước transaction; `addColumnIndex` không đổi |
| `services/collections.service.test.ts` (có sẵn) | `deleteOne` xóa dòng `backoffice_indexes` trong transaction |
| `database/errors/translate.test.ts`, `dialects/{postgres,mysql,sqlite}.test.ts` | ghép → mảng `RecordNotUniqueError` theo thứ tự; một cột như cũ; MySQL tra `backoffice_indexes` (mock) / fallback |
| `services/items.service.test.ts` (có sẵn) | `createOne` ném mảng lỗi, `primaryKey` xử lý từng phần tử |
| `controllers/backoffice-indexes.controller.test.ts` (supertest) | 401/403, 202 body, `res.locals.cache === false`, `concurrentIndexCreation=false` truyền xuống, DELETE 204/400 |
| `server.test.ts` hoặc `shutdown.test.ts` | `onSignal` gọi `failRunningIndexJobs` trước `database.destroy` |
| `services/graphql/schema/*.test.ts` | `backoffice_indexes` không có trong schema system |
| `libs/system-data/src/collections/index.test.ts` | `backoffice_indexes` hidden, system |

## Unit (`apps/web`)

| File | Kiểm |
|------|------|
| `composables/use-collection-indexes.test.ts` | 404 → `available=false`; list/meta; create gọi POST với `?concurrentIndexCreation=false` khi tắt; remove; poll 5 s khi creating và dừng; toast ready/failed; `indexesOf` |
| `modules/settings/routes/data-model/components/CollectionIndexes.browser.test.ts` | ẩn khi không available; bảng trạng thái; dialog: thêm field → danh sách, Move up/down qua menu, trigram khóa unique và cắt 1 field, concurrent ẩn khi `meta.concurrent=false`, lỗi 400 inline; xóa với xác nhận; focus trả về; axe không serious |
| `modules/settings/routes/data-model/fields/FieldsManagement.test.ts` (có sẵn) | hộp thoại xóa field nêu index (mock GET), không nêu khi 404 |
| `modules/settings/routes/data-model/FieldsRoute.test.ts` (có sẵn) | card render sau form; `assertOnlyKnownRequests` với id 229 |
| `lang/overlay.test.ts` (có sẵn) | key mới ở cả hai ngôn ngữ, không trùng DR |

## Parity (`tests/parity`, ba vendor của ma trận `parity`; `FULL_FILES` qua glob `src/schema/**`, thêm vào `REDUCED_FILES`)

| File | Kiểm |
|------|------|
| `src/schema/indexes.test.ts` | Directus 404 ở ba route (D-210 `doc`, `appRequest`); POST 202 → poll ready ≤ 60 s; catalog có index; `GET /fields/<c>` hai app bằng nhau (D-210.1); ghi trùng hai app: Directus một mục, Backoffice hai mục (D-210.4 `http`); 400 các nhánh validate; trùng định nghĩa; `concurrentIndexCreation=false`; xóa field ở Backoffice → index và dòng mất, `/fields` hai app bằng nhau (D-210.3); xóa index → ghi trùng được; dữ liệu đang trùng → failed + INVALID dọn (Postgres); trigram (`TEST_DB=postgres`): `pg_extension` có `pg_trgm`, `EXPLAIN` `Bitmap Index Scan` trên fixture 10.000 dòng với từ 3 ký tự, `?search=` hai app cùng kết quả; MySQL `text` → 400; SQLite trigram → 400 |
| `accepted-differences.ts` | D-210 (`doc`), D-210.1 (`doc`), D-210.2 (`doc`), D-210.3 (`doc`), D-210.4 (`http`, `POST /items/parity_idx_*`, `location` jsonPointer `/errors/\d+/extensions/field$`) |
| `normalizers.ts` + test | `BACKOFFICE_TABLE` và SDL regex thêm `indexes` |
| `bootstrap/cross.test.ts` | `BO_VERSIONS` + `hasTable('backoffice_indexes')` |
| `deploy/backoffice-migrations.test.ts` | danh sách version |
| `deploy/indexes.test.ts` (mới) | POST ở replica 1 → 202; GET ở replica 2 thấy `creating` → `ready`; ghi 20 item qua lb trong lúc creating, mỗi cái < 2 s (bảng 200.000 dòng `generate_series`, SC-004); `concurrentIndexCreation=false` ghi chờ; SIGTERM replica đang chạy job → dòng `failed` "Server shutdown", xóa dòng dọn INVALID |

## E2E (`apps/web-e2e`, ba cấu hình; chromium, firefox, webkit)

| File | Kiểm |
|------|------|
| `settings-data-model-indexes.spec.ts` | `proxy-directus`: card `toHaveCount(0)`; `proxy-api`/`cors`: thêm index unique 2 field qua dialog (BoSelect, BoSortableList Move up qua menu, switch unique), chờ `Ready`, POST 2 item trùng qua `AdminApi` → lỗi 2 mục, xóa field có index: hộp thoại nêu tên index, sau xóa card không còn dòng; xóa index qua dialog; axe `[data-testid="collection-indexes"], [role="dialog"]` |
| `helpers/allowed-paths.ts` | 229–231 |

## Benchmark

`tests/benchmark/src/items.ts`: case `SEARCH_LIST` Backoffice-only, trước/sau index trigram (raw SQL), EXPLAIN; kết quả
ghi vào spec (FR-024).
