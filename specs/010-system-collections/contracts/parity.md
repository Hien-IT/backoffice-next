# Contract: bộ đối chiếu, blackbox, cặp `setup`, registry giả, CI, E2E, benchmark (010)

Mẫu theo contracts/parity.md của 009. Mọi test mới chạy với cả hai app trên cùng DB (Nguyên tắc V), trừ cặp `setup`
(DB riêng, §3).

## 1. Môi trường đối chiếu

| Thay đổi | Nội dung |
|----------|----------|
| `proxy/backoffice-routes.txt` | thêm `settings`, `presets`, `notifications`, `shares`, `translations`, `dashboards`, `panels`, `extensions`, `utils`, **mỗi dòng cùng task đăng ký controller tương ứng** (app Directus gọi `/settings`, `/presets`, `/notifications`, `/translations`, `/extensions` khi hydrate; `404` làm app qua proxy hỏng, bài học 009) |
| dịch vụ `registry` (mới, không profile) | `node:22-alpine`, `node /registry/server.mjs`, volume `./registry:/registry:ro`, cổng mạng `9100` (host `9100`), healthcheck `wget -qO- http://127.0.0.1:9100/version`; research R12 |
| `env/<vendor>.env` (9 file) | thêm `MARKETPLACE_REGISTRY=http://registry:9100` |
| profile `setup` (cặp mới, §3) | `postgres-setup` (host `6112`), `directus-setup` (`10455`), `backoffice-api-setup` (`10456`); `env/profile-setup.env`; đăng ký `config.ts profilePorts`, `docker.ts compose()`, `scripts/env.mjs ALL_PROFILES`; **không** vào `manualProfiles` |
| cặp chính | không đổi; bộ đối chiếu gửi `Cache-Control: no-store` như 005 |
| `request-set.ts` | thêm `GET /settings`, `GET /presets`, `GET /notifications`, `GET /translations`, `GET /dashboards`, `GET /panels`, `GET /shares`, `GET /extensions`, `GET /utils/random/string` (public bị từ chối hoặc trả rỗng) cho `db-unchanged`, cùng task đăng ký controller |
| `server/errors.test.ts` | bỏ các đường dẫn 010 khỏi ca `404` D-09.*; thêm ca `POST /server/setup` → `403` trên DB chung |
| `src/auth/shares.test.ts` (003) | tạo share ở mỗi app thay vì luôn ở Directus (`sharePerApp`) |

## 2. Thư mục `tests/parity/src/system/`

