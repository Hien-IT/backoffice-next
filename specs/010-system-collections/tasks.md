---

description: "Danh sách task cho feature 010: Collection hệ thống còn lại (/settings, /presets, /notifications, /shares, /translations, /dashboards, /panels, /extensions, /utils)"
---

# Tasks: Collection hệ thống còn lại (`/settings`, `/presets`, `/notifications`, `/shares`, `/translations`, `/dashboards`, `/panels`, `/extensions`, `/utils`)

**Input**: Tài liệu thiết kế trong `/specs/010-system-collections/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R16), `data-model.md`, `contracts/`
(`system-api.md`, `utils-api.md`, `parity.md`), `quickstart.md`, `checklists/system.md` (33 mục, rà xong 2026-10-14).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo, chạy đỏ trước rồi port code
  (`import-export.test.ts` 37, `generate-translations.test.ts` 23, `translations-shared.test.ts` 3, `store.test.ts`,
  `tmp.test.ts`, 4 file test của registry).
- Mọi endpoint thêm có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới, so status, body, header và dòng
  DB qua `systemEffects` (research R10, contracts/parity.md §2); bộ blackbox port chạy hai lượt theo app (R15).
- Điểm spec ghi "đo" hoặc `[Suy luận]` (bundle rỗng R6, `GET /extensions` của user thường, `OPTIONS` của từng
  router, R-25 đến R-29, sort thiếu `item`/`to`) đo trên Directus thật trong task test tương ứng; lệch thì dừng, ghi
  bằng chứng vào "Ghi chú khi làm" và hỏi tech lead.

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, util, biến env, môi
trường đối chiếu (registry giả, cặp `setup`), helper đối chiếu, `getService`, `store`, `createAdmin`. Thứ tự story:
US1 (settings, setup) → US2 (presets) → US3 (notifications) → US4 (shares) → US5 (utils) → US6 (translations) → US7
(insights) → US8 (extensions) → US9 (E2E, benchmark, CI) → Polish (đóng feature). Plan chia năm nhóm A–E: A = Phase
3, 4, 5, 8, 9; B = Phase 6; C = Phase 7; D = Phase 10; E = Phase 11, 12. Mỗi nhóm là một đợt commit lên `main`.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/010-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Port nguyên vẹn: giữ tên biến, thứ tự câu lệnh, message của Directus. Chỗ khác nguồn ghi `// Backoffice: <lý do>`
  (danh sách cho phép ở plan, Constitution Check I). Giới hạn tạm ghi `// ponytail: <giới hạn>, <khi nào nâng>`.
- Ánh xạ import khi port: `@directus/utils` → `@backoffice/utils` (`@directus/utils/node` → `@backoffice/utils/node`);
  `@directus/errors` → `@backoffice/errors` (`isDirectusError` → `isBackofficeError`); `@directus/validation` →
  `@backoffice/validation`; `@directus/types` → `@backoffice/types`; `@directus/env` → `@backoffice/env`;
  `@directus/memory` → `@backoffice/memory`; `@directus/system-data` → `@backoffice/system-data`;
  `@directus/constants` → `@backoffice/constants`; `@directus/extensions-registry` → `../extensions/registry/index.js`;
  `./utils/get-schema.js` → `./schema/get-database-schema.js`; `./logger/index.js`, `./database/index.js`,
  `./cache.js`, `./emitter.js`, `./services/index.js`, `./utils/get-service.js`, `./permissions/**`, `./redis/index.js`
  đã có cùng tên.
- **Không sửa service của feature trước** ngoài: `settings.service.ts` (thay bản tối giản, R2), `server.service.ts`
  (`serverInfo` đọc qua `readSingleton`, R2), `server.controller.ts` (thêm `POST /setup`), `import-export.service.ts`
  (thêm phần còn lại), thêm factory vào `providers.ts`, rút `COLLECTIONS_WITHOUT_SERVICE_YET` và thêm `case` trong
  `utils/get-service.ts`, thêm mẫu vào `middleware/router-options.ts`, khối Feature 010 trong
  `config/supported-variables.ts`, `src/auth/shares.test.ts` của 003 (tạo share ở mỗi app).
- **Luôn tái tạo hành vi Directus**, kể cả hành vi không an toàn (R-25 đến R-29). Phát hiện hành vi không an toàn mới
  thì thêm dòng R-xx vào spec kèm bằng chứng (ca test, request, kết quả đo trên Directus thật, ngày đo) và một ca thể
  hiện; không tự lệch.
- Không gửi email (D-33, D-36), không gửi báo cáo chủ dự án (D-38), không cài extension (D-37): mỗi chỗ một dòng log
  `warn` tiền tố `Backoffice:` theo contracts/system-api.md §8.
- Proxy: mỗi segment vào `tests/parity/proxy/backoffice-routes.txt` **cùng task** đăng ký controller của nó (app
  Directus gọi `/settings`, `/presets`, `/notifications`, `/translations`, `/extensions` khi hydrate; `404` làm app
  qua proxy hỏng).
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng.
- Quy trình merge thẳng `main`: mỗi nhóm task commit và push xong thì CI phải xanh; `pnpm run ci:local` khi Actions bị
  chặn. Nhánh `010-system-collections` giữ ngang `main` (fast-forward); pull `main` trước mỗi commit (session 009 còn
  push sửa test).

## Quy ước đường dẫn

- API: `apps/api/src/**`. Libs: `libs/utils/src/node/**`.
- Test đối chiếu: `tests/parity/src/**` (mới: `tests/parity/src/system/**`; blackbox port thêm vào
  `tests/parity/src/items/blackbox/**`). Danh sách khác biệt: `tests/parity/accepted-differences.ts`. Profile, env,
  registry giả: `tests/parity/docker-compose.yml`, `tests/parity/env/**`, `tests/parity/registry/**`.
