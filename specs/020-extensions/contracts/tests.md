# Contract: Kiểm thử

## 1. Unit (apps/api, Vitest)

| File | Nội dung |
|------|----------|
| `extensions/manager.test.ts` | load/unload/reload (queue, dedupe, added/removed), settings lookup theo `(source, folder)`, `registerHook` (5 register, `offInit(event)`), `registerEndpoint` (mount/gỡ layer), `registerOperation`, bundle entries enabled, `handleExtensionError` với `EXTENSIONS_MUST_LOAD` |
| `extensions/lib/get-extensions-settings.test.ts` | port test Directus + khóa `extensions-settings` |
| `extensions/lib/sync/*.test.ts` | port 4 test Directus + xóa khóa cũ lúc khởi động |
| `extensions/lib/installation/manager.test.ts` | port test Directus (download mock, tar, remote write) |
| `extensions/lib/sandbox/**.test.ts` | scope `log`/`sleep`/`request`, import khác `directus:api`, timeout, `RangeError` → abort (mock) |
| `services/extensions.service.test.ts` | `readAll` shape, `updateOne` bundle ↔ entry, 422, `preInstall` limit, `install` rows, `uninstall`/`reinstall` 400 |
| `controllers/extensions.controller.test.ts` | đổi các ca 503/403 của D-37 thành hành vi thật; `/sources` whitelist, header |
| `app-pipeline.test.ts` / `app.test.ts` | 8 event init đúng thứ tự, endpointRouter mount sau route hệ thống trước 404 |
| `config/supported-variables.test.ts` | 7 biến mới supported |
| `extensions/lib/installation/tarball-safety.test.ts` | tarball độc (đường dẫn tuyệt đối, `..`, symlink ra ngoài): không file nào ngoài thư mục tạm (R-68) |
| `extensions/manager.reload.test.ts` | reload ném → `isReloading()` reject (R-64); bundle lỗi lần đầu → `getAppExtensionChunk()` null (R-63); khóa `extensions-settings` quá hạn → xóa khóa, tạo dòng |
| `tools/extract-service-signatures.mjs` + test | export × constructor × method công khai của `directus/api/src/services/index.ts` và `apps/api/src/services/index.ts` bằng nhau (trừ D-141), chạy trong `quality` |
| `libs/extensions/**.test.ts`, `libs/utils` | `resolveFsExtensions`, `resolveModuleExtensions`, `generateExtensionsEntrypoint` (snapshot như Directus), `pluralize`, `numberGenerator`, `listFolders`, `resolvePackage`, `pathToRelativeUrl` |

## 2. Unit + browser (apps/web)

