# Implementation Plan: Đồng bộ cấu hình từ môi trường khác (kéo qua URL và token)

**Branch**: `032-environment-sync` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=032-environment-sync`) | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/032-environment-sync/spec.md`

## Summary

Admin ở môi trường đích mở Settings > Đồng bộ môi trường, nhập URL và static token admin của một Backoffice nguồn, xem
bảng so sánh theo mười nhóm, tick dòng hoặc nhóm rồi áp dụng. API thêm bốn route chỉ admin dưới `/backoffice/sync`:
`GET` thông tin instance (cũng là probe của web), `GET …/state` trạng thái cấu hình, `POST …/diff`, `POST …/apply`.
Nguồn chỉ phục vụ hai `GET`; đích gọi chúng bằng `getAxios()` rồi chạy cùng hàm `readState()` trên DB của mình (research
R1, R2). Data model dùng lại `getSnapshotDiff` và `applyDiff` (R3). Lượt áp dụng chạy trong một transaction dưới khóa
Redis, ghi qua các service có sẵn để có activity và revision, rồi sau commit mới xóa cache, reload flow, reload
extension và chạy job index (R4, R5, R6, R10). Không lưu gì: URL và token chỉ nằm trong body của `POST` và trong `ref`
của trang (R11, R12). Kiểm thử: profile parity mới `sync` với hai node đích trên một Postgres riêng (R13).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23; swc cho `apps/api`, Vite cho
`apps/web`.

**Primary Dependencies**: không gói mới. Có sẵn: NestJS 12, Knex 3.1, axios qua `getAxios()` (`apps/api/src/request`),
Joi, `object-hash` (`getVersionedHash`), khóa Redis (`useLock`), bus, `getSnapshot`/`getSnapshotDiff`/`applyDiff`,
`ItemsService` và các service roles, policies, access, permissions, backoffice-permissions, settings, translations,
presets, dashboards, panels, folders, extensions, backoffice-indexes, `@backoffice/errors` (`InvalidPayloadError`,
`ForbiddenError`, `InvalidCredentialsError`, `ServiceUnavailableError`); web: Vue 3.5, Reka UI 2.8.2, Tailwind 4.3,
`@directus/sdk` 21.3.0 (`apiFetch`, `requestEndpoint`), PrivateView, BoInput, BoCheckbox, BoTable, BoDetail, BoTabs,
BoDialog, BoNotice, BoButton, `notify`; test: Vitest 3.2.4, supertest, Playwright 1.64.0.

**Storage**: không bảng, cột, migration mới; không ghi gì của riêng feature. Dữ liệu đích đổi là các dòng của bảng có sẵn
([data-model.md](./data-model.md)). Redis: chỉ khóa `backoffice-sync-apply` trong lúc áp dụng. Không vào response cache
(`res.locals.cache = false`).

**Testing**: unit `apps/api` (`sync/*`, service, controller supertest) và `apps/web` (probe, composable, route, browser
test với axe); parity `sync/route.test.ts` trên cặp chính ở ba vendor và bốn file trên profile `sync` (Postgres);
`accepted-differences` D-214, D-214.1; E2E `settings-sync.spec.ts` ba cấu hình ([contracts/tests.md](./contracts/tests.md)).

**Target Platform**: Linux `amd64` container (API); trình duyệt desktop và tablet (web).

**Project Type**: BE (`apps/api`) + FE (`apps/web`, `apps/web-e2e`) + test (`tests/parity`) + tài liệu vận hành.

**Performance Goals**: không đường đọc, ghi item nào đổi; benchmark hiện có không đổi, không scenario mới. SC-006 (200
collection, 100 flow, 2.000 permission: bảng so sánh dưới 30 giây) đo một lần ở lượt 1, không vào CI.

**Constraints**: không sửa `directus/` (I); không DDL của riêng feature, ghi vào bảng hệ thống chỉ qua service của API
(II); route có sẵn không đổi, route mới dưới `/backoffice/` ghi D-214 (III, X); không state quan trọng trong process,
khóa qua Redis (IV, VII); parity cho route mới (V); không biến env mới: timeout 30 s, không theo redirect, trần 100 MB là
hằng số (VIII); comment "DR" (IX); coverage BE ≥ 80 %, FE ≥ 60 % (X); bố cục trang là câu hỏi mở Q-49 (XII); không mã lỗi
mới.