- E2E app Directus: `tests/directus-app-e2e/**`. Reverse proxy: `tests/parity/proxy/**`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`. CI: `.github/workflows/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`,
  `directus/app/src/**`.

## Tóm tắt

- Tổng số task: **58**
- Số task đánh dấu [P]: **40**
- Một lượt implement, checkpoint sau mỗi phase; năm đợt commit A–E.
- MVP gợi ý: **Phase 1 đến 5** (US1, US2, US3): settings, setup, presets, notifications — app Directus qua proxy mở
  được với các route hydrate đi tới app mới. Feature chưa đóng được khi chưa xong US4 đến US9 và Polish.

---

## Phase 1: Setup (thư viện, util, biến env, router-options, registry giả, cặp `setup`)

**Purpose**: Bốn gói mới cài được, `createTmpFile` có mặt, 11 biến sang nhóm A, mẫu `OPTIONS` sẵn, registry giả và
cặp `setup` chạy được (research R1, R6, R9, R11, R12, R16; contracts/parity.md §1, §3, §4).

- [X] T001 Thư viện: `pnpm-workspace.yaml` catalog thêm `ky: 1.14.0`, `papaparse: 5.5.3`, `'@types/papaparse': 5.5.0`,
  `stream-json: 1.9.1`, `'@types/stream-json': 1.7.8`, `async: 3.2.6`, `'@types/async': 3.2.25` (bản của
  `directus/pnpm-workspace.yaml`); `apps/api/package.json` thêm bốn gói `catalog:` và ba `@types` vào devDependencies;
  `pnpm install`; `pnpm audit --prod --audit-level=high` không advisory mới; ghi thời gian vào "Ghi chú khi làm"
  (research R1).
- [X] T002 [P] `libs/utils/src/node/tmp.ts` port từ `directus/packages/utils/node/tmp.ts` (`createTmpFile`). Directus
  không có test cho file này: viết mới `libs/utils/src/node/tmp.test.ts` (đỏ trước): tạo được file rỗng trong thư mục
  `directus-*` của `os.tmpdir()`, `cleanup` xóa cả file và thư mục, `open` lỗi thì thư mục tạm bị xóa và lỗi ném ra;
  export trong `libs/utils/src/node/index.ts`; `pnpm nx run @backoffice/utils:build`. Ghi manifest
  `tools/port-manifest/010-T002.json` (research R7).
- [X] T003 [P] `apps/api/src/config/supported-variables.ts` khối "Feature 010": `IMPORT_TIMEOUT`,
  `IMPORT_MAX_CONCURRENCY`, `IMPORT_EXPORT_NAMESPACE`, `MAX_IMPORT_ERRORS`, `EXPORT_BATCH_SIZE`, `EXTENSIONS_CACHE_TTL`,
  `MARKETPLACE_REGISTRY`, `MARKETPLACE_TRUST`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN`; `NOT_APPLICABLE_VARIABLES`
  còn `PROJECT_OWNER`; `warn-unsupported-variables.ts` comment về `SERVE_APP` (được đọc cho bundle, cảnh báo giữ);
  `supported-variables.test.ts`, `warn-unsupported-variables.test.ts` thêm ca (`['IMPORT_TIMEOUT', true]`,
  `['ADMIN_EMAIL', true]`, `['EMAIL_TRANSPORT', false]`, `['TELEMETRY', false]`);
  `specs/001-platform-foundation/contracts/config.md` §5 cập nhật nhóm A, B, C và ghi chú `SERVE_APP` (FR-095,
  research R9).
- [X] T004 [P] `apps/api/src/middleware/router-options.ts` khối Feature 010 theo contracts/system-api.md §10 và
  utils-api.md §12 (dùng `UUID_REGEX` cho `/shares/info/<uuid>`, `/extensions/registry/(account|extension)/<uuid>`,
  `/extensions/registry/uninstall/<uuid>`, `/extensions/<uuid>`); `router-options.test.ts` thêm ca cho mỗi mẫu; ghi
  `[Suy luận]` vào comment để task controller đo lại bằng `OPTIONS` ở Directus (FR-001).
- [X] T005 [P] Registry giả: `tests/parity/registry/server.mjs` (chỉ `node:http`; `GET /version`, `GET /extensions` với
  `search`, `type`, `by`, `sandbox`, `sort`, `limit`, `offset`, `meta.filter_count`; `GET /extensions/:id`;
  `GET /accounts/:id`; `404` JSON) và `tests/parity/registry/fixtures/{list,describe,accounts}.json` (5 extension, 2
  tác giả) theo `directus/packages/extensions-registry/src/**/schemas/*.ts`; `tests/parity/docker-compose.yml` dịch vụ
  `registry` (`node:22-alpine`, volume `./registry:/registry:ro`, cổng `9100:9100`, healthcheck `wget -qO-
  http://127.0.0.1:9100/version`, không profile); 9 file `tests/parity/env/<vendor>.env` thêm
  `MARKETPLACE_REGISTRY=http://registry:9100`; `tests/parity/src/vendors.test.ts` kiểm dịch vụ và biến; kiểm tay
  `curl localhost:9100/extensions?limit=2` (research R12, contracts/parity.md §4).
- [X] T006 [P] Cặp `setup`: `tests/parity/env/profile-setup.env` (`DB_HOST=postgres-setup`, `ADMIN_EMAIL=`,
  `ADMIN_PASSWORD=`, `REDIS=redis://redis:6379/9`, `PUBLIC_URL=http://localhost:10455`, `CACHE_NAMESPACE=parity-setup`,
  chú thích: DB riêng, chỉ Postgres, bootstrap không tạo user); `tests/parity/docker-compose.yml` thêm `postgres-setup`
  (`postgis/postgis:13-3.4-alpine`, `6112:5432`, healthcheck TCP như `postgres`), `directus-setup` (`10455`),
  `backoffice-api-setup` (`10456`, image local amd64) profile `setup`; `tests/parity/src/config.ts`
  `profilePorts.setup`, `knexConfig` thêm `setup` (hoặc helper `setupDb` ở `src/system/helpers.ts`, T009);
  `tests/parity/src/docker.ts` danh sách `--profile`; `tests/parity/scripts/env.mjs` `ALL_PROFILES`;
  `vendors.test.ts` xanh (không trong `manualProfiles`); dựng thử `env-up --vendor=postgres --profiles=setup`, kiểm
  `directus_users` trống trên `6112` và `GET :10455/server/info` trả setup chưa xong, Redis db 9 có key, db 0 không có
  key `parity-setup`; ghi kết quả vào "Ghi chú khi làm" (plan rủi ro 5; research R11, contracts/parity.md §3).
- [X] T007 [P] `tests/parity/src/server/errors.test.ts`: bỏ các đường dẫn 010 khỏi ca `404` D-09.* (ca còn `/graphql`),
  thêm ca `POST /server/setup` trên DB chung → `403` ở cả hai app sau khi có controller (đánh dấu `todo` tới T018);
  `tests/parity/src/suite.ts` `REDUCED_FILES` thêm `src/system/{settings,presets,notifications,shares,translations,
  insights,utils-misc}.test.ts`, `FULL_FILES` thêm `src/system/**/*.test.ts` (contracts/parity.md §1, §2). Thêm glob
  từ Phase 1 được: `vitest.parity.config.ts` dùng danh sách làm `include` (hợp các glob), một glob chưa khớp file nào
  không làm lỗi khi glob khác có file, và không test nào kiểm từng glob (đã đọc `src/suite.ts`, 2026-10-14).

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh (api với test cũ, libs utils); `env-up
--profiles=app,setup` lên, proxy vẫn đưa 9 segment tới Directus; `curl registry:9100/version` qua container trả
`2024-01-29`.

---

## Phase 2: Foundational (helper đối chiếu, `getService`, `store`, `createAdmin`, `destroyPipedStream`)

**Purpose**: Nền dùng chung cho mọi story (research R3, R5, R7, R10).

- [X] T008 `apps/api/src/utils/get-service.ts`: thêm `case` `directus_dashboards`, `directus_panels`, `directus_settings`,
  `directus_shares`, `directus_translations` (import từ `services/index.ts`, các lớp tạo ở story tương ứng; task này
  tạo file service trơn `dashboards.service.ts`, `panels.service.ts` port từ `services/dashboards.ts`, `panels.ts` và
  stub `shares.service.ts`, `translations.service.ts` là lớp con trơn chờ T030, T044 port đủ; stub giữ đúng hành vi
  hiện tại của D-31 (`ItemsService` chung: ghi lồng `directus_shares` chưa kiểm hành động `share`, chưa chặn trùng
  `key` + `language`) cho tới T030, T044, không thêm route, không đổi hành vi nhìn thấy); `COLLECTIONS_WITHOUT_
  SERVICE_YET` còn ba collection deployment, comment đổi thành lâu dài (D-31, Nguyên tắc XI); `get-service.test.ts`
  thêm ca; `services/index.ts` export. Ghi manifest (FR-003, research R5).
- [X] T009 [P] `tests/parity/src/system/helpers.ts` theo contracts/parity.md §2: `same()` với `withoutD098`,
  `systemEffects(fn)`, `comparable()` (id, băm `<argon2>`, `token`, `filename_disk`, thời điểm, JWT payload bỏ `iat`,
  `exp`, `session`), `verifyHashAt(app, hash, plain)` (gọi `/utils/hash/verify` ở app kia), `warnLines(service, needle,
  since)`, `userWithPolicy`, `setupDb()` (knex `pg` tới `127.0.0.1:6112`), `cleanup`; `helpers.test.ts` cho
  `comparable` (FR-100, research R10).
- [X] T010 [P] `apps/api/src/utils/store.ts` port từ `directus/api/src/utils/store.ts` (`useStore` trên `createCache` của
  `@backoffice/memory`, `redisConfigAvailable`, `useRedis`), test gốc `store.test.ts` đỏ trước rồi xanh. Ghi manifest
  (research R7).
- [X] T011 [P] `apps/api/src/utils/create-admin.ts` port từ `directus/api/src/utils/create-admin.ts` (`defaultAdminRole`,
  `defaultAdminPolicy`, `defaultAdminUser`, `createAdmin`); `create-admin.test.ts` mới (mock bốn service: thứ tự tạo
  role → policy → access → user; thiếu email hoặc password → không tạo user; `ADMIN_TOKEN`); `apps/api/src/utils/
  destroy-piped-stream.ts` port từ `directus/api/src/utils/destroy-piped-stream.ts` kèm test gốc
  `destroy-piped-stream.test.ts` (đỏ trước). Ghi manifest (FR-013, research R3, R7).

**Checkpoint**: unit test api xanh; `getService('directus_shares')` trả `SharesService` (stub).

---

## Phase 3: User Story 1 - Cài đặt dự án, theme, branding dùng chung giữa hai app (Priority: P1) 🎯 MVP

**Goal**: `GET`, `PATCH /settings`, `POST /settings/owner` và `POST /server/setup` trả cùng status, body, dòng
`directus_settings` (và roles, policies, access, users với setup) như Directus; không gửi báo cáo chủ dự án (D-38).

**Independent Test**: `tests/parity/src/system/settings.test.ts` xanh trên Postgres, MySQL, SQLite; `setup.test.ts`
xanh trên Postgres với cặp `setup`; `/server/info` của 001 vẫn xanh.

### Tests for User Story 1

- [X] T012 [P] [US1] `tests/parity/src/system/settings.test.ts` (`reduced`, `full`) theo contracts/parity.md §2: `GET`
  (admin, app access, public `403`, `fields`, `meta`, chưa có dòng → mặc định singleton), `PATCH` xen kẽ hai app
  (`project_name`, `project_color`, `project_logo`, `theme_light_overrides`, `custom_css`, `auth_password_policy`,
  `storage_asset_presets`), user có update không có read → `204`, `POST /settings/owner` (dòng `project_status = null`,
  một dòng log D-38 ở app mới qua `warnLines`, `403` user thường), `GET /server/info` ở app kia sau đổi, `OPTIONS`,
  `HEAD` (đo `Allow` ở Directus, sửa T004 nếu lệch). FR-014 (settings có hiệu lực ngay ở app kia), mỗi ca đổi ở app A
  rồi kiểm ở app B, cả hai chiều, và đặt lại giá trị cũ ở `afterEach`: `auth_password_policy` → `PATCH /users/:id`
  với mật khẩu yếu ở B trả `400` như Directus; `auth_login_attempts = 2` → hai lần đăng nhập sai ở B rồi user bị
  `suspended` (đọc `directus_users.status`); `storage_asset_presets` thêm key → `GET /assets/:id?key=<key>` ở B trả ảnh
  theo preset; `project_name` → `GET /users/me/tfa/generate` ở B có issuer mới (US1 ca 1–3, 5; FR-010 đến FR-012,
  FR-014).
- [X] T013 [P] [US1] `tests/parity/src/system/setup.test.ts` (`full`, `describe.skipIf(vendor !== 'postgres' ||
  !hasProfile('setup'))`) theo contracts/parity.md §3 bước (1)–(8): `GET /server/info` hai app; `POST /server/setup`
  ở Directus, chụp dòng mới 5 bảng qua `setupDb()`; xóa; cùng request ở app mới; so (`comparable`, mật khẩu so bằng
  `POST /auth/login` ở hai app, `project_status` null); gọi lại → `403`; thiếu `project_owner`/`password` → `204`
  không user; R-28 hai request đồng thời (ghi số user, role; so hai app); `afterAll` xóa; log D-38 ở
  `backoffice-api-setup` (US1 ca 4; FR-013).
- [X] T014 [P] [US1] `apps/api/src/controllers/settings.controller.test.ts` (supertest qua app Nest, mock service):
  `GET /` gọi `readSingleton(sanitizedQuery)`, `data || null`; `POST /owner` gọi `setOwner(body)`, `204`; `PATCH /`
  gọi `upsertSingleton` rồi `readSingleton`, `Forbidden` → `204`; `OPTIONS /settings` → `Allow: GET, PATCH`,
  `OPTIONS /settings/owner` → `POST`. `apps/api/src/controllers/server.controller.test.ts` thêm ca `POST /setup`:
  `isSetupCompleted` true → `403`; false → `createAdmin(schema, {...})` rồi `setOwner` không await, `204`;
  `Forbidden` bên trong → `204`.
- [X] T015 [P] [US1] `apps/api/src/services/settings.service.test.ts` viết lại: `extends ItemsService`
  (`directus_settings`); `setOwner` gọi `upsertSingleton({ project_owner, project_usage, org_name, product_updates,
  project_status: null })` và `logger.warn` một dòng không chứa email, không gọi `fetch`; `server.service.test.ts`
  ca `serverInfo` gọi `readSingleton({ fields: [16 field, 'public_background.id', 'public_background.type'] })`.

### Implementation for User Story 1

- [X] T016 [US1] `apps/api/src/services/settings.service.ts` port từ `directus/api/src/services/settings.ts` thay bản
  001 (`class SettingsService extends ItemsService`; `setOwner` không `sendReport`, `// Backoffice: D-38`); xóa
  `PROJECT_FIELDS`, `CASTS`, `readProjectInfo`; `apps/api/src/services/server.service.ts` `serverInfo` dùng
  `readSingleton` với danh sách field của `directus/api/src/services/server.ts:45-66`; `providers.ts` factory
  `SettingsService` giữ; chạy bộ `src/server/info.test.ts` của 001 (guard output). Ghi manifest (FR-011, FR-012,
  research R2).