| File | Nội dung |
|------|----------|
| `extensions.test.ts` | `loadExtensions` (URL theo `apiUrl`, lỗi → warn), `registerExtensions` gộp nội bộ + extension, `useExtensions`, hydrate/dehydrate module |
| `*/index.ts` registry tests | `register*` thay danh sách, `get*(id)` thấy extension |
| `directus-shim/contract.test.ts` | 77 component + 3 view + 7 directive: tên đăng ký, props (tên/kiểu/mặc định), emits, slot so với `fixtures/directus-components.json` (sinh bởi `scripts/extract-directus-components.mjs`; `extract.test.ts` sinh lại và so byte) |
| `directus-shim/**/*.browser.test.ts` | từng shim: render, trạng thái, bàn phím, axe (FR-093) |
| `directus-shim/use-system.test.ts` | 4 inject, 14 store, axios interceptor (queue, `getToken`), `notificationsStore.add` → notice |
| `stores/extensions.test.ts` | refresh (so id → notice reload), toggle/install/uninstall/reinstall/remove gọi đúng API (mock allowlist #204–#212) |
| `modules/settings/routes/extensions/*.test.ts`, `marketplace/*.test.ts` | nhóm/missing/partial, menu theo nguồn, registry query ↔ URL, trang extension (limit, semver), account |
| `vite-plugin-extensions.test.ts` | build thật nhỏ: 5 entry `*.entry.js`, import map trước module script, `preserveEntrySignatures` |
| `lang/keys.test.ts`, `sync-translations.test.ts` | khóa mới |
| `check-bundle.mjs` | `BUDGET_020`, chunk shim lười (`directus-shim` ≤ 120 KB gzip ước lượng, chốt ở T116), chunk Settings extensions/marketplace ≤ 40 KB |

## 3. Parity (`tests/parity`)

| File | Cặp | Nội dung |
|------|-----|----------|
| `src/extensions/list.test.ts` | chính | `GET /extensions` (schema, entries, missing), `GET /sources/index.js` (status, header; body khác chấp nhận D-137 `location: body` + `kind: http`), chunk lạ 404 |
| `src/extensions/toggle.test.ts` | chính | `PATCH` bật tắt, bundle ↔ entry, 422, `DELETE /:pk`; db rows `directus_extensions` |
| `src/extensions/hooks.test.ts` | chính | `items.create` trên `bo_ext_items` (payload sửa, `bo_ext_log`), header `x-bo-ext` (init), embed không áp (D-138 doc) |
| `src/extensions/endpoints.test.ts` | chính | `/parity-endpoint-demo` GET/POST (auth, không auth), `/parity-endpoint-express4` một route mỗi mục D-139 với kết quả mong đợi của spec (404 do không nạp, 500, giá trị khác; ca async có timeout vì Directus treo) |
| `src/extensions/operations.test.ts` | chính | flow thủ công với `parity-operation-slack`, `$last`, revisions |
| `src/extensions/sandbox.test.ts` | chính | hook/endpoint/operation sandboxed, scope lỗi, timeout, URL trong scope nhưng IP bị `IMPORT_IP_DENY_LIST` chặn; tải nền autocannon 30 s, 10 kết nối, ≥ 1.000 request vào `/server/ping` và `/items/bo_ext_items`, 0 non-2xx (SC-004) |
| `src/extensions/graphql.test.ts` | chính | `extensions` (có và không có trường `name`), `update_extensions_item` |
| `src/extensions/install.test.ts` | `extensions` (10655/10656) | install/reinstall/uninstall qua fake registry, limit 403, rows, lỗi tải 503, `EXTENSIONS_MUST_LOAD` (container riêng khởi động với extension hỏng) |
| `src/extensions/multi.test.ts` | chính + `multi` | cài ở 8156 → 8157 và 8155 thấy trong 10 s; gỡ → 404 ba node; schedule 5 lượt 5 dòng |
| `src/web/fixtures-seed.test.ts` | | seed thêm `bo_ext_items`, `bo_ext_log` |
| `accepted-differences.ts` | | lượt 1: D-37 thu hẹp còn `install`, `reinstall`, `uninstall`; lượt 3: gỡ D-37; thêm D-137 (`GET /extensions/sources/*` body), D-139 (`* /parity-endpoint-express4/*` any), D-141 doc, D-138 doc |

Env: cặp chính + `multi` thêm `EXTENSIONS_LOCATION=s3`; `minio-init` chép `tests/fixtures/extensions/dist` lên
`s3://directus/extensions/`; profile `extensions` (`EXTENSIONS_PATH=./extensions-ext`, `EXTENSIONS_LIMIT=3`), registry
thêm `GET /download/:versionId`. `FULL_FILES` thêm `src/extensions/**`; `REDUCED_FILES` thêm `list`, `hooks`,
`endpoints`.

## 4. E2E (`apps/web-e2e`, ba cấu hình)

| Spec | Nội dung |
|------|----------|
| `settings-extensions.spec.ts` | danh sách nhóm, bundle lồng, toggle (+ notice reload), remove missing; so `directus_extensions` với Directus app (`payload/extensions.spec.ts`, `EXTENSIONS_TABLES`) |
| `settings-marketplace.spec.ts` | tìm/lọc/sắp/trang, trang extension (compat, install → Settings), account |
| `extensions-app-interface.spec.ts` | field dùng `parity-interface-color`: nhập, lưu, payload so Directus app |
| `extensions-app-display.spec.ts`, `-layout`, `-panel`, `-operation`, `-module` | như US3/US4 |
| `extensions-cross-use.spec.ts` | trên Directus app 8155 (DIRECTUS_APP_SPECS) cùng bộ extension; cài qua Directus app → app mới thấy và dùng; cài qua app mới → Directus app thấy (US2-7, US6-4) |
| `extensions-app-interface.spec.ts` (thêm) | user không phải admin dùng interface extension; không thấy Settings > Extensions (US3-7) |
| `requests.spec.ts` | bỏ dòng cấm `/extensions`, thêm `/extensions/sources/index.js` vào allowlist khởi động |
| `settings-parity-ui.spec.ts:77-78` | mục Extensions/Marketplace có |
| `a11y.spec.ts` | + 2 màn mới |

## 5. Acceptance nhiều instance (`tests/parity/src/deploy/extensions.test.ts`)

Compose 3 BE + 1 Directus (`EXTENSIONS_LOCATION=s3`, registry giả bật): ca US2 1–5 (SC-003: mốc là response của
request, mỗi 500 ms gọi từng node qua cổng riêng, đạt ≤ 10 s); thời gian từ container start tới `/server/health` ok với bộ
mẫu ≤ 60 s (FR-048); `index.js` từ replica 1 +
chunk từ replica 2; `compose up --scale backoffice-api=5` rồi gọi endpoint ngay khi healthy. Kind: `ci/kind-test.sh`
(contracts/deploy.md).

## 6. Benchmark

`tests/benchmark/src/web-extensions.ts`: lần mở app đầu (ba APPS) với bộ extension mẫu, `BENCH_RUNS`, `webSlower`
(SC-006); module chung `web-shared.ts` (`signIn`, `track`, `p95`, `usual`); bước mới trong `benchmark-web`.

## 7. Port manifest và guard

- `tools/port-manifest/020-T###.json` cho mọi file chép (api manager/lib, libs/extensions, web extensions.ts, shim nào
  chép logic, directives, store extensions, màn Settings, api.ts axios).
- `check-package-names`: cho phép `@directus/composables`, `@directus/extensions-sdk` (fixtures).
- `guard-differences`: entry mới có trong bảng spec.