| File | Suite | Nội dung |
|------|-------|----------|
| `helpers.ts` | — | `same()` với `withoutD098` (D-09.8 còn hiệu lực tới khi đóng feature, bài học 008); `systemEffects(fn)` = `historyEffects` + dòng mới của bảng feature (`directus_settings`, `directus_presets`, `directus_notifications`, `directus_shares`, `directus_sessions`, `directus_translations`, `directus_dashboards`, `directus_panels`, `directus_files`); `comparable()`: id uuid/tự tăng → placeholder, `password` băm → `<argon2>` (so chéo bằng `/utils/hash/verify` ở app kia), `token` → `<token>`, `timestamp`, `date_*`, `expires` → `<time>`, JWT → payload bỏ `iat`, `exp`, `session`; `warnLines(service, needle, since)` đếm dòng log; `userWithPolicy(perms)` của 004; `cleanup(ids)` |
| `settings.test.ts` | `reduced`, `full` | US1: `GET /settings` (admin, app access, public, `fields`, `meta`), `PATCH /settings` theo bước xen kẽ hai app (tên, màu, logo, `theme_light_overrides`, `custom_css`, `auth_password_policy`, `storage_asset_presets`), `204` khi user có update không có read; `POST /settings/owner` (dòng `project_status = null`, log D-38, không có kết nối ra ngoài: so dòng DB); `/server/info` sau đổi ở app kia; `OPTIONS`, `HEAD` |
| `presets.test.ts` | `reduced`, `full` | US2: CRUD đơn và mảng; user app access: của mình, của user khác (`403`), `user` khác mình (`403`), role, toàn cục; query của `stores/presets.ts`; bookmark; `CACHE_AUTO_PURGE_IGNORE_LIST` (ghi preset không xóa cache: đọc item có cache trước và sau) |
| `notifications.test.ts` | `reduced`, `full` | US3: `POST` đơn, mảng (dòng DB, số dòng log D-33 ở app mới bằng số user nhận có email bật; ở Directus không đếm), đọc theo `recipient`, `PATCH status` hàng loạt, `PATCH` field khác (`403`), query của chuông (`aggregate count`, lọc `status`), `DELETE` |
| `shares.test.ts` | `reduced`, `full` | US4: `POST /shares` có và không quyền `share`, `password` băm và che; `POST /shares/auth` ba `mode` (body, cookie, `directus_sessions`, `times_used`), hết hạn, chưa tới hạn, hết lượt, sai mật khẩu, thiếu `share`, `mode` sai; token của app A đọc item ở app B (item, quan hệ cho phép, item khác `403`), refresh, logout; `GET /shares/info/:id` (còn hạn, hết hạn, không uuid `404`); `POST /shares/invite` (log D-36 mỗi email, `403` không user, không đọc được share); sửa `role`/xóa share rồi dùng token cũ ở app kia (kết quả theo share mới hoặc `403`); phiên hết hạn của user khác bị xóa sau `/shares/auth` (đếm `directus_sessions` có `expires < now` trước/sau); R-25 (`max_uses = 1`: đăng nhập được 2 lần, đo trên Directus), R-27 (public gọi `/shares/info`), R-29 (share có mật khẩu, body thiếu `password` → `500` ở hai app) |
| `translations.test.ts` | `reduced`, `full` | US6: CRUD; trùng `key` + `language` khi tạo, khi sửa một dòng, khi sửa nhiều dòng với cả hai field (`400` dù không trùng); quyền tối thiểu đọc; ghi ở app này đọc ở app kia |
| `insights.test.ts` | `reduced`, `full` | US7: `POST /dashboards` lồng `panels`, `PATCH` lồng `create/update/delete`, `GET` kèm `panels.*`, `POST /panels`, `DELETE /dashboards` (panel mất), user không policy `403` |
| `extensions.test.ts` | `reduced` (ca 1, 2), `full` | US8: `GET /extensions` (admin: `[]` hoặc dòng có sẵn; user thường `403`), `GET /extensions/sources/index.js` (byte, `Content-Type`, `Cache-Control`, `Vary`; với `Cache-Control: no-store`), chunk lạ `404`; registry giả: `GET /registry` (không query, `search`, `filter[type]`, type sai `403`, `sort=popular`, `limit`, `offset`), `/registry/account/:id`, `/registry/extension/:id` (có và `404` của registry → `503`), không uuid `404`, non-admin `403`; `install`, `reinstall`, `uninstall`, `PATCH`, `DELETE /:pk` (`503`/`403` ở app mới, D-37; so chỉ status của Directus, `directus_extensions` không đổi) |
| `utils-misc.test.ts` | `reduced`, `full` | US5 ca 1–4, 7, 8 + `resolve-redirect`: `random/string` (độ dài, bảng chữ, `length` 0, 501, `abc`, thiếu), `hash/generate` → `verify` chéo, thiếu field, hash hỏng; `sort` (collection có sort, dòng null, dòng trùng, không có sort field `400`, `item`/`to` không tồn tại (`500`, Edge Cases), collection hệ thống có `sort_field` mặc định, user không quyền `403`, event `items.sort` qua flow action của 009, cache xóa; R-26 đo trên Directus); `revert` (revision không `data` → `400`); `revert` (item quay về, activity, revision; revision không có `403`); `cache/clear` (admin, non-admin `403`, `?system` làm app kia dựng lại schema: tạo field ở Directus với cache schema, đọc `/fields` ở app mới trước và sau); `translations/generate` (admin tạo bộ translations rồi so `directus_collections`, `directus_fields`, `directus_relations`; non-admin `403`; payload sai `400`); `resolve-redirect` (hợp lệ, thiếu, `provider` sai, URL lạ) |
| `import-export.test.ts` | `full` | US5 ca 5, 6: `import` CSV, JSON (đơn giản, có quan hệ, upsert theo khóa, lỗi validate → `400` với `rows`, loại file khác `415`, không multipart `415`, non-admin trên collection hệ thống `403`, không quyền `403`), `background=true` (thông báo thành công/thất bại, `recipient = sender`), bộ đếm chung: đọc khóa Redis `directus:import-export:importCount` trong khi import nền ở app A rồi B (cùng khóa, tăng rồi về 0); `export` 5 format (collection có dòng và collection rỗng → file rỗng; đợi `directus_files` có dòng mới ≤ 10 s, đọc qua `/assets/:id` ở hai app, so byte sau khi thay thời điểm; `title`, `filename_download`, `type`; `file` ghi đè `title`; `limit`, `fields`, `filter`, `sort` trong `query`; thông báo), thiếu `query`/`format` `400`, format sai → thông báo thất bại |
| `setup.test.ts` | `full` (Postgres) | §3 |
| `e2e-app.test.ts` | `full` | đúng chuỗi request của app Directus: `stores/settings.ts` (`GET /settings`, `PATCH /settings` của trang Project), `stores/presets.ts` (`GET /presets?filter=_or...&limit=-1`, `POST`, `PATCH`, `DELETE`), `stores/notifications.ts` (`GET /notifications?aggregate[count]=*&filter[recipient]..&filter[status]=inbox`, `PATCH /notifications` mảng `status`), `stores/translations.ts` (`GET /translations?limit=-1`), `stores/extensions.ts` (`GET /extensions`), insights (`GET /dashboards?fields[]=*&fields[]=panels.*&limit=-1`), sidebar chia sẻ (`GET /shares?filter[collection]..&filter[item]..`, `GET /shares/info/:id`, `POST /shares/auth`), bảng sắp xếp (`POST /utils/sort/:c`), sidebar xuất nhập (`POST /utils/export/:c`, `POST /utils/import/:c`); so response |

