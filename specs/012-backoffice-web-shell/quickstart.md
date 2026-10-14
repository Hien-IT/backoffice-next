# Quickstart: App web Backoffice (khung ứng dụng)

## Chạy dev

```bash
# API: Directus tham chiếu (dev/directus-reference) hoặc API mới
cd dev/directus-reference && docker compose up -d --wait && cd ../..
# app web, proxy mọi path API sang PUBLIC_URL (mặc định http://127.0.0.1:8055)
PUBLIC_URL=http://127.0.0.1:8055 pnpm nx run web:serve
# mở http://127.0.0.1:4200/admin/
```

Đổi sang API mới: chạy `pnpm nx run api:serve` rồi `PUBLIC_URL=http://127.0.0.1:8056 pnpm nx run web:serve`
(cổng theo `.env` của API). Không đổi code.

## Chuỗi dịch

```bash
pnpm nx run web:sync-translations   # đọc directus/app/src/lang, ghi src/lang/translations/*.json, in chuỗi giữ nguyên
pnpm nx run web:test                # sync-translations.test.ts thất bại nếu file commit lệch nguồn
```

## Kiểm tra nhanh (unit, lint)

```bash
pnpm nx run web:lint        # ESLint + rule no-raw-color
pnpm nx run web:typecheck
pnpm nx run web:test        # Vitest, coverage ≥ 60%
pnpm nx run web:build
```

## E2E ba cấu hình

```bash
pnpm nx run api:build
docker build -f apps/web/Dockerfile -t hiennd23/backoffice-web:local .
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,setup,sso,web
cd apps/web-e2e && pnpm exec playwright install --with-deps chromium firefox webkit && cd ../..

E2E_CONFIG=proxy-directus BASE_URL=http://127.0.0.1:8161 pnpm nx run web-e2e:e2e
E2E_CONFIG=proxy-api      BASE_URL=http://127.0.0.1:8162 pnpm nx run web-e2e:e2e
E2E_CONFIG=cors           BASE_URL=http://localhost:8181 pnpm nx run web-e2e:e2e

pnpm nx run parity-tests:env-down --vendor=postgres
```

Một spec: `pnpm nx run web-e2e:e2e -- --grep "sign in"`; xem trace: `pnpm exec playwright show-trace
apps/web-e2e/test-results/<...>/trace.zip`.

## Kiểm tra tay

1. Mở `/admin/` với DB mới (profile `setup`, `apiUrl` cặp setup): tới `/admin/setup`, tạo admin, vào app.
2. Đăng nhập local; bật TFA ở hồ sơ? (không có ở 012: dùng `enforce_tfa` của role qua API để thấy `/tfa-setup`).
3. Bấm sáu module; so URL và thanh module với Directus app tại `http://127.0.0.1:8160/admin` (proxy profile `app`)
   cùng tài khoản.
4. `PATCH /settings` với `project_name`, `project_color`, `project_logo`: tải lại trang đăng nhập và app, thấy branding.
5. Hồ sơ: đổi `language` sang `vi-VN`, `appearance` sang `dark`.
6. Tìm "Directus" trong DOM: `document.body.innerText.includes('Directus')` phải `false` với settings mặc định.

## Khi Reka UI export khác tài liệu

Kiểm `node_modules/reka-ui/dist/index.d.ts`; sửa import ở `src/components/Bo*.vue`; ghi vào `research.md` R7.
