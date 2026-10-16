# Contract: kiểm thử (R9, R12)

## 1. Vitest trong `apps/web` (như 013–015)

- `unit` (happy-dom): store `fieldDetail` (port `store/index.test.ts` Directus + 20 kịch bản alteration so JSON, SC-006),
  `use-expand-collapse`, `get-junction-collection-name`, `use-duplicate`, `use-save`, hàm ghi store (mock sdk),
  `app-permissions-data.test.ts` (chạy lại script ra file tạm và so), `ExtensionOptions` (số field theo `optionsKind`
  của mọi interface/display, test registry), `SettingsNavigation` (D-94, D-95), `modules/settings.ts` (route, guard).
- `browser` (chromium): `CollectionsRoute` (cây, kéo thả = `PATCH /collections` body, menu bàn phím D-96, hộp xóa với
  phụ thuộc), `NewCollection` (hai bước, body `POST /collections` và `/relations`), `FieldsRoute` + `FieldsManagement`
  (lưới, thả vào group, menu field, nhân bản, xóa), `FieldDetail` (simple: lưới thẻ, khung cấu hình; advanced: 7 tab,
  relationship 5 loại, `save()` thứ tự request), 18 interface `_system` (giá trị phát ra, request allowlist),
  `SystemPermissions` (mức chip, set all/none, reset, thêm collection, drawer chi tiết 4 tab, emit alterations), trang
  role/policy (`PATCH` lồng), `ProjectRoute`/`AppearanceRoute` (`PATCH /settings` chỉ khóa đổi, `system-owner`,
  `system-modules`), `PresetItemRoute` (scope, body, xem trước layout), `TranslationItemRoute` (`refreshCurrentLanguage`),
  axe cho 12 màn + 4 drawer/hộp (sáng, tối), perf `modules/settings/perf.browser.test.ts` (`PERF=1`, `machineFactor()`).
- Coverage gộp ≥ 60 %.

## 2. API giả lập (`test-utils/fetch.ts`, `mockFixtureApi`)

- Thêm #137–#177; dữ liệu từ `fixtures/interfaces/snapshot/settings.*.json`.
- `PATCH /roles/<id>`, `PATCH /policies/<id>`: mock nhận body lồng `{create, update, delete}` và trả item; test khẳng
  định body (không mô phỏng ghi lồng).
- `POST /collections`, `POST /fields/<c>`, `POST /relations`: mock ghi vào snapshot trong bộ nhớ để `GET /fields` sau
  `save()` trả field mới (drawer đóng → lưới cập nhật).
- `GET /schema/snapshot`: trả JSON cố định; test kiểm tên file tải.
- Request ngoài danh sách → test thất bại (`KNOWN_REQUESTS`).

## 3. E2E `apps/web-e2e` (ba cấu hình, SC-001)

| Spec | Nội dung | Cấu hình |
|------|----------|----------|
| `settings-data-model.spec.ts` | US1, US2: cây, kéo thả (chuột và menu), folder, drawer tạo collection, lưới field, menu field, nhân bản, xóa, form collection, snapshot | ba cấu hình; chromium 768/1280; firefox/webkit 1280 ở cùng origin |
| `settings-field-detail.spec.ts` | US3: 10 field của Independent Test qua hai chế độ, tab, relationship, options component | như trên |
| `settings-roles-policies.spec.ts` | US4: danh sách, tạo, trang role, Public, policy, nhân bản, ma trận, drawer chi tiết | như trên |
| `settings-project.spec.ts` | US5: Project, Appearance, `system-owner`, `system-modules`, branding cập nhật | ba cấu hình, chromium |
| `settings-presets-translations.spec.ts` | US6: danh sách, trình sửa preset (scope, xem trước), translations, `refreshCurrentLanguage` | ba cấu hình, chromium |
| `settings-permissions.spec.ts` | người không admin: module ẩn, route → không có quyền; admin: 14 nút | ba cấu hình, chromium |
| `settings-parity-ui.spec.ts` | SC-004 (a)–(e) so với Directus app 8155 | `proxy-api`, chromium-1280 (`DIRECTUS_APP_SPECS`) |
| `settings-cross-use.spec.ts` | SC-002, SC-003: dùng chéo (R9) | `proxy-api`, chromium-1280 (`DIRECTUS_APP_SPECS`), worker 1 |
| `payload/settings.spec.ts` | SC-005: body ghi #157–#177 so với Directus app | `proxy-api`, chromium-1280 |

Quy tắc như 014/015: `pageerror`, `console.error`, missing-key làm test thất bại; host ngoài abort; bộ mẫu `bo_settings`
seed qua Directus REST trước bộ, dọn sau; DDL thật (tạo collection/field) tuần tự; `bo_raw` chỉ ở `proxy-api` (SQL qua
`hostDb()`). Spec sửa `directus_settings` (`settings-project`) chạy `test.describe.serial` trong một worker và khôi phục
settings ở `afterAll`; spec khác không khẳng định branding (CHK023).