`REDUCED_FILES` thêm `src/system/{settings,presets,notifications,shares,translations,insights,utils-misc}.test.ts`;
`FULL_FILES` thêm `src/system/**/*.test.ts`. `reduced` chạy MySQL, SQLite mỗi lần push; `full` Postgres mỗi lần
push, vendor còn lại nightly. Ca MySQL/SQLite đọc dòng DB qua `hostDb()` chỉ SELECT (bài học 002).

## 3. Cặp `setup` (research R11)

| Mục | Nội dung |
|-----|----------|
| compose | `postgres-setup` (`postgis/postgis:13-3.4-alpine`, `POSTGRES_PASSWORD=secret`, `POSTGRES_DB=directus`, `6112:5432`, healthcheck `pg_isready` qua TCP như `postgres`); `directus-setup` (image 11.17.4, `env_file: env/postgres.env, env/profile-setup.env`, `depends_on postgres-setup healthy`, `10455:8055`); `backoffice-api-setup` (image local amd64, cùng env, `depends_on directus-setup healthy`, `10456:8055`); profile `setup` cho cả ba |
| `env/profile-setup.env` | `DB_HOST=postgres-setup`, `ADMIN_EMAIL=`, `ADMIN_PASSWORD=`, `REDIS=redis://redis:6379/9`, `PUBLIC_URL=http://localhost:10455`, `CACHE_NAMESPACE=parity-setup` (thừa nhưng rõ) |
| `setup.test.ts` | `describe.skipIf(vendor !== 'postgres' \|\| !hasProfile('setup'))`; `setupDb()` knex `pg` tới `127.0.0.1:6112`; `beforeAll`: xóa `directus_users`, `directus_access`, `directus_policies`, `directus_roles` không phải của bootstrap (bootstrap để lại một role, một policy, một access Administrator, không user), đặt lại cột chủ dự án; chuỗi: (1) `GET /server/info` hai app → so; (2) `POST /server/setup` body `{ project_owner, password, first_name, last_name, project_usage, org_name, product_updates }` ở Directus → `204`, chụp dòng mới 5 bảng; (3) xóa dòng mới; (4) cùng request ở app mới → chụp, so với (2) sau chuẩn hóa (id, băm mật khẩu so bằng đăng nhập `POST /auth/login` ở cả hai app, `date_created`, `project_status` null ở cả hai); (5) `POST /server/setup` lần nữa ở hai app → `403`; (6) thiếu `project_owner` hoặc `password` → `204` không tạo user (fallback `ADMIN_*` rỗng) ở cả hai; (7) R-28: hai `POST /server/setup` đồng thời (`Promise.all`) trên DB trống ở Directus rồi ở app mới, ghi số user và role tạo ra (chấp nhận 1 hoặc 2, so hai app), xóa; (8) `afterAll` xóa dòng mới. Log cảnh báo D-38 đếm ở `backoffice-api-setup` |
| CI | `setup` vào `--profiles` của job `parity` dòng Postgres `full` và job `e2e-directus-app`; `ci-local.sh` theo |