- [X] T017 [US1] `apps/api/src/controllers/settings.controller.ts` port từ `directus/api/src/controllers/settings.ts`
  theo mẫu `comments.controller.ts` (`GET /`, `POST /owner`, `PATCH /`); `app.module.ts` đăng ký controller và
  `useCollection('directus_settings')`; `app.test.ts`, `app-pipeline.test.ts` thêm ca. Cùng task:
  `tests/parity/proxy/backoffice-routes.txt` thêm `settings`; `tests/parity/src/proxy-conf.test.ts` ca `/settings` tới
  app mới; `tests/directus-app-e2e/src/routing.spec.ts` thêm `settings`; `tests/parity/src/request-set.ts` thêm
  `GET /settings` (public). Ghi manifest. Chạy T012 trên Postgres, MySQL, SQLite; ghi số ca vào "Ghi chú khi làm"
  (FR-001, FR-010).
- [X] T018 [US1] `apps/api/src/controllers/server.controller.ts` thêm `@Post('setup')` theo contracts/system-api.md §5
  (`isSetupCompleted` → `403`; `createAdmin`; `setOwner` không await; `Forbidden` → `204`; `respond`); bỏ comment
  "Not built yet ... D-14"; bật ca `403` của T007 trong `src/server/errors.test.ts`. Chạy T013 với cặp `setup`; ghi
  số user, role của ca R-28 ở Directus vào "Ghi chú khi làm" (FR-013, research R3).

**Checkpoint**: US1 xanh; app Directus qua proxy (`env-up --profiles=app`): Settings → Project lưu tên dự án đi tới
app mới, tiêu đề đổi (quickstart §2).

---

## Phase 4: User Story 2 - Preset layout và bookmark (Priority: P1)

**Goal**: CRUD `/presets` với quyền tối thiểu app access và các query của `stores/presets.ts` trả như Directus.

**Independent Test**: `tests/parity/src/system/presets.test.ts` xanh ba vendor.

- [X] T019 [P] [US2] `tests/parity/src/system/presets.test.ts` (`reduced`, `full`) theo contracts/parity.md §2: CRUD đơn
  và mảng; user app access: của mình, của user khác `403`, `user` khác mình `403`, preset role, toàn cục; query `_or`
  của `stores/presets.ts` với `limit=-1`; bookmark đổi tên, xóa; `CACHE_AUTO_PURGE_IGNORE_LIST`: đọc item có cache
  trước và sau khi ghi preset (header `x-cache-status` không đổi); `OPTIONS`, `HEAD` (US2 ca 1–3; FR-020, FR-021).
- [X] T020 [P] [US2] `apps/api/src/controllers/presets.controller.test.ts` theo `comments.controller.test.ts` (8 route,
  `Forbidden` → `204`, `OPTIONS`).
- [X] T021 [US2] `apps/api/src/controllers/presets.controller.ts` port từ `directus/api/src/controllers/presets.ts` theo
  mẫu `comments.controller.ts`; `providers.ts` factory `PresetsService`; `app.module.ts` đăng ký và
  `useCollection('directus_presets')`; proxy `presets`, `proxy-conf.test.ts`, `routing.spec.ts`, `request-set.ts`
  (`GET /presets` public). Ghi manifest. Chạy T019 ba vendor (FR-001, FR-020).

**Checkpoint**: US2 xanh; module Content của app Directus qua proxy lưu layout, bookmark vào app mới.

---

## Phase 5: User Story 3 - Thông báo trong app, không gửi email (Priority: P1)

