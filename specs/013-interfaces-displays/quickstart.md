# Quickstart: Bộ interfaces và displays (013)

Mọi lệnh chạy với Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` trên máy dev có Node khác).

## Cài và chạy dev

```bash
pnpm install                                   # gói của research R1 (catalog nhóm Web)
PUBLIC_URL=http://127.0.0.1:8055 pnpm nx run web:serve   # như 012; chưa có màn item (014)
```

Ở 013 không có màn hình mới: interface và display được kiểm bằng test component (Clarifications Q-A).

## Test

```bash
cd apps/web
pnpm exec playwright install chromium          # một lần, cho project `browser`
pnpm run test:unit                             # project `unit` (happy-dom), nhanh, không coverage
pnpm run test                                  # `unit` + `browser` (chromium), coverage >= 60%
pnpm exec vitest run --project browser src/interfaces/map   # một thư mục, một project
```

Test bản đồ trong project `browser` tự bỏ qua khi chromium không có WebGL.

## Bộ mẫu (FR-100)

```bash
# Directus thật của môi trường đối chiếu (profile app, cổng 8155), tài khoản admin trong tests/parity/env/postgres.env
pnpm nx run web:fixtures -- --api http://127.0.0.1:8155 --email admin@example.com --password password
# chỉ dọn bộ mẫu khỏi DB dùng chung
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email admin@example.com --password password --clean
```

`snapshot/*.json` được commit; `snapshot/expected.<id>.json` viết tay, mỗi giá trị ghi nguồn Directus. Chi tiết:
`apps/web/fixtures/interfaces/README.md`. Trích lại registry của Directus (chạy một lần khi nâng Directus):
`node apps/web/scripts/extract-directus-registry.mjs` rồi `prettier --write` file JSON.

## Đối chiếu seed ở hai API (SC-009)

```bash
cd tests/parity
TEST_DB=postgres pnpm exec vitest run -c vitest.parity.config.ts src/web/fixtures-seed.test.ts
```

Cần môi trường đối chiếu đang chạy (cặp chính 8155/8156). Test tự dọn bộ mẫu sau khi chạy.

## Lint, build

```bash
cd apps/web
pnpm run lint            # ESLint, check-raw-colors (`raw-color-allowed:` cho hằng màu dữ liệu, Q-C), check-brand
pnpm run typecheck
pnpm run build && node scripts/check-bundle.mjs   # chunk chính trong ngân sách 013, editor và bản đồ chỉ ở chunk lười
```

## Kiểm tra tay (khi 014 có màn item)

Mở item của `bo_std`, `bo_groups`, `bo_rel`, `bo_translations` ở app mới và Directus app cùng DB; so hình thức, menu
field, drawer, giá trị lưu. Đây là việc của E2E 014 (FR-121).