## 4. Registry giả (research R12)

| Route | Trả |
|-------|-----|
| `GET /version` | `{ "version": "2024-01-29" }` |
| `GET /extensions` | fixture 5 extension (`type` `interface`, `display`, `operation`, `bundle`, `hook`; `sandbox` 3; `publisher` hai tác giả) lọc theo `search` (tên chứa), `type`, `by` (`publisher.username`), `sandbox=true`; `sort` `popular` (`total_downloads` giảm), `recent` (`last_updated` giảm), `downloads`; `limit` mặc định 5, `offset`; `{ meta: { filter_count }, data }` |
| `GET /extensions/:id` | fixture theo `RegistryDescribeResponse`; id lạ → `404 { "error": "not found" }` |
| `GET /accounts/:id` | fixture theo `RegistryAccountResponse`; id lạ → `404` |
| khác | `404` |

Fixture là JSON trong `tests/parity/registry/fixtures/*.json`; unit test `apps/api/src/extensions/registry/
fixtures.test.ts` parse chúng bằng ba schema zod đã port.

## 5. Blackbox (research R15)

| File | Sửa |
|------|-----|
| `tests/db/mail/mail.test.ts` | copy vào `src/items/blackbox/tests/db/mail/`; bỏ SMTP giả và `sleep`; kiểm `200`, `GET /notifications?filter[recipient]=TESTS_FLOW&sort=-id&limit=2` có hai dòng `subject = inbox`; khi `PARITY_BLACKBOX_APP=backoffice`: hai dòng `mail sending is out of scope` mới trong `logs('backoffice-api-blackbox')`; ghi khối comment lý do (D-33) |
| `common/functions.ts` | `/utils/cache/clear?system` tới `getSetupUrl()` |
| `common/config.ts` | comment `getDirectusUrl`: chỉ GraphQL (011) |
| `src/items/cache-blackbox.test.ts` | `/presets`, `/utils/cache/clear` tới app đang kiểm (`url()` thay `setup()`) |
| `sequencer.ts` | `tests/db/mail/mail.test.ts` giữ vị trí như Directus (không có ràng buộc riêng) |

Chạy hai lượt (`PARITY_BLACKBOX_APPS=directus,backoffice`).

## 6. CI

