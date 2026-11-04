# Implementation Plan: Cài extension bằng gói `.tgz` tải lên

**Branch**: `031-extension-upload` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=031-extension-upload`) | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/031-extension-upload/spec.md`

## Summary

Admin tải một gói `.tgz` của `npm pack` lên từ Settings > Extensions (nút "Upload extension") hoặc
`POST /backoffice/extensions/upload` (multipart, admin). Backoffice giải nén và kiểm gói bằng đúng phần sau khi có stream
của luồng cài từ registry (tách thành `installFromStream`, research R1), từ chối gói sai/trùng tên/không sandbox khi
`MARKETPLACE_TRUST=sandbox` với 400 và không để lại gì (R2, R4), chép gói vào `.upload/<uuid>` của kho dùng chung và
local (R3), ghi dòng `directus_extensions` với `source: 'upload'` trong `withSettingsLock` (R5), báo mọi replica nạp qua
bus như registry. Gỡ qua uninstall có sẵn (nới cho `upload`, D-212.3); reinstall 400. Directus cùng DB giữ dòng, hiện
"Missing", không chạy gói và không quét thư mục ẩn `.upload` (D-212.1, đo thật trong parity FR-023). Web: composable
probe + dialog chọn file + chip "Uploaded" + menu (R6). Fixture `.tgz` đã có sẵn, thêm một fixture `name` riêng (R7).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23; swc cho `apps/api`, Vite cho
`apps/web`.

**Primary Dependencies**: không gói mới. Có sẵn: NestJS 12, Busboy 1.6.0 (`files.controller.ts`), `bytes`, `tar` 7.5.19,
`fs-extra`, `p-queue`, `@backoffice/storage*` (kho dùng chung), `@backoffice/extensions` (`ExtensionManifest`,
`EXTENSION_PKG_KEY`, `resolveFsExtensions`, `generateExtensionsEntrypoint`), `@backoffice/errors` (`InvalidPayloadError`,
`ContentTooLargeError`, `LimitExceededError`, `ServiceUnavailableError`), lock Redis (`withSettingsLock`), bus; web: Vue
3.5, Reka UI 2.8.2, Tailwind 4.3, `@directus/sdk` 21.3.0 (`apiFetch`), BoDialog/BoButton/BoNotice/BoChip/
BoProgressCircular, `notify`, `translateAPIError`; test: Vitest 3.2.4, supertest, Playwright 1.64.0.

**Storage**: không bảng/cột/migration mới; dòng `directus_extensions` với `source: 'upload'`; thư mục
`<EXTENSIONS_PATH>/.upload/<id>` ở kho dùng chung (`EXTENSIONS_LOCATION`) và bản sao local; thư mục tạm
`<TEMP_PATH>/upload-extensions/<id>` ([data-model.md](./data-model.md)); không Redis mới (dùng khóa `extensions-settings`
có sẵn); không vào response cache.

**Testing**: unit `apps/api` (installation manager với tar thật, get-extensions, settings, manager, service, controller
supertest multipart) và `apps/web` (composable, dialog browser test + axe, route, item, menu); parity
`extensions/upload.test.ts` trên profile `extensions` (Postgres; gồm bước đo Directus FR-023), `accepted-differences`
D-212..D-212.3; deploy `extension-upload.test.ts` (3 replica, SC-004); E2E `settings-extensions-upload.spec.ts` ba cấu
hình ([contracts/tests.md](./contracts/tests.md)).

**Target Platform**: Linux `amd64` container (API); trình duyệt desktop/tablet (web).

**Project Type**: BE (`apps/api`, `libs/extensions`, `libs/types`) + FE (`apps/web`, `apps/web-e2e`) + test
(`tests/parity`, `tests/fixtures/extensions`) + deploy docs.

**Performance Goals**: không đường đọc/ghi item nào đổi; benchmark hiện có không đổi (không scenario mới). Tải lên: thời
gian = giải nén + chép lên kho (như cài từ registry); SC-004 cả ba replica trả lời trong ≤ 10 s sau khi tải (bus +
partialSync, như registry đo ở 020 SC-003).

