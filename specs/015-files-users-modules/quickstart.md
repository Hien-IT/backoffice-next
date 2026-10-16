# Quickstart: Module Files và Users (015)

Mọi lệnh chạy với Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` trên máy dev có Node khác). Chỉ bắt
đầu sửa `apps/web` khi phiên 014 báo đóng (R12).

## Cài và chạy dev

```bash
pnpm install                                   # cropperjs 1.6.2, tus-js-client 4.3.1 (research R1)
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app   # Directus 8155, API mới 8156, proxy 8160
set -a; . tests/parity/env/postgres.env; set +a
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"   # bo_* + bo_files + bo_users
PUBLIC_URL=http://127.0.0.1:8155 pnpm nx run web:serve   # http://127.0.0.1:4200/admin/files, /admin/users
```

Đổi `PUBLIC_URL` sang `http://127.0.0.1:8156` cho API mới (sau seed xóa cache `?system` ở 8156 và 8163). Mở
`/admin/files` (thư mục `bo-fixtures` > `sub` > `deep`, 30 file), `/admin/files/mine`, một ảnh → nút chỉnh ảnh;
`/admin/users` (role `bo-editor` > `bo-sub`, user mỗi trạng thái), trang của chính mình (menu avatar).

## Dữ liệu theme Directus (R6)

```bash
node apps/web/scripts/sync-theme-presets.mjs      # ghi src/theme/theme-presets.json từ directus/packages/themes
cd apps/web && pnpm exec vitest run src/theme/theme-presets.test.ts   # file sinh khớp nguồn
```

## Test

```bash
cd apps/web
pnpm run test:unit
pnpm run test                                  # unit + browser, coverage >= 60%
pnpm exec vitest run --project browser src/modules/files src/modules/users src/components/files src/interfaces/_system
PERF=1 pnpm exec vitest run --project browser --coverage.enabled=false src/modules/files/perf.browser.test.ts src/modules/users/perf.browser.test.ts
```

## E2E ba cấu hình (SC-001) và bộ so payload (SC-004)

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,setup,sso,web
set -a; . tests/parity/env/postgres.env; set +a
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"
# POST /utils/cache/clear?system bằng admin trên 8156 và 8163 (như job e2e-web)
cd apps/web-e2e
E2E_CONFIG=proxy-directus pnpm exec playwright test src/files-*.spec.ts src/users-*.spec.ts
E2E_CONFIG=proxy-api      pnpm exec playwright test src/files-*.spec.ts src/users-*.spec.ts src/payload/files.spec.ts src/payload/users.spec.ts
E2E_CONFIG=cors           pnpm exec playwright test src/files-*.spec.ts src/users-*.spec.ts
```

Chạy tuần tự, không song song với E2E khác trên cùng DB (bài học 014). Dọn: `pnpm nx run parity-tests:env-down
--vendor=postgres`.

## Đối chiếu seed ở hai API (giữ của 013)

```bash
cd tests/parity && TEST_DB=postgres pnpm exec vitest run -c vitest.parity.config.ts src/web/fixtures-seed.test.ts
```

## Benchmark màn (FR-118, hằng tuần)

```bash
pnpm nx run benchmark:env-up-web
pnpm nx run benchmark:web                      # thêm kịch bản files, users (web-files-users.ts)
pnpm nx run benchmark:env-down
```

## Lint, build

```bash
cd apps/web
pnpm run lint && pnpm run typecheck
pnpm run build && node scripts/check-bundle.mjs   # BUDGET_015; cropperjs, tus, theme data là chunk lười
cd ../.. && pnpm run check-port-headers && pnpm run guard-directus && graphify update .
```

## Kiểm tra tay

Cùng DB, mở Directus app (`http://127.0.0.1:8155/admin/files`, `/admin/users`) và app mới: so cây thư mục, thẻ thư mục,
chi tiết file, cây role, form user (theme preview, token, TFA). Là việc của E2E và bộ so payload; kiểm tay chỉ khi điều
tra khác biệt.
