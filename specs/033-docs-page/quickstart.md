# Quickstart: Trang tài liệu (docs) trong app Backoffice

**Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Viết trước khi có code: tên lệnh và đường dẫn là của plan, lượt implement xác nhận hoặc sửa file này.

## Xem khu tài liệu

1. Chạy app web (`pnpm --filter @backoffice/web exec vite`) với một API bất kỳ, đăng nhập.
2. Mở menu người dùng ở cuối sidebar, chọn "Tài liệu". URL là `/admin/docs`.

## Thêm một trang hướng dẫn

1. Tạo `apps/web/src/docs/content/guides/<slug>.md`. Bắt đầu từ `##`; tiêu đề trang không viết trong file.
2. Thêm trang vào `apps/web/src/docs/nav.ts` (`path`, `title`, `lead`, `kind: 'markdown'`, `source`); trang của tính
   năng chỉ có ở Backoffice đặt `backofficeOnly: true`.
3. Viết theo bước đánh số. Link nội bộ dạng `/docs/<path>#<anchor>`. Ô ghi chú: `> [!NOTE]` hoặc `> [!WARNING]`.
4. Thêm ảnh (mục "Chụp lại ảnh") và nhắc tới bằng `![mô tả ảnh cho thấy gì](./images/<slug>-1.png)`.
5. `nx run web:test` và `nx run web:lint`: báo link gãy, anchor gãy, ảnh thiếu, thiếu alt, từ thương hiệu bị cấm.

Quy tắc chữ:

- Không viết từ "Directus" đứng riêng ở bất kỳ trang nào. Định danh viết thường giữ nguyên: `directus_files`,
  `@directus/extensions-sdk`, cookie `directus_session_token`.
- Cần nói tới hệ thống chạy cùng DB thì viết "hệ thống dùng chung cơ sở dữ liệu".
- Không token, mật khẩu, khóa, URL nội bộ thật. Ví dụ dùng `https://backoffice.example.com` và `<token>`.

## Thêm hoặc sửa một endpoint trong phần API

- Endpoint có trong `libs/specs`: không sửa gì ở tài liệu ngoài chạy lại script.
- Endpoint chỉ của Backoffice hoặc resource chưa có trong `libs/specs`: sửa file trong
  `apps/web/src/docs/api/supplement/` (dạng OpenAPI). Không sửa `libs/specs` cho mục đích tài liệu.
- Chạy `pnpm --filter @backoffice/web sync-docs-api` rồi commit `apps/web/src/docs/api/generated/`.
- Operation không theo quy tắc CRUD cần ví dụ GraphQL viết tay trong bảng của script, hoặc `false` khi không có tương
  đương. Test parity `docs/graphql-examples.test.ts` kiểm ví dụ với schema của API.

## Thêm một biến môi trường

1. Thêm biến vào `SUPPORTED_VARIABLES` (`apps/api/src/config/supported-variables.ts`) và mặc định vào `libs/env` như
   mọi feature.
2. Chạy `pnpm --filter @backoffice/web sync-docs-config`; commit `supported.generated.json`.
3. Thêm một dòng (nhóm, mô tả, ghi chú) vào `apps/web/src/docs/configuration/variables.ts`. Thiếu dòng thì
   `variables.test.ts` đỏ và nêu tên biến.

## Chụp lại ảnh

Chạy bằng tay trên máy có trình duyệt Playwright; CI không chụp.

1. Cài trình duyệt một lần: `pnpm --filter @backoffice/web-e2e exec playwright install chromium`.
2. Dựng môi trường `web` của parity như khi chạy E2E (xem `tests/parity/README.md`).
3. `DOCS_SHOTS=1 E2E_CONFIG=proxy-api pnpm --filter @backoffice/web-e2e docs:shots`.
4. Xem `git status`: chỉ ảnh của màn hình đã đổi mới khác. Rà từng ảnh mới: không dữ liệu thật, không từ thương hiệu
   bị cấm.
5. Commit ảnh cùng thay đổi giao diện.

Thêm một ảnh mới: thêm một bước `shot('<slug>-<n>')` vào `apps/web-e2e/src/docs-shots/<slug>.shots.ts`, che vùng có
ngày giờ hoặc id bằng `mask`.

## Kiểm tra trước khi commit

- `nx run web:lint`, `nx run web:test`, `nx run web:build` rồi `node apps/web/scripts/check-bundle.mjs`.
- Không stage `apps/api/project.json`, `apps/web/project.json` (thay đổi của session khác).