**Constraints**: không sửa `directus/` (I); không DDL, không migration (II); endpoint có sẵn giữ đường/response, route
mới dưới `/backoffice/` ghi D-212, D-212.2/D-212.3 trên dòng `upload` (III, X); không state quan trọng trong process (file
ở kho, dòng ở DB, reload qua bus) (IV, VII); parity cho route mới và route có sẵn đổi hành vi (V); không biến env mới
(VIII); comment "DR", `Backoffice (spec 031, D-212)` ở file port (IX); coverage BE ≥ 80 %, FE ≥ 60 % (X); dialog/nút/chip
từ recipe có sẵn, trạng thái và bàn phím đủ (XII); không mã lỗi mới (409 của spec thành 400 `INVALID_PAYLOAD`, R4).

**Scale/Scope**: API 2 file mới (`controllers/backoffice-extensions.controller.ts`, `+ .test.ts`) + 9 file sửa
(`extensions/lib/installation/manager.ts`, `extensions/manager.ts`, `extensions/lib/get-extensions.ts`,
`extensions/lib/get-extensions-settings.ts`, `services/extensions.service.ts`, `app.module.ts`,
`libs/extensions/src/node/utils/generate-extensions-entrypoint.ts`, `libs/types/.../extensions.ts`, `cli` không đổi); web
2 file mới (`composables/use-extension-upload.ts`, `components/ExtensionUploadDialog.vue`) + 5 sửa (`ExtensionsRoute.vue`,
`ExtensionItem.vue`, `ExtensionItemOptions.vue`, overlay ×2, `test-utils/fetch.ts`); fixture 2 mới
(`parity-upload-endpoint`, `parity-upload-bundle` với dist + tgz; analyze C1); parity 1 mới + `accepted-differences.ts`; deploy test 1 mới; E2E 1 spec +
`allowed-paths.ts`; docs 5 file; D-212..D-212.3.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.4.0). Mark PASS, or VIOLATION with a row in Complexity
Tracking.

- [x] I. PASS: không sửa `directus/`; `installation/manager.ts`, `manager.ts`, `get-extensions.ts`,
  `get-extensions-settings.ts`, `extensions.service.ts`, `generate-extensions-entrypoint.ts` giữ `Ported from`, mỗi chỗ
  sửa ghi `Backoffice (spec 031, D-212)`; file mới ghi "Backoffice (spec 031)".
- [x] II. PASS: không DDL; dòng `directus_extensions` với giá trị `source` mới trên cột string không ràng buộc; DB vẫn
  dùng được bởi Directus không cần file/config mới (Directus giữ dòng, hiện Missing; D-212.1 đo thật).
- [x] III. PASS với D-212 (route chỉ Backoffice, 404 ở Directus), D-212.2 (`GET /extensions` trả schema cho dòng
  `upload`), D-212.3 (uninstall nhận `upload`); mọi endpoint có sẵn không đổi với dòng `local`/`registry`/`module` (unit
  020 + parity `extensions` xanh nguyên).
- [x] IV. PASS: không state quan trọng trong process: gói ở kho dùng chung, dòng ở DB, replica nạp qua bus
  `partialSync`; khóa Redis có sẵn chỉ quanh tạo dòng; mất process giữa chừng → thư mục tạm bỏ lại trong `TEMP_PATH`
  (thư mục tạm của container, không dọn riêng, như `marketplace/<versionId>` của registry; checklist CHK036), không
  dòng, không `.upload/<id>` hoàn chỉnh vì `package.json` chép cuối (khi đã đủ thì khởi động tạo dòng, FR-011).
- [x] V. PASS: `extensions/upload.test.ts` cho route mới (Directus 404), `GET /extensions` hai app (D-212.2), uninstall
  hai app (D-212.3), đo Directus khởi động lại (FR-023); deploy 3 replica.
- [x] VI. PASS: controller mỏng NestJS, logic trong `ExtensionsService`/`InstallationManager`/`ExtensionManager` (port);
  Vue 3 Composition API, composable + component.