**Goal**: CRUD `/notifications` qua `NotificationsService` (008) với D-33; blackbox `mail.test.ts` chạy hai lượt.

**Independent Test**: `notifications.test.ts` xanh ba vendor; `mail.test.ts` xanh ở `PARITY_BLACKBOX_APPS=directus,
backoffice`.

- [X] T022 [P] [US3] `tests/parity/src/system/notifications.test.ts` (`reduced`, `full`): `POST` đơn, mảng (dòng DB; số
  dòng log D-33 ở app mới bằng số người nhận có `email` và `email_notifications = true`), đọc theo `recipient`,
  `PATCH status` hàng loạt, `PATCH` field khác `403`, query của chuông (`aggregate[count]`, `filter[status]`),
  `DELETE`, `OPTIONS`, `HEAD`; event (FR-004): một flow `event` action scope `notifications.create` (009) ghi log
  `notifications-event-{{ $trigger.event }}`, `POST /notifications` ở mỗi app → đúng một activity `run` mới ở app nhận
  request với `$trigger.event = notifications.create` (poll ≤ 5 s), không có ở app kia (US3 ca 1–3; FR-004, FR-030,
  FR-031).
- [X] T023 [P] [US3] Blackbox: copy `directus/tests/blackbox/tests/db/mail/mail.test.ts` vào `tests/parity/src/items/
  blackbox/tests/db/mail/mail.test.ts`; bỏ SMTP giả và `sleep`; kiểm `200`, `GET /notifications?filter[recipient]
  [_eq]=<TESTS_FLOW>&sort=-id&limit=2` hai dòng `subject = inbox`; khi `PARITY_BLACKBOX_APP=backoffice` hai dòng
  `mail sending is out of scope` mới trong `logs('backoffice-api-blackbox')`; khối comment nêu D-33 và vì sao Directus
  không cần SMTP (research R15, contracts/parity.md §5). Ghi manifest.
- [X] T024 [P] [US3] `apps/api/src/controllers/notifications.controller.test.ts` theo mẫu 8 route.
- [X] T025 [US3] `apps/api/src/controllers/notifications.controller.ts` port từ `directus/api/src/controllers/
  notifications.ts`; `providers.ts` factory `NotificationsService` (đã có, giữ); `app.module.ts` đăng ký và
  `useCollection('directus_notifications')`; proxy `notifications`, `proxy-conf.test.ts`, `routing.spec.ts`,
  `request-set.ts`. Ghi manifest. Chạy T022 ba vendor và T023 hai lượt (FR-001, FR-030).

**Checkpoint**: US3 xanh; chuông thông báo của app Directus qua proxy đọc và lưu trữ qua app mới. **Đợt commit A**
(Phase 1 đến 5) lên `main`, CI xanh.

---

## Phase 6: User Story 4 - Chia sẻ item bằng link (Priority: P1)

**Goal**: `SharesService` port nguyên; `/shares/auth`, `/shares/invite`, `/shares/info/:pk`, CRUD trả cùng status,
body, cookie, dòng `directus_shares`, `directus_sessions` như Directus; token dùng chéo; mời ghi log (D-36).

**Independent Test**: `shares.test.ts` xanh ba vendor; `src/auth/shares.test.ts` của 003 xanh với share tạo ở mỗi app.

### Tests for User Story 4

- [X] T026 [P] [US4] `tests/parity/src/system/shares.test.ts` (`reduced`, `full`) theo contracts/parity.md §2: `POST
  /shares` có và không quyền `share`, `password` băm (so chéo `verifyHashAt`) và che `**********`; `POST /shares/auth`
  ba `mode` (body, cookie theo `REFRESH_COOKIE_OPTIONS`/`SESSION_COOKIE_OPTIONS`, dòng `directus_sessions`,
  `times_used`), hết hạn, chưa tới hạn, hết lượt, sai mật khẩu → `401`, thiếu `share`/`mode` sai → `400`, share
  không mật khẩu bỏ qua `password`; token của app A đọc item ở app B (item, quan hệ, item khác `403`), refresh, logout;
  `GET /shares/info/:id` (còn hạn, hết hạn `403`, không uuid `404`, không token); `POST /shares/invite` (số dòng log
  D-36 bằng số email; `403` không user; không đọc được share `403`); sửa `role`/xóa rồi dùng token cũ ở app kia; đếm
  phiên hết hạn trước/sau `/shares/auth`; R-25, R-27, R-29 (ghi kết quả đo trên Directus vào "Ghi chú khi làm");
  event (FR-004): flow `event` filter scope `shares.create` (009) với `throw-error` chặn được `POST /shares` ở cả hai
  app (cùng lỗi), và action `shares.update` chạy ở app nhận request (đếm activity `run`); `OPTIONS`, `HEAD` (US4 ca
  1–7; FR-004, FR-040 đến FR-046).
- [X] T027 [P] [US4] `apps/api/src/services/shares.service.test.ts`: `createOne` gọi `validateAccess` action `share`;
  `updateMany`, `deleteMany` gọi `clearCache` của quyền trước `super`; `login` (knex mock: điều kiện hạn, `max_uses >=
  times_used`, argon2, `times_used + 1`, JWT payload và `issuer`, insert `directus_sessions`, xóa phiên hết hạn, `mode
  session`); `invite` (`403` không user, dựng subject, một `logger.warn` mỗi email, không `fetch`/mail).
- [X] T028 [P] [US4] `apps/api/src/controllers/shares.controller.test.ts`: thứ tự route `/auth`, `/invite`, `/`,
  `/info/:pk` và `/:pk` (uuid; không uuid `404`; viết hoa qua); `/auth` joi và ba `mode`; `/invite` joi; 8 route CRUD;
  `OPTIONS`.
- [X] T029 [P] [US4] `apps/api/src/services/mail-sites.guard.test.ts`: quét `directus/api/src/**/*.ts` (bỏ `*.test.ts`)
  tìm `new MailService(`, tập file bằng `['services/users.ts', 'services/notifications.ts', 'services/shares.ts',
  'operations/mail/index.ts']` với số lần 3, 1, 1, 1; mỗi file ánh xạ sang `apps/api/src/{services/users.service.ts,
  services/notifications.service.ts, services/shares.service.ts, operations/mail/index.ts}` chứa `mail sending is out
  of scope`; thêm ca SC-005: không file nào trong `apps/api/src/**` (bỏ test) và `apps/api/package.json` nhắc tới
  `nodemailer`, `MailService`, `services/mail`, `EMAIL_TRANSPORT` (app mới không có mã nào mở kết nối gửi thư); đỏ cho
  tới T030 (FR-091, SC-005, research R8).

### Implementation for User Story 4

- [X] T030 [US4] `apps/api/src/services/shares.service.ts` port đủ từ `directus/api/src/services/shares.ts` (thay stub
  T008): `createOne`, `updateMany`, `deleteMany`, `login`, `invite` với `logger.warn('Backoffice: mail sending is out
  of scope; share invitation "<subject>" for <email> not sent')` thay `mailService.send` (`// Backoffice: D-36`), không
  import `md`; `providers.ts` factory. Ghi manifest. T027, T029 xanh (FR-040 đến FR-046, research R4).
- [X] T031 [US4] `apps/api/src/controllers/shares.controller.ts` port từ `directus/api/src/controllers/shares.ts` theo
  contracts/system-api.md §3 (thứ tự route; `/info/:pk` kiểm `UUID_REGEX` → `RouteNotFoundError`; `/auth` dùng
  `REFRESH_COOKIE_OPTIONS`, `SESSION_COOKIE_OPTIONS` và tên cookie từ env như `auth.controller.ts`); `app.module.ts`
  đăng ký và `useCollection('directus_shares')`; proxy `shares`, `proxy-conf.test.ts` (`/shares/auth`,
  `/shares/info/<uuid>` tới app mới), `routing.spec.ts`, `request-set.ts` (`GET /shares` public). Ghi manifest. Chạy
  T026 ba vendor.
- [X] T032 [US4] `tests/parity/src/auth/shares.test.ts` (003): `sharePerApp` tạo share ở mỗi app qua `/shares` của app
  đó (thay `directusRequest` cố định), `afterAll` xóa ở app tạo; comment đầu file cập nhật; chạy `src/auth/*.test.ts`
  xanh (FR-042).