| Workflow | Thay đổi |
|----------|----------|
| `ci.yml` `quality` | coverage 80% gồm file mới; unit gốc `import-export.test.ts`, `generate-translations.test.ts`, `translations-shared.test.ts`, registry tests; guard `mail-sites.guard.test.ts` |
| `ci.yml` `parity` | suite `system` qua `suite.ts`; dòng Postgres `full` thêm `setup` vào `--profiles` |
| `ci.yml` `e2e-directus-app` | `env-up --profiles=app,setup`; `system.spec.ts`, `setup.spec.ts` |
| `parity-matrix.yml`, `nightly.yml` | `setup` chỉ ở Postgres |
| `benchmark.yml` | job `benchmark-system` (cùng mẫu `benchmark-history`) |
| `guard-differences` | D-09.8, D-14 xóa; D-31 bỏ `removeAt`, reason lâu dài; D-36 (`doc`), D-37 (`http`: `POST /extensions/registry/install`, `/reinstall`, `DELETE /extensions/registry/uninstall/*`, `PATCH /extensions/*`, `DELETE /extensions/*`, `location: any`), D-38 (`doc`) — ở commit đóng feature |
| `tools/ci-local.sh` | `setup` trong profiles của parity Postgres và E2E |

## 7. Playwright (`tests/directus-app-e2e/src/system.spec.ts`, `setup.spec.ts`; research R13)

| Kịch bản | Bước |
|----------|------|
| Cài đặt dự án | Settings → Project: đổi tên, màu, theme, CSS; Save → tiêu đề và màu đổi; `directus_settings` |
| Bookmark và preset | Content → collection: đổi layout, cột, bộ lọc → preset lưu; tạo bookmark → hiện ở sidebar; đổi tên, xóa |
| Thông báo | tạo thông báo cho admin qua API app mới → chuông hiện số; mở drawer, lưu trữ → tab Archived |
| Chia sẻ | item → sidebar Shares → tạo (tên, mật khẩu, `max_uses`, `date_end`) → copy link → tab ẩn danh `/admin/shared/<id>` → nhập mật khẩu → xem item; sai mật khẩu → lỗi |
| Translations | Settings → Translations: tạo, sửa, xóa; trùng → lỗi hiển thị |
| Insights | tạo dashboard, thêm panel Label, kéo đổi vị trí, xóa panel, xóa dashboard |
| Sắp xếp tay | collection có sort field: kéo thả dòng → `POST /utils/sort`; thứ tự giữ sau reload |
| Xuất nhập | sidebar Import/Export: xuất CSV → thông báo + file trong Files; nhập CSV 3 dòng → item xuất hiện |
| Marketplace | Settings → Marketplace: danh sách từ registry giả; mở extension; bấm Install → thông báo lỗi; `directus_extensions` không đổi |
| Cài đặt lần đầu (`setup.spec.ts`) | app của `directus-setup` (`:10455/admin`): màn tạo admin → điền → vào app; lượt Backoffice: `page.route('**/server/setup', ...)` chuyển tới `:10456`; so dòng 5 bảng; xóa giữa hai lượt qua knex `6112` |

Các route của feature này qua proxy tới app mới; `bothRuns` so dòng DB sau chuẩn hóa như 008, 009.

## 8. Benchmark (`tests/benchmark/src/system.ts`, research R14)

| Kịch bản | Request | Kết nối |
|----------|---------|---------|
| `settings-get` | `GET /settings` (admin) | 50 |
| `presets-list` | `GET /presets?filter=<_or của app>&limit=-1` (user có 200 preset) | 50 |
| `notifications-count` | `GET /notifications?aggregate[count]=*&filter[recipient][_eq]=$CURRENT_USER&filter[status][_eq]=inbox` | 50 |
| `dashboards-panels` | `GET /dashboards?fields[]=*&fields[]=panels.*&limit=-1` (20 × 10) | 50 |
| `shares-auth` | `POST /shares/auth` `{ share, password }` (argon2) | 10 |
| `utils-sort` (không chặn) | `POST /utils/sort/<c>` `{ item, to }` ngẫu nhiên trong 1.000 dòng | 10 |

Seed `seed-system.ts`; 3 vòng; ngưỡng 10% p95 và req/s (trừ `utils-sort`); hằng tuần, không chặn CI.