## 4. Bộ so payload và bộ so DB (`proxy-api`)

- Payload: cùng kịch bản chạy trên Directus app (8155) và app mới; thu request ghi qua `page.route`; chuẩn hóa `id`,
  thời gian, `nanoid`, thứ tự khóa; so `method`, `path`, `query`, `body`; multipart không có ở 016. Request song song
  (ba `/access` của Public, hai `POST /relations` của `user_*`) được sắp theo `(method, path, body)` trước khi so
  (CHK024). Mốc body lấy từ T003 (chạy tay trên Directus app), lưu ở
  `apps/web-e2e/src/payload/baselines/settings-*.json` và dùng trong test component (T032, T054). Kiểm quan hệ lồng của
  T004 ở `apps/web-e2e/src/payload/nested-save.spec.ts`.
- DB: `snapshot()` trước và sau mỗi kịch bản trên 10 bảng; so `changesSince` của hai app sau chuẩn hóa (`id`, `sort`
  tự tăng của `directus_fields`, thời gian, `user_created`); dùng cho SC-002, SC-003 và T002 (R6, R7).

Bảng kịch bản → request ghi (SC-005, CHK069):

| Kịch bản | Request ghi |
|----------|-------------|
| Tạo folder, sửa folder, ẩn/hiện, gập mở, kéo thả cây, xóa folder | #157, #158, #159, #160 |
| Tạo collection với 6 field hệ thống | #157, #165 |
| Mở bảng `bo_raw`, xóa bảng | #159, #160 |
| Xóa collection có phụ thuộc | #164, #160 |
| Lưới field: kéo thả, ẩn, bề rộng, nhân bản, xóa, mở field không meta | #162, #163, #161, #164 |
| Drawer field: 10 field của US3 | #161, #163, #157, #159, #165, #166, #167 |
| Bật translations bằng helper | #168 |
| Role: tạo, sửa (policies, users), xóa, mời | #169, #177 |
| Public: thêm và gỡ policy | #172 |
| Policy: tạo (app_access), nhân bản, sửa ma trận, xóa | #170, #171 |
| Project, Appearance, chủ dự án | #173, #174 |
| Preset: tạo, sửa scope, xóa, xóa hàng loạt, sửa hàng loạt | #175 |
| Translation: tạo, sửa, xóa, xóa hàng loạt, sửa hàng loạt | #176 |

## 5. Kịch bản dùng chéo (SC-002, SC-003, `settings-cross-use.spec.ts`)

1. Tạo `bo_articles` + 10 field ở app mới qua UI → `onDirectusApp`: mở `/admin/content/bo_articles/+`, điền 10 field
   bằng `fillItemForm`, lưu → `GET /items/bo_articles?fields=*.*` qua API mới có 1 item đúng giá trị; so DB với kịch
   bản tương tự tạo ở Directus app (`bo_articles_d`).
2. Tạo `bo_editor2` + `bo_editor2_policy` + 5 permission ở app mới → tạo user qua API → đăng nhập user ở Directus app
   và ở app mới (context riêng) → sáu thao tác của SC-003 cho cùng kết quả (HTTP status và DOM: `aria-disabled`, có hay không trong DOM).
3. Chiều ngược: tạo collection và policy ở Directus app (`directusApi`) → mở ở app mới → lưới field, drawer field, ma
   trận hiện cùng giá trị (so `innerText`).
Giá trị điền cho 10 field (CHK067):

| Field | Giá trị |
|-------|---------|
| `title` | `Cross-use title` |
| `body` | `<p>Body</p>` |
| `tags` | `alpha`, `beta` |
| `author` | admin |
| `comments` | 1 dòng mới `{text: "c1"}` trong `bo_comments` |
| `categories` | 2 dòng mới `cat-a`, `cat-b` trong `bo_categories` |
| `attachments` | 1 file mẫu của `bo_files` (015) |
| `blocks` | 1 dòng `bo_categories`, 1 dòng `bo_s_tags` |
| `translations` | `en-US` và `vi-VN` với `title` |
| `group_seo` | field con `seo_title` = `SEO` |

Dọn: `DELETE /collections/bo_articles*`, `/roles`, `/policies`, `/users` ở `afterAll`.

## 6. Cổng CI

- `quality`: lint (`check-raw-colors`, `check-brand`, `check-port-headers`), typecheck, unit + browser với coverage,
  `PERF=1` bước perf, `check-bundle` (`BUDGET_016`, `LAZY_BUDGETS_016`), `app-permissions-data.test.ts`.
- `e2e-web` ma trận `proxy-directus`, `proxy-api`, `cors` (giới hạn 100 phút; spec `DIRECTUS_APP_SPECS` chỉ
  `proxy-api` chromium-1280).
- Parity `web`: `fixtures-seed.test.ts` mở rộng `bo_settings`.
- Build image web.