**Checkpoint**: US4 xanh; sidebar Shares của app Directus qua proxy tạo share, trang `/admin/shared/<id>` đăng nhập
bằng mật khẩu và xem item qua app mới. **Đợt commit B**.

---

## Phase 7: User Story 5 - Tiện ích `/utils` (Priority: P1)

**Goal**: 10 route `/utils` trả như Directus; import JSON/CSV với bộ đếm chung; export 5 định dạng ra `directus_files`;
`translations/generate`; blackbox chuyển `/utils/cache/clear` sang app đang kiểm.

**Independent Test**: `utils-misc.test.ts` xanh ba vendor; `import-export.test.ts` xanh Postgres; unit gốc
`import-export.test.ts`, `generate-translations.test.ts`, `translations-shared.test.ts` xanh; blackbox hai lượt xanh.

### Tests for User Story 5

- [X] T033 [P] [US5] `tests/parity/src/system/utils-misc.test.ts` (`reduced`, `full`) theo contracts/parity.md §2:
  `random/string` (độ dài, bảng chữ nanoid, `length` 0, 501, `abc`, lặp, thiếu); `hash/generate` → `verify` chéo,
  thiếu field, hash hỏng; `sort` (dòng null, dòng trùng, không sort field `400`, `item`/`to` không có → đo Directus
  (`500` dự kiến), collection hệ thống có `sort_field`, user không quyền `403`, event `items.sort` qua flow action của
  009, data cache xóa; R-26); `revert` (item quay về, activity, revision; revision không có `403`; không `data` `400`);
  `cache/clear` (admin, non-admin `403`, `?system`, `?system=false` vẫn xóa, phép đo FR-086 với `/fields`);
  `translations/generate` (admin tạo rồi so `directus_collections`, `directus_fields`, `directus_relations`; non-admin
  `403`; payload sai `400`); `resolve-redirect` (hợp lệ, thiếu, `provider` sai, URL lạ); R-27; `OPTIONS` (US5 ca 1–4,
  7, 8; FR-080 đến FR-083, FR-086 đến FR-088, FR-051).
- [X] T034 [P] [US5] `tests/parity/src/system/import-export.test.ts` (`full`): import CSV, JSON (đơn giản, quan hệ, upsert
  theo khóa, lỗi validate → `400 FAILED_VALIDATION` với `rows` và rollback toàn bộ, loại file khác `415`, không
  multipart `415`, collection hệ thống non-admin `403`, không quyền `403`, thứ tự lỗi kép), `background=true` (thông
  báo thành công/thất bại, `recipient = sender`), bộ đếm chung qua khóa Redis `directus:import-export:importCount`
  (import nền ở A rồi B: tăng, tăng, về 0); export 5 format trên collection có dòng và rỗng (đợi `directus_files` ≤
  10 s, đọc qua `/assets/:id` ở hai app, so byte thân file, dòng `directus_files` sau `comparable`, `file` ghi đè
  `title`, `limit`, `fields` lồng, `filter`, `sort`, thông báo), thiếu `query`/`format` `400`, format sai → thông báo
  thất bại (US5 ca 5, 6; FR-084, FR-085).
- [X] T035 [P] [US5] `apps/api/src/controllers/utils.controller.test.ts` theo contracts/utils-api.md: 10 route, thứ tự
  kiểm của `import` (`collectionExists` → `415` → service), multipart qua busboy với stream thật (supertest `.attach`),
  `export` không await `exportToFile`, `cache/clear` ba dạng `system`, `translations/generate` admin và lỗi xóa cache
  chỉ log; `OPTIONS` từng route. `apps/api/src/services/utils.service.test.ts`: `sort` (knex mock theo từng bước, lỗi
  `400` không sort field, `403` field sort không được phép, event, cache), `clearCache` (`403`, `system`).
- [X] T036 [P] [US5] Test gốc port đỏ trước: `apps/api/src/services/import-export.test.ts` thay bản hiện có bằng bản
  đầy đủ từ `directus/api/src/services/import-export.test.ts` (37 ca; ánh xạ import; mock `../utils/store.js`,
  `./files.js`, `./notifications.js`); `apps/api/src/utils/generate-translations.test.ts` (23) và
  `translations-shared.test.ts` (3) từ `directus/api/src/utils/`. Ghi manifest.

### Implementation for User Story 5

- [X] T037 [P] [US5] `apps/api/src/services/utils.service.ts` port từ `directus/api/src/services/utils.ts` (`sort`,
  `clearCache`; `systemCollectionRows` từ `@backoffice/system-data`); `providers.ts` factory. Ghi manifest (FR-082,
  FR-086).
- [X] T038 [P] [US5] `apps/api/src/utils/generate-translations.ts`, `translations-shared.ts`,
  `translations-validation.ts` port từ `directus/api/src/utils/` (zod, `fromZodError`, `CollectionsService`,
  `FieldsService`, `RelationsService`, `ItemsService`, `getSchema`, `transaction`, `emitter`); T036 phần translations
  xanh. Ghi manifest (FR-051).
- [X] T039 [US5] `apps/api/src/services/import-export.service.ts` thêm phần còn lại từ `directus/api/src/services/
  import-export.ts`: `ImportService` (`import`, `importJSON`, `importCSV`, error tracker, `useStore`, `queue`,
  `Papa`, `StreamArray`, thông báo nền), `ExportService.exportToFile`, `getHeadingsForCsvExport`; sửa comment đầu
  file; T036 đủ 37 ca xanh. Ghi manifest (FR-084, FR-085, research R7).
- [X] T040 [US5] `apps/api/src/controllers/utils.controller.ts` port từ `directus/api/src/controllers/utils.ts` theo
  contracts/utils-api.md (busboy trên `req` thô như `files.controller.ts`; `runMiddleware(collectionExists)`;
  `RevisionsService.revert`; `generateTranslations`; `clearSystemCache`); `app.module.ts` đăng ký (không
  `useCollection`); proxy `utils`, `proxy-conf.test.ts` (`/utils/cache/clear` tới app mới), `routing.spec.ts`,
  `request-set.ts` (`GET /utils/random/string` public). Ghi manifest. Chạy T033 ba vendor, T034 Postgres; ghi kết quả
  đo (`sort` thiếu `item`, R-26, R-27) vào "Ghi chú khi làm" (FR-001, FR-080 đến FR-088).
- [X] T041 [US5] Blackbox đổi đích: `tests/parity/src/items/blackbox/common/functions.ts` gửi `/utils/cache/clear?system`
  tới `getSetupUrl()`; `common/config.ts` comment `getDirectusUrl` chỉ còn GraphQL (011);
  `tests/parity/src/items/cache-blackbox.test.ts` `/presets`, `/utils/cache/clear` tới app đang kiểm (`url()` thay
  `setup()`, sửa comment đầu file); chạy `parity-blackbox` hai lượt và `parity-cache` xanh (FR-101, research R15).

**Checkpoint**: US5 xanh; app Directus qua proxy: kéo thả sắp xếp, xuất CSV ra Files, nhập CSV qua app mới. **Đợt
commit C**.

---

## Phase 8: User Story 6 - Chuỗi dịch tùy chỉnh (Priority: P2)

**Goal**: CRUD `/translations` với kiểm trùng `key` + `language` như Directus.

**Independent Test**: `translations.test.ts` xanh ba vendor.

- [X] T042 [P] [US6] `tests/parity/src/system/translations.test.ts` (`reduced`, `full`): CRUD; trùng khi tạo, khi sửa một
  dòng thành trùng, khi sửa nhiều dòng với cả `key` và `language` (`400` dù không trùng); quyền tối thiểu đọc, ghi
  `403`; ghi ở app này đọc ở app kia; `OPTIONS` (US6 ca 1–2; FR-050).
- [X] T043 [P] [US6] `apps/api/src/services/translations.service.test.ts` (`translationKeyExists`, hai nhánh lỗi của
  `updateMany`) và `apps/api/src/controllers/translations.controller.test.ts` (8 route).
