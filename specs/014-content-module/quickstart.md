# Quickstart: Module Content (014)

Mọi lệnh chạy với Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` trên máy dev có Node khác).

## Cài và chạy dev

```bash
pnpm install                                   # gói của research R1 (catalog nhóm Web)
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app   # Directus 8155, API mới 8156, proxy 8160
pnpm nx run web:fixtures -- --api http://127.0.0.1:8155 --email admin@example.com --password password   # bộ mẫu bo_* (mở rộng 014)
PUBLIC_URL=http://127.0.0.1:8155 pnpm nx run web:serve   # app ở http://127.0.0.1:4200/admin/, module Content thật
```

Đổi `PUBLIC_URL` sang `http://127.0.0.1:8156` để chạy với API mới. Mở `/admin/content/bo_std`, `bo_groups`
(nhóm lồng), `bo_rel`, `bo_translations`; item `bo_std/1` có version, share, comment, `preview_url`.

## Test

```bash
cd apps/web
pnpm run test:unit                             # project unit, nhanh
pnpm run test                                  # unit + browser (chromium), coverage >= 60%
pnpm exec vitest run --project browser src/layouts            # năm layout
PERF=1 pnpm exec vitest run --project browser --coverage.enabled=false src/layouts/tabular/perf.browser.test.ts   # SC-011
```

## E2E ba cấu hình (SC-001) và bộ so payload (SC-004)

```bash
pnpm nx run api:build && pnpm nx run web:build        # hoặc tải image CI
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,setup,sso,web
pnpm nx run web:fixtures -- --api http://127.0.0.1:8155 --email admin@example.com --password password
cd apps/web-e2e
E2E_CONFIG=proxy-directus pnpm exec playwright test src/content-*.spec.ts
E2E_CONFIG=proxy-api      pnpm exec playwright test src/content-*.spec.ts src/payload   # payload chỉ ở proxy-api
E2E_CONFIG=cors           pnpm exec playwright test src/content-*.spec.ts
```

Local không tải trình duyệt: config tạm `channel: 'chrome'` (bài học 007). Dọn: `pnpm nx run parity-tests:env-down
--vendor=postgres`.

## Đối chiếu seed ở hai API (SC-009 của 013, giữ)

```bash
cd tests/parity
TEST_DB=postgres pnpm exec vitest run -c vitest.parity.config.ts src/web/fixtures-seed.test.ts
```

## Benchmark màn (SC-003, hằng tuần)

```bash
pnpm nx run benchmark:env-up                   # Directus + API + web ×2 (R14), 10 triệu dòng seed bởi benchmark:items
pnpm nx run benchmark:items                    # seed (nếu chưa) + benchmark API
pnpm nx run benchmark:web                      # Playwright: trang đầu, đổi trang, sắp xếp, lọc; p95 vào báo cáo
```

Baseline chính thức lấy từ CI (`benchmark.yml`); máy Apple Silicon chạy Directus giả lập amd64, số đo chỉ tham khảo.

## Lint, build

```bash
cd apps/web
pnpm run lint            # ESLint, check-raw-colors, check-brand
pnpm run typecheck
pnpm run build && node scripts/check-bundle.mjs   # chunk chính trong ngân sách; calendar, map, kanban, split panel là chunk lười
pnpm run check-port-headers                        # từ gốc repo: header nguồn của file chép, manifest 014-T*.json
```

## Kiểm tra tay

Cùng DB, mở Directus app (`http://127.0.0.1:8155/admin`) và app mới: so cây collection, bảng `bo_std` (cột, số đếm),
bộ lọc, bookmark, item `bo_std/1` (sidebar, version, live preview), xuất CSV. Đây là việc của E2E và bộ so payload;
kiểm tay chỉ khi điều tra khác biệt.
