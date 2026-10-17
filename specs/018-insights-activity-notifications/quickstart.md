# Quickstart: Insights, Activity, Notifications (018)

Mọi lệnh chạy với Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` trên máy dev có Node khác). Làm
trên `main`, không branch; checkout dùng chung với phiên 017 (và 016): nhắn trước và sau mỗi push, chỉ stage đường dẫn
của 018, không `stash`/`reset`/`add -A`.

## Cài và chạy dev

```bash
pnpm install                                   # + apexcharts 4.7.0 (catalog, research R1)
pnpm audit --prod                              # 0 advisory cho apexcharts
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app   # Directus 8155, API mới 8156, proxy 8160
set -a; . tests/parity/env/postgres.env; set +a
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"   # bo_* + bo_flows + bo_insights + 3 thông báo
PUBLIC_URL=http://127.0.0.1:8155 pnpm nx run web:serve   # http://127.0.0.1:4200/admin/insights
```

Đổi `PUBLIC_URL` sang `http://127.0.0.1:8156` cho API mới. Mở `/admin/insights` (bảng 5 dashboard), `bo_dash_all`
(11 panel), nút sửa → kéo/đổi cỡ, "+" → drawer panel; chuông ở header (badge 3) → drawer thông báo → link Activity.

## Registry panel trích từ Directus (R5)

```bash
node apps/web/scripts/extract-directus-registry.mjs   # fixtures/interfaces/directus-registry.json thêm `panels`
cd apps/web && pnpm exec vitest run src/panels/registry.test.ts
```

## Test

```bash
cd apps/web
pnpm run test:unit                             # gồm stores/insights, registry 11 panel, utils port
pnpm run test                                  # unit + browser, coverage >= 60%
pnpm exec vitest run --project browser src/modules/insights src/modules/activity src/panels src/components/workspace src/components/NotificationsDrawer.vue src/modules/settings/routes/flows
PERF=1 pnpm exec vitest run --project browser --coverage.enabled=false src/modules/insights/perf.browser.test.ts
```

## E2E ba cấu hình (SC-001), payload (SC-005), bộ so DB và dùng chéo (SC-002, SC-003)

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,web   # 8161 proxy-directus, 8162 proxy-api, 8163/8181 cors
for cfg in proxy-directus proxy-api cors; do E2E_CONFIG=$cfg pnpm nx run web-e2e:e2e -- --grep "insights|activity|notifications"; done
E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- --project chromium-1280 payload/insights.spec.ts payload/activity.spec.ts payload/notifications.spec.ts insights-cross-use.spec.ts insights-parity-ui.spec.ts
```

Mốc body ghi và tài liệu GraphQL của Directus app (T002): `RECORD_BASELINES=1 E2E_CONFIG=proxy-api pnpm nx run
web-e2e:e2e -- payload/insights-baselines.spec.ts` (như 016/017) ghi `apps/web-e2e/src/payload/baselines/insights-*.json`
và `insights-graphql.json` (response của `bo_dash_all`, `bo_dash_vars`); mock GraphQL của web dùng lại file này
(`fixtures/interfaces/snapshot/graphql.bo_dash_all.json`).

## Lint, bundle, build

```bash
pnpm nx run-many -t lint typecheck -p web web-e2e
pnpm nx run web:build && node apps/web/scripts/check-bundle.mjs      # BUDGET_018, LAZY_BUDGETS_018 (apexcharts chunk)
node tools/check-port-headers.mjs && node tools/check-brand.mjs
graphify update .
```

## Đóng feature

- Recipe Q-34..Q-39 trong `design-system/docs/` được design owner duyệt; ngoại lệ a11y lưới dashboard trong
  `design-system/qa/handoff-checklist.md` được tech lead duyệt; D-107..D-110, R-49..R-57 và "Cần xác nhận" duyệt và
  ghi vào bảng trạng thái khác biệt của spec.
- Spec 012 (D-40 Insights/Activity, D-45 insights/drawer) và 014 (D-72 phần còn lại) ghi "đã gỡ ở 018"; 015 (D-90)
  ghi "đã gỡ ở 018: Directus không có danh sách"; 013 (D-66) ghi "xét lại ở 018: giữ"; `SPECKIT-GUIDE.md` ghi chú cho
  019 nếu có.
- `CLAUDE.md` Active Technologies thêm dòng 018 ở bước plan (`update-agent-context.sh claude`); sửa lại khi đóng nếu
  phạm vi đổi.