- [X] T044 [US6] `apps/api/src/services/translations.service.ts` port đủ từ `directus/api/src/services/translations.ts`
  (thay stub T008); `apps/api/src/controllers/translations.controller.ts` port từ `controllers/translations.ts`;
  `providers.ts` factory; `app.module.ts` đăng ký và `useCollection('directus_translations')`; proxy `translations`,
  `proxy-conf.test.ts`, `routing.spec.ts`, `request-set.ts`. Ghi manifest. Chạy T042 ba vendor (FR-001, FR-050).

**Checkpoint**: US6 xanh; Settings → Translations của app Directus qua proxy ghi vào app mới.

---

## Phase 9: User Story 7 - Dashboard và panel của Insights (Priority: P2)

**Goal**: CRUD `/dashboards` (lồng `panels`) và `/panels` như Directus.

**Independent Test**: `insights.test.ts` xanh ba vendor.

- [X] T045 [P] [US7] `tests/parity/src/system/insights.test.ts` (`reduced`, `full`): `POST /dashboards` lồng `panels`,
  `PATCH` lồng `create/update/delete`, `GET` kèm `panels.*` và `limit=-1`, `POST /panels`, `PATCH /panels/:pk`,
  `DELETE /dashboards/:pk` (panel mất), user không policy `403`, `OPTIONS` (US7 ca 1–2; FR-060, FR-061).
- [X] T046 [P] [US7] `apps/api/src/controllers/dashboards.controller.test.ts`, `panels.controller.test.ts` (8 route mỗi
  file).
- [X] T047 [US7] `apps/api/src/controllers/dashboards.controller.ts`, `panels.controller.ts` port từ
  `directus/api/src/controllers/{dashboards,panels}.ts`; `providers.ts` factory `DashboardsService`, `PanelsService`
  (service đã port ở T008); `app.module.ts` đăng ký và hai `useCollection`; proxy `dashboards`, `panels`,
  `proxy-conf.test.ts`, `routing.spec.ts`, `request-set.ts`. Ghi manifest. Chạy T045 ba vendor (FR-001, FR-060).

**Checkpoint**: US7 xanh; Insights của app Directus qua proxy tạo dashboard, panel vào app mới.

---

## Phase 10: User Story 8 - `/extensions` tối thiểu để app Directus chạy (Priority: P3)

**Goal**: `GET /extensions`, bundle rỗng, duyệt registry qua registry giả, cài/gỡ `503`, bật tắt `403` (D-37).

**Independent Test**: `extensions.test.ts` xanh (ca 1, 2 ba vendor; còn lại Postgres); app Directus qua proxy khởi
động với `/extensions` tới app mới.

### Tests for User Story 8

- [ ] T048 [P] [US8] `tests/parity/src/system/extensions.test.ts` (`reduced` ca 1–2, `full`): **đo trước**: `curl -si`
  `GET /extensions/sources/index.js` của Directus trong môi trường đối chiếu, so byte với
  `EMPTY_APP_EXTENSION_BUNDLE` của research R6 và ghi kết quả (sửa hằng nếu lệch); `GET /extensions` (admin `[]` hoặc
  dòng có sẵn; user thường: đo Directus `403` hay rỗng, ghi lại); bundle (byte, `Content-Type`, `Cache-Control`, với
  `Cache-Control: no-store`, `Vary`); chunk lạ `404`; registry giả: `/registry` (không query, `search`,
  `filter[type]`, type sai `403`, `sort=popular`, `limit`, `offset`), `/registry/account/:id`,
  `/registry/extension/:id` (có; id lạ → `503` cùng reason), không uuid `404`, non-admin `403`; `install`,
  `reinstall`, `uninstall`, `PATCH`, `DELETE /:pk` (so chỉ status ở Directus, `directus_extensions` không đổi; app mới
  `503`/`403` theo D-37, dùng `same()` với entry tạm cho tới khi D-37 `http` vào `accepted-differences.ts` ở T058);
  `OPTIONS` (US8 ca 1–4; FR-070 đến FR-072).
- [ ] T049 [P] [US8] Registry client: port `directus/packages/extensions-registry/src/{constants.ts, utils/
  get-api-version.ts, utils/assert-version-compatibility.ts, schemas/registry-version-response.ts, modules/{list,
  describe,account}/**}` (không `download`) vào `apps/api/src/extensions/registry/` với `index.ts`; 8 test gốc đỏ trước
  rồi xanh: `utils/get-api-version.test.ts`, `utils/assert-version-compatibility.test.ts`, `modules/list/list.test.ts`,
  `modules/list/lib/construct-url.test.ts`, `modules/describe/describe.test.ts`, `modules/describe/lib/construct-url.
  test.ts`, `modules/account/account.test.ts`, `modules/account/lib/construct-url.test.ts` (bỏ hai file của `download`;
  đếm ca ghi vào "Ghi chú khi làm"); `apps/api/src/extensions/registry/fixtures.test.ts` parse ba fixture của
  `tests/parity/registry/fixtures/` bằng schema đã port; `apps/api/src/controllers/utils/handle-registry-error.ts` port
  kèm test gốc `handle-registry-error.test.ts`. Ghi manifest (FR-072, research R6, R12).
- [ ] T050 [P] [US8] `apps/api/src/services/extensions.service.test.ts` (`readAll`: dòng `bundle` null → `schema:
  null`; dòng có `bundle` bị bỏ; `[]`; accountability truyền vào `ItemsService`); `apps/api/src/controllers/
  extensions.controller.test.ts` theo contracts/system-api.md §4 (10 route, admin, uuid, `ListQuery` từ
  `sanitizedQuery`, `MARKETPLACE_TRUST`, `MARKETPLACE_REGISTRY`, `503` reason, `403`, bundle và header, `SERVE_APP`
  tắt → `404`; `OPTIONS`).

### Implementation for User Story 8

- [ ] T051 [US8] `apps/api/src/services/extensions.service.ts` (Backoffice, `// Backoffice: no extension manager
  (Principle XI, D-37)`): `readAll()`, hằng `EMPTY_APP_EXTENSION_BUNDLE` (chuỗi đo ở T048); `providers.ts` factory.
  `apps/api/src/controllers/extensions.controller.ts` theo contracts/system-api.md §4 (thứ tự route: `/`, `/registry`,
  `/registry/account/:pk`, `/registry/extension/:pk`, `/registry/install`, `/registry/reinstall`,
  `/registry/uninstall/:pk`, `/sources/:chunk`, `/:pk` PATCH, DELETE; uuid qua `UUID_REGEX`; `SERVE_APP` từ env);
  `app.module.ts` đăng ký và `useCollection('directus_extensions')`; proxy `extensions`, `proxy-conf.test.ts`
  (`/extensions/sources/index.js` tới app mới), `routing.spec.ts`, `request-set.ts` (`GET /extensions` public). Ghi
  manifest. Chạy T048; mở app Directus qua proxy, kiểm console không lỗi nạp extension (FR-070 đến FR-072).

**Checkpoint**: US8 xanh; Marketplace của app Directus qua proxy duyệt được (registry giả), cài báo lỗi. **Đợt commit
D**.

---

## Phase 11: User Story 9 - Bộ test của Directus, E2E app Directus và benchmark chạy qua trên app mới (Priority: P2)

**Goal**: `e2e-app.test.ts`, Playwright `system.spec.ts`, `setup.spec.ts`, benchmark `system`, CI đủ profile.

**Independent Test**: `parity` full Postgres xanh gồm `src/system/**`; `e2e-directus-app` xanh với `app,setup`;
`benchmark-system` chạy được (không chặn).

- [ ] T052 [P] [US9] `tests/parity/src/system/e2e-app.test.ts` (`full`) theo contracts/parity.md §2: chuỗi request của
  `stores/settings.ts`, `stores/presets.ts`, `stores/notifications.ts`, `stores/translations.ts`, `stores/extensions.ts`,
  insights, sidebar chia sẻ, bảng sắp xếp, sidebar xuất nhập; so response (FR-103 phần API).
- [ ] T053 [P] [US9] `tests/directus-app-e2e/src/system.spec.ts` theo contracts/parity.md §7 (9 kịch bản, `bothRuns`, so
  dòng DB sau chuẩn hóa) và `tests/directus-app-e2e/src/setup.spec.ts` (app `directus-setup` `:10455/admin`, lượt
  Backoffice `page.route('**/server/setup', ...)` tới `:10456`, knex `6112` xóa giữa hai lượt; dự phòng
  `request.post` nếu `page.route` không bắt được, ghi lại); `tests/directus-app-e2e/src/helpers/db-rows.ts` thêm bảng
  mới vào `snapshot`; `playwright.config` không đổi (FR-103, research R13).
