# Contract: kiểm thử (R12, R14)

## 1. Vitest trong `apps/web` (như 013)

| Project | File | Dùng cho |
|---------|------|----------|
| `unit` (happy-dom) | `src/**/*.test.ts` | composable chép (`use-preset`, `use-item`, `use-versions`, `use-revisions`, `use-edits-guard`, `use-permissions`, `use-comparison`), utils (`format-items-count`, `save-as-csv` so byte với `fixtures/.../expected.csv`, `get-route`, guard `checkForSystem`), store presets, `system-filter` (JSON phát ra = 10 mẫu Directus), route/nav logic, `lang/keys.test.ts` (mọi khóa `$t('…')` tĩnh trong `modules/content`, `layouts`, `components/sidebar` có trong `en-US.json`) |
| `browser` (chromium) | `src/**/*.browser.test.ts` | 5 layout trên `mockFixtureApi`, bảng 1000 × 10 (`PERF=1`, SC-011), kéo thả + bàn phím D-69, menu version, hộp so sánh, 4 sidebar, xuất/nhập, live preview (`about:blank`), cây collection, axe sáng/tối (SC-006) |

Coverage v8 gộp ≥ 60 %. Test bản đồ tự bỏ qua khi không có WebGL (013).

## 2. API giả lập (`test-utils/fetch.ts`, `mockFixtureApi`)

Mở rộng theo `contracts/api-calls.md` #50–#96: `/presets` CRUD trong bộ nhớ (id tăng; `getPresetForCollection` thấy
ngay), `/revisions` (+ `aggregate`, `limit 1`), `/versions` CRUD + `compare` (`{outdated:false, mainHash:'h', current,
main}`) + `save` + `promote` (ghi vào item), `/comments` CRUD, `/shares` CRUD + `invite`, `/users` (`search`,
`filter id _in`, `/users/<id>`), `/utils/sort` (đổi thứ tự trong bộ nhớ), `/utils/export` (ghi lại), `/utils/import`
(multipart, đếm dòng), `/items` `aggregate` theo `filter` và `filterSystem`, `export=csv` (CSV từ bộ nhớ),
`/graphql` (`<c>_by_id` trả item), `/permissions/me/<c>/<pk>`. Snapshot thêm `presets.json`, `versions.json`,
`shares.json`, `revisions.bo_std.json`, `comments.bo_std.json`, `flows.json` mở rộng. `assertOnlyKnownRequests`
chặn path ngoài danh sách (SC-008).

## 3. E2E `apps/web-e2e` (ba cấu hình, SC-001)

| Spec | Story | Nội dung |
|------|-------|----------|
| `content-navigation.spec.ts` | US1 | cây, nhóm, ẩn, tìm, collection gần nhất, chuyển hướng hệ thống |
| `content-tabular.spec.ts` | US1 | cột, độ rộng, sắp xếp, trang, kích thước, chọn, Ctrl+click, trạng thái trống/lỗi; preset ghi ra (so dòng `directus_presets` qua API) |
| `content-item.spec.ts` | US2 | tạo, lưu kiểu, bản sao, xóa, archive, unsaved_changes, singleton, quyền |
| `content-filter-bookmark.spec.ts` | US3 | bộ lọc 3 cấp, số điều kiện, bookmark tạo/mở/sửa/xóa/cập nhật/đặt lại, preset role/global, `?bookmark` không tồn tại |
| `content-layouts.spec.ts` | US4 | mỗi layout một kịch bản (cards ảnh/tiêu đề; calendar đổi tháng + kéo; kanban kéo thẻ; map nền + chọn) |
| `content-sidebar.spec.ts` | US5 | revisions + revert, comments + mention, shares + link, flows |
| `content-versions.spec.ts` | US5 | tạo, chuyển, lưu, so sánh, promote, xóa |
| `content-live-preview.spec.ts` | US2 | nút, chia đôi, toàn bề rộng, popup, nạp lại sau lưu |
| `content-export-import.spec.ts` | US6 | export tải về (so file), export thư viện, import CSV, lỗi import |
| `content-batch.spec.ts` | US6 | xóa/archive/sửa hàng loạt, archive sidebar, refresh |
| `content-permissions.spec.ts` | US7 | `bo-editor`, `bo-viewer`; share `/shared/<id>` |