- [x] VII. PASS: không config FE mới; gói lên kho dùng chung và `partialSync` như registry (020 đã kiểm 3 node); replica
  khởi động lại sync `.upload` theo sync đầy đủ (R3); SIGTERM giữa chừng: xem IV; không cache process mới.
- [x] VIII. PASS: không biến env mới; `FILES_MAX_UPLOAD_SIZE`, `MARKETPLACE_TRUST`, `EXTENSIONS_LIMIT`,
  `EXTENSIONS_LOCATION`, `EXTENSIONS_PATH`, `TEMP_PATH` có sẵn với nghĩa cũ; cảnh báo `host` so major bằng chuỗi, không
  thêm `semver` (analyze U1).
- [x] IX. PASS: comment "DR"; chuỗi "Backoffice" trong mô tả dialog; mã lỗi, tên bảng `directus_*`, thông điệp lỗi có
  sẵn giữ.
- [x] X. PASS: tiếng Việt cho spec/plan, tiếng Anh cho code; coverage; không email; D-212..D-212.3 trong spec, chủ dự
  án kiêm tech lead duyệt sau plan; log pino `info` khi cài/gỡ, `warn` khi `host` không khớp (clarify Q1), không ghi nội
  dung gói.
- [x] XI. PASS: không `.zip`, không URL, không ký gói, không nâng cấp tại chỗ, không đổi sandbox runtime.
- [x] XII. PASS: đọc `design-system/README.md`, `component-specs.md` (Button, Modal, Chip, Notice, Upload drop zone),
  `layout-patterns.md` (page header actions), `handoff-checklist.md`; dialog/nút/chip từ recipe, token theme, trạng thái
  (idle/selected/uploading/error/success), bàn phím, nhãn liên kết; câu hỏi mở (vị trí nút, chữ chip) ở "Cần xác nhận"
  của spec.

**Re-check sau Phase 1**: không đổi; không vi phạm. D-212..D-212.3, một điểm Complexity Tracking và các sửa câu chữ
spec dưới đây: chủ dự án duyệt 2026-11-04 (spec, mục "Duyệt 2026-11-04").

## Project Structure

### Documentation (this feature)

```text
specs/031-extension-upload/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R9)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/
├── extensions/
│   ├── lib/installation/manager.ts (+ .test.ts)      # installFromStream(stream, { source, folder }); install() gọi nó; uninstall(folder, source); kiểm name/sandbox/limit; lỗi Backoffice đi qua nguyên (R1, R2)
│   ├── lib/get-extensions.ts (+ .test.ts)            # map upload từ .upload (R3)
│   ├── lib/get-extensions-settings.ts (+ .test.ts)   # vòng lặp upload như local, không marketplace (R3)
│   └── manager.ts (+ .test.ts)                       # uploadExtensions; getExtension/extensions/registerApiExtensions/entrypoint/watcher; installed({source, folder}); uninstall(folder, source); warn host (R3, R5)
├── services/extensions.service.ts (+ .test.ts)       # installUpload(stream) trong withSettingsLock; uninstall nhận upload; reinstall giữ (R5)
├── controllers/backoffice-extensions.controller.ts (+ .test.ts, mới)   # GET/POST /backoffice/extensions/upload: Busboy một file, 413, 200 ApiOutput (R5)
└── app.module.ts                                     # controller + useCollection('directus_extensions')
libs/extensions/src/node/utils/generate-extensions-entrypoint.ts (+ .test.ts)   # kiểu tham số nhận map upload
libs/types/src/extensions.ts (hoặc file chứa ExtensionSettings)                 # source: 'local' | 'registry' | 'module' | 'upload'
apps/web/src/
├── composables/use-extension-upload.ts (+ .test.ts, mới)              # available (probe GET), maxUploadSize, upload(file) FormData (R6)
├── modules/settings/routes/extensions/
│   ├── ExtensionsRoute.vue (+ .test.ts)                                # slot actions: BoButton Upload v-if available
│   ├── components/ExtensionUploadDialog.vue (+ .browser.test.ts, mới)  # BoDialog, input file + drop zone, BoNotice lỗi, gửi, refresh store
│   ├── components/ExtensionItem.vue (+ .test.ts)                       # chip Uploaded
│   └── components/ExtensionItemOptions.vue (+ .test.ts)                # uninstallLocked gồm upload
├── lang/overlay/en-US.ts, vi-VN.ts                                     # khối Spec 031 (contracts/web.md)
└── test-utils/fetch.ts                                                 # KNOWN_REQUESTS GET/POST /backoffice/extensions/upload
apps/web-e2e/src/
├── settings-extensions-upload.spec.ts (mới)                            # ba cấu hình (contracts/tests.md §4)
└── helpers/allowed-paths.ts                                            # 232, 233
tests/fixtures/extensions/parity-upload-endpoint/ (mới)                 # package.json (sandbox endpoint, name riêng), src/, dist/, parity-upload-endpoint-1.0.0.tgz (R7)
tests/parity/
├── accepted-differences.ts                                             # D-212 (doc), D-212.1 (doc), D-212.2 (http), D-212.3 (doc)
└── src/extensions/upload.test.ts (mới), src/deploy/extension-upload.test.ts (mới)   # R8
deploy/README.md                                                        # mục "Tải extension lên (spec 031)"
specs/020-extensions/spec.md                                            # "(031: ...)"
tests/parity/README.md, CLAUDE.md, SPECKIT-GUIDE.md                    # 031, D-212..D-212.3
```

