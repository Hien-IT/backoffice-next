# Quickstart: Module Settings (016)

Mọi lệnh chạy với Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` trên máy dev có Node khác). Chỉ bắt
đầu sửa `apps/web` khi phiên 015 báo đóng (FR-111, R11); nhắn session dùng chung checkout trước và sau mỗi push.

## Cài và chạy dev

```bash
pnpm install                                   # không gói mới (research R1)
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app   # Directus 8155, API mới 8156, proxy 8160
set -a; . tests/parity/env/postgres.env; set +a
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"   # bo_* + bo_settings
PUBLIC_URL=http://127.0.0.1:8155 pnpm nx run web:serve   # http://127.0.0.1:4200/admin/settings
```

Đổi `PUBLIC_URL` sang `http://127.0.0.1:8156` cho API mới (sau seed xóa cache `?system` ở 8156 và 8163). Mở
`/admin/settings/data-model` (folder `bo_settings_group` > `bo_settings_sub`, bảng `bo_raw` chưa quản lý), một
collection → lưới field → một field (drawer), `/admin/settings/policies/<bo_s_policy>` (ma trận), `/admin/settings/
project`, `/admin/settings/presets/<id>`.

## Dữ liệu quyền chép từ Directus (R5)

```bash
pnpm nx run web:sync-permissions-data        # ghi apps/web/src/permissions/app-permissions-data.json
cd apps/web && pnpm exec vitest run src/permissions/app-permissions-data.test.ts   # file sinh khớp nguồn
node scripts/extract-directus-registry.mjs   # fixtures/interfaces/directus-registry.json thêm 18 _system và preview
```

## Test

```bash
cd apps/web
pnpm run test:unit                             # gồm store fieldDetail (port index.test.ts) và alteration
pnpm run test                                  # unit + browser, coverage >= 60%
pnpm exec vitest run --project browser src/modules/settings src/interfaces/_system
PERF=1 pnpm exec vitest run --project browser --coverage.enabled=false src/modules/settings/perf.browser.test.ts
```

## E2E ba cấu hình (SC-001), payload (SC-005), bộ so DB và dùng chéo (SC-002, SC-003)

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,web
cd apps/web-e2e
E2E_CONFIG=proxy-directus pnpm exec playwright test settings-
E2E_CONFIG=proxy-api pnpm exec playwright test settings-                 # gồm settings-parity-ui, settings-cross-use, payload/settings
E2E_CONFIG=cors pnpm exec playwright test settings-
```

Kịch bản dùng chéo cần Directus app ở 8155 và API mới ở 8156 trên cùng Postgres; `bo_raw` tạo bằng SQL qua
`hostDb()` chỉ ở `proxy-api`.

## Lint, bundle, build

```bash
cd apps/web && pnpm run lint                   # eslint, check-raw-colors, check-brand, check-port-headers
pnpm nx run web:build && node apps/web/scripts/check-bundle.mjs   # BUDGET_016, LAZY_BUDGETS_016
pnpm nx run web:docker-build
```

## Đóng feature

- Recipe Q-20 đến Q-27 trong `design-system/docs/` được design owner duyệt; `qa/handoff-checklist.md` đạt.
- D-92 đến D-103, R-40 đến R-42 tech lead duyệt; spec 012 (D-40 Settings), 013 (D-56, D-57), 014 (D-71, D-72 phần 016),
  015 (D-85) ghi "đã gỡ ở 016"; `SPECKIT-GUIDE.md` ghi chú cho 017 (Flows: mục sub-menu và khung của 016, D-92;
  `system-manual-flow-select`, `system-collections`, `system-inline-fields` đã có) và 018 (snackbar D-66).
- `CLAUDE.md` Active Technologies (chạy `.specify/scripts/bash/update-agent-context.sh claude` ở task đầu lượt 1; dòng
  soạn sẵn): "Settings module: /settings/{data-model,roles,policies,project,appearance,presets,translations} as ports
  of directus/app/src/modules/settings (field-detail store + 10 alterations, system-permissions matrix, ExtensionOptions
  for interface/display options incl. the list/map option components), 18 remaining `_system`
  interfaces, write helpers on collections/fields/relations stores, static app permissions data synced from Directus
  (web:sync-permissions-data); E2E settings-* in three configurations, cross-use suite on the Directus app at proxy-api;
  D-92..D-96 (016-settings-module)".
- `graphify update .` sau mỗi lượt.
