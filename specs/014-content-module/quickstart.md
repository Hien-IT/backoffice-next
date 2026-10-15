# Quickstart: Module Content (014)

Mọi lệnh chạy với Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` trên máy dev có Node khác).

## Cài và chạy dev

```bash
pnpm install                                   # gói của research R1 (catalog nhóm Web)
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app   # Directus 8155, API mới 8156, proxy 8160
set -a; . tests/parity/env/postgres.env; set +a   # admin của env parity (giá trị test)
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"   # bộ mẫu bo_* (mở rộng 014)
PUBLIC_URL=http://127.0.0.1:8155 pnpm nx run web:serve   # app ở http://127.0.0.1:4200/admin/, module Content thật
```

`pnpm nx run web:fixtures -- ...` cũng seed nhưng chạy thêm `export.mjs`, ghi lại snapshot đã commit
(`fixtures/interfaces/snapshot`): chỉ dùng khi cố ý cập nhật snapshot. Đổi `PUBLIC_URL` sang `http://127.0.0.1:8156`
để chạy với API mới (seed xong thì xóa cache schema của API đó, xem mục E2E). Mở `/admin/content/bo_content` (trong
folder `bo_folder`, 30 item, bookmark `bo-bookmark`, `bo-global-bookmark`), `bo_singleton`, `bo_std` (bộ 013, có
field geometry khi Postgres có PostGIS); item `bo_content/1` có version `draft` và `local-1`, share `bo-share`, hai
comment, `preview_url`, flow thủ công `bo-flow-item`.

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
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,setup,sso,web   # `up --build`: tự build image API và web
set -a; . tests/parity/env/postgres.env; set +a
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"
# API mới 8156 và 8163 (cấu hình cors) đã dựng cache schema trước khi seed: gọi POST /utils/cache/clear?system bằng
# admin trên hai API đó (như bước "seed the fixture set bo_*" của job e2e-web trong .github/workflows/ci.yml)
cd apps/web-e2e
E2E_CONFIG=proxy-directus pnpm exec playwright test src/content-*.spec.ts
E2E_CONFIG=proxy-api      pnpm exec playwright test src/content-*.spec.ts src/payload   # payload chỉ ở proxy-api
E2E_CONFIG=cors           pnpm exec playwright test src/content-*.spec.ts
```

Image dựng sẵn: `docker build -f apps/web/Dockerfile -t hiennd23/backoffice-web:local .`; CI nạp image của job
`docker` rồi chạy env-up với `PARITY_NO_BUILD=1`. Không đặt `E2E_CONFIG` = cấu hình dev: Playwright tự chạy Vite
(4200, chỉ chromium), proxy theo `PUBLIC_URL` (đặt `PUBLIC_URL=http://127.0.0.1:8155`). firefox và webkit chỉ chạy test
gắn `@core`. Local không tải trình duyệt: config tạm `channel: 'chrome'` (bài học 007). Dọn: `pnpm nx run
parity-tests:env-down --vendor=postgres`.

## Đối chiếu seed ở hai API (SC-009 của 013, giữ)

```bash
cd tests/parity
TEST_DB=postgres pnpm exec vitest run -c vitest.parity.config.ts src/web/fixtures-seed.test.ts
```

## Benchmark màn (SC-003, hằng tuần)

```bash
pnpm nx run benchmark:env-up-web               # Directus + API + web sau hai proxy (8171 → Directus, 8172 → API, R14)
pnpm nx run benchmark:web                      # tự seed 10 triệu dòng (seed-items.ts) rồi dọn; Playwright: trang đầu,
                                               # đổi trang, hai sắp xếp, lọc preset; BENCH_RUNS (mặc định 11), p95
pnpm nx run benchmark:env-down
```

Fail khi p95 của app web vượt Directus app quá 10 % (SC-003 tương đối); mục tiêu tuyệt đối chỉ báo cáo.

Baseline chính thức lấy từ CI (`benchmark.yml`); máy Apple Silicon chạy Directus giả lập amd64, số đo chỉ tham khảo.

## Lint, build

```bash
cd apps/web
pnpm run lint            # ESLint, check-raw-colors, check-brand
pnpm run typecheck
pnpm run build && node scripts/check-bundle.mjs   # chunk chính trong ngân sách; calendar, map, kanban, split panel là chunk lười
cd ../..
pnpm run check-port-headers                        # script ở gốc repo: header nguồn của file chép, manifest 014-T*.json
pnpm run guard-directus                            # 0 file trong directus/ bị sửa (SC-008)
```

## Kiểm tra tay

Cùng DB, mở Directus app (`http://127.0.0.1:8155/admin`) và app mới: so cây collection, bảng `bo_std` (cột, số đếm),
bộ lọc, bookmark, item `bo_std/1` (sidebar, version, live preview), xuất CSV. Đây là việc của E2E và bộ so payload;
kiểm tay chỉ khi điều tra khác biệt.