**Structure Decision**: không project Nx mới, không lib mới; API ở lớp của bản port (controller mỏng + service + manager
có sẵn, như 020); web trong module settings/extensions có sẵn; fixture cạnh các fixture 020; parity ở `tests/`; E2E
trong `apps/web-e2e` như 014–030.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm. Một điểm chủ dự án cần gật cùng lượt duyệt D-212..D-212.3:

| Điểm | Lý do | Cách đơn giản hơn bị bác |
|------|-------|--------------------------|
| Kiểu `ExtensionSettings.source` của `libs/types` (port của `@directus/types`) thêm `'upload'`, và `generateExtensionsEntrypoint` của `libs/extensions` (port) nhận map thứ tư | Mọi chỗ dùng nguồn là union cứng ba giá trị; không mở thì phải ép kiểu ở 8 chỗ | Giữ `source: 'registry'` và thư mục `.registry/<uuid>`: Directus quét `.registry`, tự tạo dòng và chạy gói (research 2026-11-04, spec "Đánh giá hiện trạng" dòng 4) |

## Sửa câu chữ spec khi `/speckit.plan` (2026-11-04)

- FR-004, US2 kịch bản 3, Edge Cases ("409"), bảng câu hỏi guide: trùng `name` → 400 `INVALID_PAYLOAD` reason
  `An extension named "<name>" is already installed (<source>)` (R4: không mã 409, như 030).
- FR-022: fixture `.tgz` **đã commit** và được fake registry phục vụ (`fixtures:pack`), không phải "đóng khi build,
  không commit"; thêm fixture `parity-upload-endpoint` (name riêng, sandbox) vì các fixture hiện có đã nạp từ kho dưới
  nguồn local nên tải lên sẽ trùng tên (R7).
- FR-002/FR-004: `EXTENSIONS_LIMIT` áp cho tải lên như cài từ registry (`LimitExceededError`, R1); spec chưa nói.
- FR-010: response 200 `{ data: ApiOutput }` (dòng + schema), và thêm `GET /backoffice/extensions/upload` trả
  `max_upload_size` làm probe của FR-019 (R5).
- FR-013: khóa là `withSettingsLock` có sẵn (key `extensions-settings`), không key mới; kiểm trùng hai lần (sớm và
  trong khóa).
- FR-016: dòng Missing nguồn `upload` xóa bằng `DELETE /extensions/:pk` có sẵn (menu Remove), không qua uninstall.
- Edge case "tải lên trong lúc replica đang nạp lại": cùng khóa `extensions-settings` với `getExtensionsSettings` nên
  tuần tự; không cơ chế riêng.
