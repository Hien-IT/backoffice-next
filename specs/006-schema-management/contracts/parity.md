# Contract: bộ đối chiếu, blackbox, profile, CI, E2E, benchmark (006)

Mẫu theo contracts/parity-blackbox.md của 005. Mọi test mới chạy với cả hai app trên cùng DB (Nguyên tắc V).

## 1. Thư mục `tests/parity/src/schema-management/`

| File | Suite | Nội dung |
|------|-------|----------|
| `ddl-capture.ts` | — | `captureModel(db, collections)`: `columnInfo`, `foreignKeys` (inspector `@backoffice/schema`), index (truy vấn catalog của `db-snapshot.ts`, tách thành hàm dùng chung), dòng `directus_collections`, `directus_fields`, `directus_relations` của các collection (bỏ `id`) |
| `ddl-scenario.ts` | — | `ddlScenario(name, steps, {collections})`: chạy `steps` ở Directus → chụp → xóa qua Directus → so `snapshot(db)` với trước; chạy ở app mới → chụp → xóa qua app mới → so; `expect(captureBackoffice).toEqual(captureDirectus)`; từng response so bằng `parity()` với normalizer `meta.id` |
| `crud.test.ts` | `reduced`, `full` | US1, US2 phần HTTP: `scenario()` + `flow` (004); lỗi, quyền, `OPTIONS`, `HEAD`, `SEARCH`, hàng loạt |
| `ddl.test.ts` | `full` | Ma trận kiểu × tùy chọn × khóa chính; folder; field hệ thống (cột người dùng, `is_indexed`); `concurrentIndexCreation`; sửa kiểu có dữ liệu; xóa field, xóa collection có phụ thuộc |
| `relations.test.ts` | `full` | m2o (`on_delete` ×5, `on_update`), o2m, m2m, m2a, translations, files, presentation, group; sửa `on_delete`; xóa relation, field m2o, o2m |
| `cross-use.test.ts` | `full` | FR-062 hai chiều trên fixture 002 mở rộng (research R6) |
| `sync-api.test.ts` | `full` (profile `multi`) | FR-050 qua API, SC-005; ca response cache với `CACHE_AUTO_PURGE=true` |
| `schema.test.ts` | `full` | FR-040 đến FR-043 phần HTTP: snapshot JSON từng byte, YAML sau parse, diff, apply, lỗi `validateSnapshot`, `validateApplyDiff`, multipart, `force`, `systemFields` |
| `ddl-capture.test.ts` | `full` | Đo `captureModel` trên bảng mẫu có unique, index, FK ở từng vendor |
| `items/blackbox/common/config.test.ts` | unit của `tests/parity` | Ánh xạ `URL`, `TZ`, `nodeUrl`, `PARITY_BLACKBOX_SETUP_APP` của shim |
| `normalizers.ts` (sửa) | — | `meta.id` của field, relation → `<id>` |
| `request-set.ts` (sửa) | — | `GET /collections`, `/fields`, `/relations`, `/schema/snapshot` cho `db-unchanged`, `readonly-account` |
| `permissions/blackbox-common.test.ts` (sửa) | `full` | phần `createCollection`, `createField`, `createFieldM2O`, `createFieldO2M`, `deleteField`, `deleteCollection` của `common.test.ts` |

Quy tắc so: `parity()` của `parity.ts` (status, header `COMPARED_HEADERS`, body JSON theo cấu trúc); `Cache-Control:
no-store` mặc định (R4 của 005). Tên collection của test có tiền tố `parity_sm_`; mỗi file dọn bằng
`DELETE /collections` ở `afterAll` và `dropCollections` dự phòng.

## 2. Blackbox: file thêm vào `tests/parity/src/items/blackbox/`

| Nguồn (`directus/tests/blackbox/tests/db/`) | Sửa (`// Backoffice:`) |
|---------------------------------------------|------------------------|
| `routes/collections/crud.test.ts` | bỏ khẳng định `tests_extensions_log`; GraphQL về Directus (shim) |
| `routes/collections/schema-cache.test.ts` | thay `spawn`, env bằng `nodeUrl('schema-cache', 1|2)`, `nodeUrl('schema-cache-nomsg', 1|2)`; `describe.skipIf` khi vắng profile |
| `routes/fields/crud.{test,seed}.ts` | bỏ khẳng định `tests_extensions_log` và `sleep(1000)`; GraphQL về Directus |
| `routes/fields/change-fields.{test,seed}.ts` | không |
| `routes/schema/schema.{test,seed}.ts` | `version` 35.2.0 → hằng; type `Snapshot` từ `@backoffice/types` |
| `schema/timezone/timezone.test.ts` + seed | không (`TEST_NO_CACHE` bị shim bỏ qua) |
| `schema/timezone/timezone-changed-node-tz-{asia,america}.test.ts` + seed | `getUrl(vendor, env)` với `env[vendor].TZ` → cặp `tz-asia`, `tz-america`; `describe.skipIf` khi vắng profile |

