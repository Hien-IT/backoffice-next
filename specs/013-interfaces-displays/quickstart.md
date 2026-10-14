# Quickstart: Bộ interfaces và displays (013)

## Cài và chạy dev

```bash
pnpm install                                   # gói R1 trong catalog nhóm Web
PUBLIC_URL=http://127.0.0.1:8055 pnpm nx run web:serve   # như 012; chưa có màn item (014)
```

Ở 013 không có màn hình mới. Xem interface bằng test browser (mục dưới) hoặc Vitest UI:
`pnpm vitest --project browser --ui` trong `apps/web`.

## Bộ mẫu (FR-100)

```bash
# Directus thật của môi trường đối chiếu (profile app), token admin của env
cd tests/parity && pnpm env-up --profiles app && cd ../..
pnpm nx run web:fixtures -- --api http://127.0.0.1:<port Directus> --token <ADMIN_TOKEN>
# ghi apps/web/fixtures/interfaces/snapshot/*.json; commit kèm thay đổi seed
```

Sửa bộ mẫu: đổi `seed.mjs`, chạy lại lệnh trên, kiểm `pnpm nx run web:test:unit -- fixtures`.

## Test

```bash
pnpm nx run web:test:unit            # happy-dom, nhanh
pnpm nx run web:test                 # unit + browser (chromium), coverage ≥ 60%
pnpm exec playwright install chromium   # một lần, cho project browser
```

Chạy một interface: `pnpm vitest --project unit src/interfaces/select-dropdown` trong `apps/web`.

## Đối chiếu seed ở hai API

```bash
cd tests/parity && pnpm env-up --profiles web
pnpm vitest run src/web/fixtures-seed.test.ts
```

## Lint, build

```bash
pnpm nx run web:lint        # kể cả check-raw-colors (danh sách miễn Q-C)
pnpm nx run web:typecheck
pnpm nx run web:build       # xem kích thước chunk tinymce, editorjs, codemirror, maplibre
```

## Kiểm tra tay (khi 014 có màn item)

Mở item của `bo_std`, `bo_groups`, `bo_rel`, `bo_translations` ở app mới và Directus app cùng DB; so hình thức, menu
field, drawer, giá trị lưu.