**Scale/Scope**: API mới: `controllers/backoffice-sync.controller.ts`, `services/backoffice-sync.service.ts`,
`sync/{types,groups,state,diff,source,apply}.ts` (mỗi file kèm `.test.ts` trừ `types`); sửa: `app.module.ts`,
`providers.ts`. Web mới: 2 composable, 1 route, 5 component; sửa: `modules/settings.ts`, `SettingsNavigation.vue`, overlay
×2, `test-utils/fetch.ts`. Parity: compose, `env/bootstrap-init.sql`, `scripts/env.mjs`, `src/config.ts`, `src/docker.ts`,
`src/global-setup.ts`, `src/suite.ts`, `registry/server.mjs`, `accepted-differences.ts`, 5 file test; CI `ci.yml` (profile
`sync` ở parity Postgres và `e2e-web`). E2E: 1 spec + `allowed-paths.ts`. Tài liệu: `deploy/README.md`,
`tests/parity/README.md`, `design-system/docs/component-specs.md` (Q-49 sau khi duyệt), spec 016 ghi chú "(032: ...)",
`CLAUDE.md`, `SPECKIT-GUIDE.md`. D-214, D-214.1.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.4.0). Mark PASS, or VIOLATION with a row in Complexity
Tracking.

- [x] I. PASS: không sửa `directus/`. Code mới (`sync/*`, service, controller) không phải bản port, đầu file ghi
  "Backoffice (spec 032)". Không file port nào bị sửa.
- [x] II. PASS: không bảng, cột, migration. Mọi ghi vào `directus_*` và `backoffice_*` đi qua service của API (cùng
  đường với sửa tay), DDL của collection người dùng qua `applyDiff` như `/schema/apply`. Dòng tạo ra có cùng dạng với
  dòng do các thao tác có sẵn ghi; id uuid của bảng hệ thống là id v4 chép từ nguồn (giá trị client gửi được giữ, 027).
- [x] III. PASS với D-214 (bốn route chỉ Backoffice, Directus 404). Không route, query, response hay mã lỗi có sẵn nào
  đổi; không có trong OAS và GraphQL.
- [x] IV. PASS: không state trong process ngoài một cờ "đang áp dụng" bổ sung cho khóa Redis (R6); thay đổi schema,
  permission, flow, extension báo mọi replica và Directus qua bus sau commit (R5); dùng chung `SECRET`, Redis như cũ.
- [x] V. PASS: `sync/route.test.ts` chạy với Directus thật và Backoffice trên Postgres, SQLite, MySQL (Directus 404,
  Backoffice 200/403/401). Phần so sánh và áp dụng cần hai Backoffice trên hai DB nên chạy ở profile `sync`, chỉ
  Postgres, theo quyết định clarify 5 của chủ dự án (vendor khác ghi "chưa đo"); cùng lệ với profile `extensions`,
  `bootstrap`.
- [x] VI. PASS: controller mỏng, logic trong `BackofficeSyncService` và `sync/*`; Knex qua service, không ORM; Vue 3
  Composition API, composable + component; mỗi file có test.
- [x] VII. PASS: không config FE mới; khóa áp dụng trên Redis; hai node đích trong parity kiểm thay đổi có hiệu lực ở
  node không nhận request (FR-029); SIGTERM giữa lượt áp dụng: transaction chưa commit bị DB hủy, không có dòng dở; job
  index theo cơ chế của 030.
- [x] VIII. PASS: không biến env mới; `IMPORT_IP_DENY_LIST` giữ nghĩa cũ và áp cho URL nguồn.
- [x] IX. PASS: comment "DR"; tên hiển thị "Backoffice"; tên bảng, mã lỗi, tên event giữ.
- [x] X. PASS: spec và plan tiếng Việt, code tiếng Anh; coverage; không email; D-214, D-214.1 trong spec, chủ dự án
  kiêm tech lead duyệt 2026-11-14; log không chứa URL, token (R11).
