# Quickstart: Trình chỉnh sửa Flows (017)

Mọi lệnh chạy với Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` trên máy dev có Node khác). Làm
trên `main`, không branch; nhắn session dùng chung checkout (nếu có) trước và sau mỗi push.

## Cài và chạy dev

```bash
pnpm install                                   # không gói mới (research R1)
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app   # Directus 8155, API mới 8156, proxy 8160
set -a; . tests/parity/env/postgres.env; set +a
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"   # bo_* + bo_flows + 3 log
PUBLIC_URL=http://127.0.0.1:8155 pnpm nx run web:serve   # http://127.0.0.1:4200/admin/settings/flows
```

Đổi `PUBLIC_URL` sang `http://127.0.0.1:8156` cho API mới. Mở `/admin/settings/flows` (bảng 9 flow), `bo_all_ops`
(canvas 15 operation, Logs 3 dòng), "+" → drawer flow, pencil một operation → drawer operation.

## Registry operation trích từ Directus (R5)

```bash
node apps/web/scripts/extract-directus-registry.mjs   # fixtures/interfaces/directus-registry.json thêm `operations`
cd apps/web && pnpm exec vitest run src/operations/registry.test.ts
```

## Test

```bash
cd apps/web
pnpm run test:unit                             # gồm use-flow-editor (12 kịch bản), arrows (9 file port), triggers, registry
pnpm run test                                  # unit + browser, coverage >= 60%
pnpm exec vitest run --project browser src/modules/settings/routes/flows src/operations
PERF=1 pnpm exec vitest run --project browser --coverage.enabled=false src/modules/settings/routes/flows/perf.browser.test.ts
```

## E2E ba cấu hình (SC-001), payload (SC-005), bộ so DB và dùng chéo (SC-002, SC-003)

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,web   # 8161 proxy-directus, 8162 proxy-api, 8163/8181 cors
for cfg in proxy-directus proxy-api cors; do E2E_CONFIG=$cfg pnpm nx run web-e2e:e2e -- --grep settings-flows; done
E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- --project chromium-1280 payload/flows.spec.ts settings-flows-cross-use.spec.ts settings-parity-ui.spec.ts
```

Mốc body ghi của Directus app (T002): chạy tay bốn luồng trên `http://127.0.0.1:8155/admin/settings/flows` với
DevTools "Copy as fetch" hoặc `recordWrites` của Playwright, lưu `apps/web-e2e/src/payload/baselines/flows-*.json`.

## Lint, bundle, build

```bash
pnpm nx run-many -t lint typecheck -p web web-e2e
pnpm nx run web:build && node apps/web/scripts/check-bundle.mjs      # BUDGET_017, LAZY_BUDGETS_017
node tools/check-port-headers.mjs && node tools/check-brand.mjs
graphify update .
```

## Đóng feature

- Recipe Q-29..Q-33 trong `design-system/docs/` được design owner duyệt; ngoại lệ a11y canvas trong
  `design-system/qa/handoff-checklist.md` được tech lead duyệt; D-106, R-43..R-48 duyệt và ghi vào bảng trạng
  thái khác biệt của spec. R-47 và "Cần xác nhận" cũng duyệt ở đó.
- Spec 016 (D-92) và 014 (D-72 phần `directus_flows`) ghi "đã gỡ ở 017"; `SPECKIT-GUIDE.md` ghi chú cho 018
  (`BoWorkspace*` dùng lại cho Insights; `/content/directus_operations` không chuyển hướng như Directus).
- `CLAUDE.md` Active Technologies: dòng 017 đã thêm ở bước plan (2026-10-17); sửa lại khi đóng nếu phạm vi đổi.