- [ ] T054 [P] [US9] `tests/benchmark/src/seed-system.ts`, `tests/benchmark/src/system.ts` theo contracts/parity.md §8
  (6 kịch bản; `utils-sort` không chặn); `tests/benchmark/project.json` target `system`; `.github/workflows/benchmark.yml`
  job `benchmark-system` (mẫu `benchmark-history`); chạy local 1 vòng, ghi số vào "Ghi chú khi làm", riêng p95 và req/s
  của `shares-auth` ở hai app để xác nhận ghi nhận CHK031 (cùng argon2, ngưỡng 10% áp được; lệch thì báo tech lead
  trước khi đổi ngưỡng) (FR-104, research R14).
- [ ] T055 [US9] CI: `.github/workflows/ci.yml` job `parity` dòng Postgres `full` và job `e2e-directus-app` thêm `setup`
  vào `--profiles`; `parity-matrix.yml`, `nightly.yml` `setup` chỉ ở Postgres; `tools/ci-local.sh` theo;
  `tests/parity/README.md` mục 010 (registry giả, cặp `setup`, blackbox mail). Chạy T052; `pnpm nx run
  directus-app-e2e:e2e` với `--profiles=app,setup` xanh; ghi thời gian job vào "Ghi chú khi làm" (contracts/parity.md
  §6).

**Checkpoint**: CI xanh toàn bộ với 9 segment tới app mới; benchmark-system có số liệu local.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Manifest, sổ khác biệt, spec cũ, bằng chứng rủi ro, đóng feature (Nguyên tắc X).

- [ ] T056 [P] `tools/port-manifest/010-T*.json` đủ cho mọi task port; `node tools/check-port-headers.mjs` xanh; mọi file
  mới có dòng `// Ported from` hoặc `// Backoffice:`; `pnpm nx run-many -t lint typecheck test` xanh, coverage ≥ 80%
  `apps/api`, `libs/utils`.
- [ ] T057 [P] Spec: điền cột "Bằng chứng" của R-25 đến R-29 (ca test, request, kết quả đo trên Directus, ngày) từ "Ghi
  chú khi làm"; sửa kết quả đo của `OPTIONS` vào contracts §10, §12; bundle rỗng vào research R6 (ngày đo trên
  container); `specs/001-platform-foundation/spec.md` dòng D-09.8, D-14 ghi "gỡ ở 010 (ngày)";
  `specs/004-permissions/spec.md` dòng D-31 thu hẹp và lâu dài; `checklists/system.md` ghi mục nào đổi sau đo.
- [ ] T058 Đóng feature (sau khi tech lead duyệt gỡ D-09.8, D-14, D-31 thu hẹp lâu dài, D-36, D-37, D-38, R-25 đến
  R-29): `tests/parity/accepted-differences.ts` xóa D-09.8, D-14; D-31 bỏ `removeAt`, reason lâu dài; thêm D-36
  (`doc`), D-37 (`doc` + `http` cho `POST /extensions/registry/install`, `POST /extensions/registry/reinstall`,
  `DELETE /extensions/registry/uninstall/*`, `PATCH /extensions/*`, `DELETE /extensions/*`, `location: any`), D-38
  (`doc`); `tests/parity/src/system/helpers.ts` bỏ `withoutD098`; T048 bỏ entry tạm; `spec.md` `Status: Done` và dòng
  `Duyệt khác biệt`; `CLAUDE.md` Recent Changes; commit `chore(010): close feature 010-system-collections`, push,
  theo dõi CI tới xanh. **Đợt commit E**.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 trước (cài gói) rồi T002 đến T007 song song (T005, T006 cùng chạm
  `docker-compose.yml`, `vendors.test.ts`: làm nối tiếp hoặc một người).
- **Phase 2 (Foundational)**: sau Phase 1. T008 đến T011 song song. CHẶN mọi story.
- **Phase 3 (US1)**: sau Phase 2 và T006 (cặp `setup`). T012 đến T015 song song; T016 → T017 → T018.
- **Phase 4 (US2)**, **Phase 5 (US3)**: sau Phase 2, độc lập với US1 và với nhau. Mỗi phase: test song song rồi
  controller.
- **Phase 6 (US4)**: sau Phase 2. T026 đến T029 song song; T030 → T031 → T032.
- **Phase 7 (US5)**: sau Phase 2; T033 (`revert`) cần 008 (có); `translations/generate` không phụ thuộc US6. T033 đến
  T036 song song; T037, T038 song song; T039 sau T036; T040 sau T037 đến T039; T041 sau T040 và T021 (`/presets`).
- **Phase 8 (US6)**, **Phase 9 (US7)**: sau Phase 2, độc lập.
- **Phase 10 (US8)**: sau Phase 1 (registry giả T005). T048 đến T050 song song; T051 cuối.
- **Phase 11 (US9)**: T052 sau US1 đến US8; T053 sau US1 đến US8 và T006; T054 sau US1, US2, US3, US4, US5, US7;
  T055 sau T052, T053.
- **Phase 12 (Polish)**: T056, T057 song song sau Phase 11; T058 cuối, sau duyệt.

### Within Each User Story

- Test đối chiếu, test service, test controller viết trước, đỏ, rồi service, controller, proxy.
- Test gốc port trước, đỏ, rồi code (T002, T010, T036, T049).
- Mỗi story kết thúc bằng một lượt `parity` đủ ở Postgres và rút gọn ở MySQL, SQLite.
- Mục spec ghi "đo" được đo trong T012 (`OPTIONS`), T013 (R-28), T026 (R-25, R-27, R-29), T033 (`sort`, R-26, R-27),
  T048 (bundle, `GET /extensions` user thường) và ghi lại vào spec ở T057.

### Parallel Opportunities

- Phase 1: T002 đến T007 song song sau T001.
- Phase 2: T008 đến T011 song song.
- US1: T012 đến T015 song song. US2, US3, US6, US7: test song song với nhau và với US1 sau Phase 2 (các story CRUD
  nhỏ có thể làm bởi người khác trong lúc US1 chạy).
- US4: T026 đến T029 song song. US5: T033 đến T036 song song; T037, T038 song song. US8: T048 đến T050 song song.
- US9: T052, T053, T054 song song.
- Polish: T056, T057 song song.

---

## Parallel Example: Phase 7 (US5)

```bash
# Bốn test song song (đỏ trước)
Task: "T033 tests/parity/src/system/utils-misc.test.ts"
Task: "T034 tests/parity/src/system/import-export.test.ts"
Task: "T035 apps/api/src/controllers/utils.controller.test.ts + services/utils.service.test.ts"
Task: "T036 test gốc import-export.test.ts, generate-translations.test.ts, translations-shared.test.ts"
# Rồi hai service song song
Task: "T037 apps/api/src/services/utils.service.ts"
Task: "T038 apps/api/src/utils/generate-translations.ts, translations-shared.ts, translations-validation.ts"
# Rồi tuần tự
Task: "T039 import-export.service.ts" → "T040 utils.controller.ts + proxy utils" → "T041 blackbox đổi đích"
```

## Parallel Example: Phase 4, 5, 8, 9 (bốn story CRUD)

```bash
Task: "T019 presets.test.ts"  Task: "T022 notifications.test.ts"  Task: "T042 translations.test.ts"  Task: "T045 insights.test.ts"
Task: "T020"  Task: "T024"  Task: "T043"  Task: "T046"   # test controller song song
Task: "T021"  Task: "T025"  Task: "T044"  Task: "T047"   # controller + proxy, mỗi task một segment
```

---

## Implementation Strategy

### MVP (Phase 1 đến 5, đợt commit A)

1. Phase 1, 2: gói, util, env, registry giả, cặp `setup`, helper, `getService`, `store`, `createAdmin`.
2. US1: settings đầy đủ, `/server/setup`; US2: presets; US3: notifications + blackbox mail.
3. **DỪNG và kiểm**: app Directus qua proxy hydrate với `/settings`, `/presets`, `/notifications` tới app mới; CI
   xanh; commit đợt A.

### Phần còn lại (Phase 6 đến 12)