- [x] XI. PASS: không chạm SAML, storage ngoài phạm vi, email, websocket, theme extension, AI/MCP. Khóa API của AI trong
  settings bị loại khỏi so sánh (R9).
- [x] XII. PASS: đã đọc `design-system/README.md`, `component-specs.md`, `layout-patterns.md`,
  `handoff-checklist.md`. Thành phần lấy từ recipe có sẵn, không component dùng chung mới, `BoTable` không sửa. Bố cục
  trang chưa có mẫu: câu hỏi mở Q-49, đề xuất ở [contracts/web.md](./contracts/web.md), design owner chọn đề xuất đó
  2026-11-14.

**Re-check sau Phase 1**: không đổi; không vi phạm. Chủ dự án kiêm tech lead và design owner duyệt
2026-11-14 ("duyệt như đề xuất"): D-214, D-214.1, Q-49 theo bố cục đề xuất, năm mặc định của spec, ba điểm ở Complexity
Tracking và các sửa câu chữ spec dưới đây.

## Project Structure

### Documentation (this feature)

```text
specs/032-environment-sync/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R14)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/
├── sync/                                               # mới, Backoffice (spec 032)
│   ├── types.ts                                        # GroupKey, SyncInfo, SyncState, SyncRow, SyncResult
│   ├── groups.ts (+ .test.ts)                          # registry tĩnh: bảng, khóa, cột bỏ, phụ thuộc, thứ tự (data-model)
│   ├── state.ts (+ .test.ts)                           # readState(groups, { knex, schema, accountability }) (R1, R9, R10)
│   ├── source.ts (+ .test.ts)                          # normalizeUrl, fetchInfo, fetchState qua getAxios; lỗi làm sạch (R2, R11)
│   ├── diff.ts (+ .test.ts)                            # diffStates → SyncRow[], depends, selectable, impact, hash (R3, R7, R14)
│   └── apply.ts (+ .test.ts)                           # transaction, thứ tự, kiểm admin, việc sau commit, index (R4, R5, R10)
├── services/backoffice-sync.service.ts (+ .test.ts)    # info(), state(), diff(), apply(); khóa (R6)
├── controllers/backoffice-sync.controller.ts (+ .test.ts)   # 4 route, admin, cache false, Joi (contracts/api.md)
├── app.module.ts, providers.ts                         # đăng ký controller và service
apps/web/src/
├── composables/use-environment-sync.ts (+ .test.ts)    # probe GET /backoffice/sync
├── modules/settings.ts                                 # route settings-sync
├── modules/settings/components/SettingsNavigation.vue (+ .test.ts)   # link có điều kiện
├── modules/settings/routes/sync/
│   ├── SyncRoute.vue (+ .test.ts, .browser.test.ts)
│   ├── use-sync.ts (+ .test.ts)
│   └── components/{SyncConnectForm,SyncGroup,SyncRowDetail,SyncConfirmDialog,SyncResult}.vue
├── lang/overlay/en-US.ts, vi-VN.ts                     # khối Spec 032 (contracts/web.md)
└── test-utils/fetch.ts                                 # KNOWN_REQUESTS bốn route
apps/web-e2e/src/
├── settings-sync.spec.ts (mới)                         # ba cấu hình (contracts/tests.md §4)
└── helpers/allowed-paths.ts, helpers/config.ts         # bốn route; URL và token của nguồn
tests/parity/
├── docker-compose.yml                                  # backoffice-api-sync, backoffice-api-sync-2 (profile sync); postgres-bootstrap thêm profile sync
├── env/bootstrap-init.sql                              # CREATE DATABASE backoffice_sync
├── scripts/env.mjs, src/config.ts, src/docker.ts, src/global-setup.ts, src/suite.ts   # profile sync, cổng 10856, 10857
├── registry/server.mjs                                 # route giả /sync-fake/*
├── accepted-differences.ts                             # D-214, D-214.1 (doc)
└── src/sync/{route,diff,apply,refuse,no-trace}.test.ts (mới)
.github/workflows/ci.yml                                # profile sync ở parity Postgres và e2e-web
deploy/README.md                                        # mục "Đồng bộ cấu hình giữa các môi trường (spec 032)"
design-system/docs/component-specs.md                   # recipe Q-49 sau khi design owner duyệt
specs/016-settings-module/spec.md                       # "(032: ...)" ở phần menu Settings
tests/parity/README.md, CLAUDE.md, SPECKIT-GUIDE.md     # 032, D-214, D-214.1
```