Shim `common/config.ts`: `getUrl(vendor, overrideEnv?)`: `overrideEnv[vendor].URL` → trả nó; `overrideEnv[vendor].TZ`
→ URL app đang thử của cặp theo `TZ` (`Asia/Seoul` → `tz-asia`, `America/Sao_Paulo` → `tz-america`, khác → ném lỗi);
không → như 005. `nodeUrl(profile, n)`: `n = 1` app đang thử (`PARITY_BLACKBOX_APP`), `n = 2` app kia của cặp.
`getSetupUrl()`: `PARITY_BLACKBOX_SETUP_APP` (`directus` mặc định, `backoffice`). `TEST_NO_CACHE`: bỏ qua, ghi chú.

## 3. Profile và cổng (`docker-compose.yml`, `config.ts`, `env/profile-*.env`)

| Profile | Cổng (Directus, Backoffice) | Env riêng (cộng `env/<vendor>.env` + `profile-blackbox.env`) |
|---------|-----------------------------|--------------------------------------------------------------|
| `schema-cache` | 9655, 9656 | `CACHE_ENABLED=true`, `CACHE_AUTO_PURGE=true`, `CACHE_SCHEMA=true`, `CACHE_STORE=memory`, `CACHE_NAMESPACE=directus-schema-cache` (Backoffice: `...2`), `REDIS_BUS_NAMESPACE=parity-schema-cache:bus`, `REDIS_LOCK_NAMESPACE=parity-schema-cache:lock`, `REDIS_PERMISSIONS_NAMESPACE=parity-schema-cache:perm` |
| `schema-cache-nomsg` | 9755, 9756 | như trên với `CACHE_NAMESPACE=directus-<vendor>3` (Backoffice: `4`), `REDIS_ENABLED=false`, `SYNCHRONIZATION_STORE=memory`, không `REDIS` |
| `tz-asia` | 9855, 9856 | `TZ=Asia/Seoul`; namespace Redis như cặp `blackbox` (chung bus với setup app) |
| `tz-america` | 9955, 9956 | `TZ=America/Sao_Paulo`; như trên |

`config.ts` `profilePorts` thêm bốn dòng; `global-setup.ts` đặt `DIRECTUS_URL_<P>`, `BACKOFFICE_URL_<P>`. Không có
biến mới của app (`TZ` là biến hệ điều hành, Directus cũng đọc).

## 4. Lượt chạy và CI

| Job (workflow) | Vendor | Lệnh | Thay đổi |
|----------------|--------|------|----------|
| `parity` (ci.yml) | postgres (2 shard) | suite `full` | thêm `src/schema-management/**` vào `FULL_FILES`; `crud.test.ts` vào `REDUCED_FILES` |
| `parity` (ci.yml) | mysql, sqlite3 | `reduced` + blackbox `PK_TYPES=integer` | thêm 8 file blackbox (bốn file cần profile tự bỏ qua) |
| `parity-blackbox` (ci.yml) | postgres, `app: [backoffice, directus]` | blackbox đủ | `env-up --profiles=blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america` |
| `blackbox-full` (parity-matrix.yml) | mysql, sqlite3 | blackbox đủ ba kiểu khóa | thêm profile như trên; thêm lượt `PARITY_BLACKBOX_SETUP_APP=backoffice` (FR-064) |
| `parity-matrix-rotating`, nightly | còn lại | `full` | không đổi cấu hình; `ddl.test.ts` chạy theo vendor |
| `e2e-directus-app` (ci.yml) | postgres | Playwright | thêm `data-model.spec.ts`; `routing.spec.ts` |
| `benchmark-schema` (benchmark.yml) | postgres | `benchmark:schema` | mới, hằng tuần, bấm tay |

`tools/ci-local.sh` thêm bước tương ứng. `README.md` của parity thêm mục "Test data model (006)".

## 5. Playwright (`tests/directus-app-e2e/src/data-model.spec.ts`)

`bothRuns(browser, scenario, [collections của lượt])`: module Data Model (tạo collection, field string, dropdown, m2o,
translations qua wizard, group, divider; `PATCH /fields/:c` khi kéo thả thứ tự; xóa field; xóa collection) và module
Content (tạo item có bản dịch, lọc archive sau khi đặt `archive_field` ở cài đặt collection). Sau mỗi lượt so
`changesSince` (bảng người dùng của lượt) và so `GET /schema/snapshot` lấy trực tiếp từ Directus với lấy qua proxy
(bỏ collection của lượt kia). `proxy/backoffice-routes.txt` thêm `collections`, `fields`, `relations`, `schema`;
`routing.spec.ts` khẳng định `$upstream_addr`.

## 6. Benchmark (`tests/benchmark/src/{schema,seed-schema}.ts`)

Seed (Postgres, qua API Directus): 200 collection × 15 field (+ m2o), 100 alias o2m, policy user đọc 50 collection
một phần. Kịch bản (`Scenario`): `GET /collections`, `GET /fields`, `GET /relations`, `GET /schema/snapshot` × (admin,
user) × (tươi, `HIT`); `POST /schema/diff` body là snapshot hiện tại (admin, `204`, tươi). Ngưỡng `compare()` 10%
(SC-007). Kết quả ghi vào `tasks.md` như 005.