Điều kiện: bộ mẫu `bo_*` seed trước (bước CI `web:fixtures` trên Directus 8155; màn dùng `bo_content`, form 013 dùng
`bo_std`); ba cấu hình dùng chung DB: dữ liệu ghi có `DATA_PREFIX`, mỗi spec dọn phần mình tạo, và xóa preset +
bookmark của admin trên collection nó dùng ở `beforeEach` (`AdminApi`, `DELETE /presets` theo `user` + `collection`),
bookmark đặt tên `${DATA_PREFIX}-…`. Mọi request ngoài `allowed-paths.ts` (#50–#96 thêm) làm test thất bại;
`pageerror`, `console.error`, missing-key i18n làm test thất bại (012). Host ngoài: `page.route('**/*')` abort mọi host
khác `webUrl`/`apiUrl`/`localhost`, trừ stub: `tile.openstreetmap.org` → PNG 1×1, `fonts.openmaptiles.org` → 204,
`api.mapbox.com` → style JSON tối thiểu và geocoding rỗng (SC-005 "Mapbox giả lập"), `preview.example` → HTML rỗng.
Trình duyệt: chromium-768 và chromium-1280 cho mọi spec ở ba cấu hình; firefox-1280 và webkit-1280 chỉ
`content-tabular`, `content-item`, `content-filter-bookmark`; `content-permissions` chạy thêm một lượt với user
`vi-VN` (số đếm, ngày nhóm).

## 4. Bộ so payload (`apps/web-e2e/src/payload/*.spec.ts`, SC-004)

Chạy chỉ khi `E2E_CONFIG=proxy-api` (`test.skip` ở cấu hình khác). Mỗi kịch bản:

```ts
const dir = await recordWrites(page, 'http://127.0.0.1:8155', (p) => directusApp.createItem(p, ...));
const bo  = await recordWrites(page, webUrl,                  (p) => backoffice.createItem(p, ...));
expect(normalize(bo)).toEqual(normalize(dir));
```

`recordWrites`: `page.on('request')` lọc `POST|PATCH|DELETE|SEARCH` tới `/items|/presets|/versions|/comments|/shares|/utils|/graphql`,
ghi `{method, path (bỏ host, bỏ id dữ liệu), body: JSON.parse(postData)}` **theo thứ tự gửi** (kanban: `/utils/sort`
rồi `PATCH`); `normalize`: thay `DATA_PREFIX`/tag, uuid → `<uuid>`, số nguyên id trong path → `<id>`, thời gian ISO →
`<ts>`, `time`/`id` block editor, sắp khóa object (thứ tự mảng giữ); bỏ request `track/page`. Trước lượt Directus app:
đặt `last_page` null và xóa cache dữ liệu như `bothRuns` của `tests/directus-app-e2e`. Kịch bản không driver được
trên Directus app (kéo thả không ổn định) ghi "chỉ E2E app mới" trong spec file. Helper Directus app chép từ `tests/directus-app-e2e/src/helpers/app.ts` (`field`,
`saveButton`, `login`) có header nguồn. Kịch bản: item tạo/sửa/bản sao/xóa/archive (`bo_std`), preset tự lưu (đổi cột
và sắp xếp) + bookmark, bộ lọc 3 cấp (so `filter` trong body `/presets`), version tạo/save/promote, comment, share tạo +
invite, xóa và sửa hàng loạt, export tải về (so file CSV byte), import CSV (so body multipart: tên field, tên file), kéo
sắp xếp tay (`/utils/sort`). Khác biệt thật → R-xx trong spec.

## 5. Benchmark màn (`tests/benchmark/src/web-content.ts`, SC-003)

Target Nx `benchmark:web`; job `benchmark-web` trong `benchmark.yml` (hằng tuần, `workflow_dispatch`), sau
`benchmark-items` (dùng seed 10 triệu dòng của `seed-items.ts`). Compose benchmark thêm `backoffice-web` ×2 (proxy
Directus 8155 / API 8156) [Unverified: T0xx]. Playwright chromium headless, 11 lần mỗi phép đo, p95:

| Phép đo | Cách | Ngưỡng |
|---------|------|--------|
| trang đầu | `goto('/admin/content/<bench>')` → `tbody tr:nth-child(25)` hiện | < 2.000 ms |
| đổi trang | bấm "sau" → dòng đầu đổi | < 1.500 ms |
| sắp xếp có index | header `date_created` → dòng đầu đổi | < 1.500 ms |
| sắp xếp không index | header `title` | ghi, không ngưỡng |
| lọc `status = published` | bộ lọc nâng cao → dòng đầu đổi | < 1.500 ms (có index) |
| số request | `page.on('request')` đếm `/items` mỗi thao tác | đúng 1 danh sách, ≤ 1 đếm |
| số đếm | thời điểm `showingCount` hiện | ghi |

Ghi vào báo cáo markdown như `items.ts`. Tiêu chí chặn (SC-003): cùng phép đo trên Directus app (8155/admin) chạy xen
kẽ; app mới không chậm hơn quá 10 % p95 ở cả hai cấu hình API; ngưỡng tuyệt đối trong bảng là mục tiêu, chỉ ghi.
Số request kỳ vọng: đổi trang và sắp xếp = 1 danh sách, 0 đếm; lọc/tìm = 1 + 1 `itemCount`; vào route = 1 + 2.

## 6. Cổng CI

`web:lint` (ESLint, `check-raw-colors`, `check-brand`), `web:typecheck`, `web:test` (unit + browser, coverage ≥ 60 %),
`web:build` + `check-bundle` (ngân sách R14), `web perf` (`PERF=1` thêm `layouts/tabular/perf.browser.test.ts`),
`check-port-headers`, `guard-directus-unchanged`, `e2e-web` (ba cấu hình + bước seed `bo_*` trước; payload ở
proxy-api), parity `web` (`fixtures-seed`), `e2e-directus-app` giữ nguyên; `benchmark.yml` job `benchmark-web`
không chặn.