**Structure Decision**: không project Nx mới, không lib mới. API: một thư mục `sync/` cạnh `request/`, `lock/` cho logic
thuần của feature, controller và service theo lệ `backoffice-*`. Web trong module settings có sẵn. Parity và E2E theo lệ
profile của 020, 021, 029.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm. Ba điểm chủ dự án đã duyệt 2026-11-14 cùng D-214:

| Điểm | Lý do | Cách đơn giản hơn bị bác |
|------|-------|--------------------------|
| Nguồn có thêm `GET /backoffice/sync/state` (guide ghi "nguồn chỉ cần `GET /backoffice/sync` và các endpoint REST đã có") | Hai bên đọc bằng cùng một hàm nên so khớp chắc; field mã hóa không rời nguồn; một request thay cho khoảng 15 endpoint (R1) | Đọc từng endpoint REST: lệch cách tuần tự hóa, N request index, phải lọc dòng tổng hợp |
| Flow và operation ghi bằng `ItemsService` trực tiếp, không qua `FlowsService`/`OperationsService` | Hai service đó reload flow sau mỗi ghi và reload đọc dữ liệu trước commit; ghi trực tiếp rồi reload một lần sau commit (R5). Activity và revision vẫn có | Dùng hai service: N lần reload vô ích trên mọi replica, vẫn phải reload lại sau commit |
| Bộ so sánh và áp dụng chỉ chạy trên Postgres | Quyết định clarify 5 của chủ dự án; cần hai Backoffice trên hai DB, như profile `extensions`, `bootstrap`. Route test vẫn chạy ba vendor (Nguyên tắc V) | Dựng profile `sync` cho SQLite và MySQL: thêm hai bộ service, chủ dự án đã chọn không đo |

## Sửa câu chữ spec khi `/speckit.plan` (2026-11-14; chủ dự án duyệt cùng ngày)

- D-214, FR-004, bảng "Đánh giá hiện trạng" dòng 3: nguồn phục vụ hai thao tác chỉ đọc (thông tin và trạng thái cấu
  hình), không đọc qua các endpoint REST có sẵn (R1).
- FR-024: người tạo, thời điểm tạo và tương tự **không được so và không được chép**; đích tự ghi như khi tạo tay (người
  tạo là admin đang thao tác), không "đặt rỗng" (R10). Duyệt 2026-11-14.
- FR-025, US5 kịch bản 7, quickstart: trên Postgres cấu trúc và dòng nằm chung một transaction nên lỗi hoàn tác cả hai;
  câu "thay đổi cấu trúc không hoàn tác được thì liệt kê" chỉ áp cho vendor DDL tự commit (chưa đo). Index được **tạo và
  xóa** sau commit, ngoài phần hoàn tác (R4, R10).
- FR-021, US4 kịch bản 5, Edge Cases: xóa role làm user "bị đình chỉ và mất role" (không chỉ "mất role"); xóa policy xóa
  theo permission của nó; xóa folder đưa file về gốc và cần folder con được tick cùng (R8).
- FR-007 nhóm 1: không gồm cờ index trên field hệ thống (`systemFields` của snapshot) (R3).
- FR-034: ô token dạng password với `autocomplete="off"`; trình duyệt vẫn có thể đề nghị lưu, không kiểm soát hết (R12).
- Edge case "URL trỏ về chính đích": qua địa chỉ công khai thì được; `localhost` bị danh sách chặn mặc định chặn (R2).
- FR-026: với Redis, lượt thứ hai chờ tối đa khoảng 5 giây rồi nhận lỗi; cùng process thì lỗi ngay (R6).
- Mới ở Edge Cases: token sai ở nguồn báo 400 ở đích, không 401 (R11); hai dòng cùng khóa ở một bên thì dòng sau không
  tick được (data-model).