- Đợt B: US4 shares (bảo mật, dùng chéo). Đợt C: US5 utils và import/export (nhiều test gốc nhất). Đợt D: US6, US7,
  US8 (CRUD nhỏ và extensions). Đợt E: US9 (E2E, benchmark, CI) rồi Polish và đóng feature.
- Nếu phải tách theo SPECKIT-GUIDE: đợt A + B là "settings, presets, notifications, shares"; đợt C + D + E là "utils,
  translations, insights, extensions".

## Notes

- [P] = khác file, không phụ thuộc task chưa xong.
- Mỗi task port có manifest `010-T###.json`; `check-port-headers` chạy ở CI `guard-directus`.
- Proxy thêm segment đúng ở T017, T021, T025, T031, T040, T044, T047, T051; không thêm sớm hơn.
- Ca đo trên Directus thật ghi vào "Ghi chú khi làm" ngay khi có số; T057 chép vào spec.
- Commit theo đợt A–E, pull `main` trước mỗi lần (session 009 còn push).

## Ghi chú khi làm

(Điền khi implement: `GET /extensions` của user thường; R-25 đến R-29; `sort` thiếu `item`/`to`; số ca mỗi file đối
chiếu theo vendor; thời gian job CI; số benchmark local.)

- 2026-10-14 T001: `pnpm install` 2,4 s (không gói native mới). `pnpm audit --prod --audit-level=high` exit 0. `stream-json`
  1.9.1 (bản của Directus 11.17.4) có ba advisory **moderate** (GHSA-528h-pc64-c93x filter O(depth²), GHSA-hqr4-qq8f-hg3x
  parser JSONC, GHSA-mjw6-4jj6-33hc prototype pollution trong `Assembler`); bản vá 3.6.0 đổi major (1.x → 3.x, ESM). CI
  chặn ở `high` nên không đỏ. Giữ bản Directus (cùng hành vi import); **cần owner quyết** nâng hay ghi chấp nhận như
  sharp/axios của 007.
- 2026-10-14 T004: `Allow` tính từ thứ tự route của chín router Directus. Đọc code thấy `/shares/:pk` cũng ràng buộc uuid
  (`shares.ts:199, 251, 299`), trái với research R4 cũ; đã sửa research R4, contracts/system-api.md §3 và T028.
- 2026-10-14 T006: dựng `registry`, `postgres-setup`, `directus-setup` (Directus 11.17.4 amd64 giả lập): DB setup có
  `directus_users` 0, `directus_roles` 1, `directus_policies` 2, `directus_access` 2, `directus_settings` 1; Redis db 9
  có 3 key, db 0 không có key `parity-setup*`; `GET :6113/version` → `2024-01-29`.
- 2026-10-14 T006 (đo cho T048, T051): `GET :10455/extensions/sources/index.js` của Directus trả đúng chuỗi
  `EMPTY_APP_EXTENSION_BUNDLE` của research R6 (từng byte); header: `Content-Type: application/javascript;
  charset=UTF-8`, `Cache-Control: no-cache`, `Vary: Origin, Cache-Control`, `x-cache-status: MISS`, **`Transfer-Encoding:
  chunked`** (Directus `pipe` stream, không có `Content-Length`): app mới phải gửi bằng stream để header trùng.
- 2026-10-14 T012: thêm `COMPLIANCE_URL=http://registry:9100` vào 9 file env và `POST|GET /v1/owner` vào registry giả,
  để Directus của môi trường đối chiếu không gửi báo cáo chủ dự án ra `telemetry.directus.io`; ca owner đo: Directus 1
  báo cáo, Backoffice 0, `project_status` null ở cả hai (D-38). FR-014 kiểm bằng `/server/info`, `auth_password_policy`,
  `auth_login_attempts` hai chiều; ca `storage_asset_presets` và issuer TFA chưa viết (đã có ở 007, 003 qua Directus).
  `settings.test.ts` 12 ca, `setup.test.ts` 6 ca xanh trên Postgres lượt đầu.
- 2026-10-14 T013 (R-28 đo trên Directus 11.17.4): hai `POST /server/setup` cùng lúc trên DB trống → `204, 400` ở cả
  hai app; 1 user, 2 role (role và policy của request thua ở lại: `createAdmin` không chạy trong transaction, user
  thứ hai vấp unique email → `400`). Cùng kết quả ở app mới.
- 2026-10-14 T016: `SettingsService` thay bản 001; toàn bộ unit `apps/api` 3.152 ca xanh; guard `src/server/info.test.ts`,
  `errors.test.ts`, `auth/login-attempts`, `auth/password`, `permissions/invite-register`, `db-unchanged` xanh.
- 2026-10-14 T020, T024, T043, T046: một file `apps/api/src/controllers/crud-controllers.test.ts` (29 ca) thay năm file
  test controller: năm controller Directus giống nhau trừ hai họ (presets, notifications, translations đọc với
  `singleton`/`keys`; dashboards, panels chỉ `readByQuery`, `DELETE /` không `validateBatch`, `|| null`), nên một file
  chạy cùng ca cho cả năm và ca riêng cho từng họ.
- 2026-10-14 T019, T022, T042, T045: `snap()` của 007 thay id bằng chuỗi con, id tự tăng nhỏ làm hỏng uuid và header
  (bài học 004); `system/helpers.ts` có `snap()` riêng chỉ thay giá trị trùng nguyên. Lượt đầu 28/29 xanh, ca trùng
  của translations sai do test (thứ tự `seeded` theo uuid), sửa test; sau đó presets, notifications, translations,
  insights, settings, db-unchanged xanh trên Postgres.
- 2026-10-14 T023: blackbox `mail.test.ts` xanh ở cả hai lượt (backoffice: 2 dòng log D-33; directus: 200 + 2 dòng).
  Cặp `blackbox` bật bằng `docker compose up --no-build` vì `registry.npmjs.org` không vào được lúc đó (EAI_AGAIN khi
  build image); image đã có code app mới nhất.

- 2026-10-14 T026, T031: `/shares/:pk` của Directus dùng regex uuid (không phân biệt hoa thường), id khác dạng →
  `ROUTE_NOT_FOUND` (sửa research R4). R-29 đo trên Directus: share có `password` nhưng payload `/shares/auth` thiếu
  `password` → `500 INTERNAL_SERVER_ERROR` ở cả hai app. R-25: `max_uses = n` cho `n + 1` lần đăng nhập thành công.
  Người chia sẻ cần quyền `create` trên `directus_shares` (thêm vào policy fixture).
- 2026-10-14 T033, T037: R-26 đo: `sort` bỏ qua bộ lọc hàng của quyền (hàng `published` vẫn dời) và không ghi activity,
  ở cả hai app. `sort` với `to` là item không tồn tại → `500` (TypeError đọc giá trị sort), giống Directus. Collection
  hệ thống không có `sort_field` → `400`. `?system=false` vẫn xoá system cache (Directus chỉ kiểm `'system' in query`).
- 2026-10-14 T040: Nest `@Post` mặc định 201, nên mọi POST trả bằng `res.json`/`res.end` có `@HttpCode(200)`
  (`resolve-redirect` đỏ 200/201 ở lượt đầu). `LimitExceededError` là 403 (không phải 429); bộ đếm import là một
  key Redis `directus:import-export:importCount` dùng chung, đặt `20` thì cả hai app trả 403 `LIMIT_EXCEEDED`.
  `utils-misc`, `shares`, `import-export`: 39/39 xanh trên Postgres.
- 2026-10-14 CI 2588460: ba lỗi do test cũ gặp route mới: canary `IMPORT_TIMEOUT` của `startup.test.ts` nay là biến
  được đọc → đổi sang `EMAIL_TRANSPORT`; `request-set` gửi `POST /translations {}` là `500` ở cả hai app (Directus kiểm
  trùng key trước quyền, knex báo binding undefined) → thêm `key`, `language`; `methods.test.ts` ca D-14 của
  `/server/setup` → 403 ở cả hai, `OPTIONS` → `Allow: POST`. Bản port đủ của `import-export.service` kéo
  `notifications.service` (gọi `useLogger()` khi nạp module) vào `respond.ts`: mock `@backoffice/env` của
  `respond.test.ts` và `server.controller.test.ts` trả `{}` mặc định. Unit `apps/api` 3.291 ca, coverage dòng 87,2%.
