# Contract: kiểm thử (R8)

## 1. Hai project Vitest trong `apps/web`

| Project | Môi trường | File | Dùng cho |
|---------|-----------|------|----------|
| `unit` | happy-dom (như 012) | `src/**/*.test.ts` | utils, store, composable, form, display, interface nhẹ (VTU) |
| `browser` | `@vitest/browser` + playwright chromium headless | `src/**/*.browser.test.ts` | TinyMCE, Editor.js, CodeMirror, MapLibre, drawer (focus trap), bàn phím, axe, SC-004 |

`vitest.config.ts` dùng `test.projects`; coverage v8 gộp, ngưỡng 60% (dự phòng istanbul). Target Nx `web:test` chạy
cả hai; `web:test:unit` chạy nhanh khi dev. CI job `test-web` cài `playwright install chromium` (cache như e2e-web).

## 2. Bộ mẫu

- `pnpm nx run web:fixtures -- --api http://127.0.0.1:<port> --token <admin token>`: `seed.mjs` rồi `export.mjs`
  (data-model §6). Chạy trên profile `app` của `tests/parity` (Directus thật) khi tạo hoặc sửa bộ mẫu; snapshot
  commit.
- `fixtures/snapshot.test.ts` (unit): mỗi interface id và display id có ít nhất một field trong `fields.json`; mỗi
  khóa options ở FR-020..FR-079 xuất hiện ít nhất một lần (SC-003 phần "đọc giá trị đã lưu").
- `test-utils/fixtures.ts`: `loadSnapshot()`, `fieldsOf(collection)`, `itemOf(collection, id)`,
  `expected(interface, scenario)`.

## 3. API giả lập (`test-utils/fetch.ts`)

`mockFixtureApi(snapshot, { user })` bọc `mockApi` có sẵn, trả lời theo bảng `contracts/api-calls.md` (#33..#48 và
các route 012 cần cho hydrate): `/fields`, `/relations`, `/collections`, `/permissions/me` (theo user), `/presets`,
`/flows`, `/settings`, `/items/<c>` và `/files` (lọc trong bộ nhớ: `_eq`, `_neq`, `_in`, `_nin`, `_null`, `_nnull`,
`_or`, `_and`, `search`, `limit`, `page`, `sort`, `fields` lồng một cấp, `aggregate[count]`), `/assets/<id>` (blob
1×1), `POST /files` (tạo row file mới trong bộ nhớ), `POST /files/import`, `POST /flows/trigger/<id>` (ghi lại). Mọi
request vào `calls()`; helper `assertOnlyKnownRequests(calls)` (chép ý từ `apps/web-e2e/src/helpers/requests.ts`)
kiểm FR-054, FR-081, SC-007.

## 4. Test port từ Directus (FR-120)

39 file `*.test.ts` của `directus/app/src/{interfaces,displays}` → cùng tên trong thư mục tương ứng của app, header
`// Ported from directus/app/src/.../x.test.ts`, manifest `013-T*.json`. Hành vi giữ; API component đổi theo `Bo*`.

## 5. Kịch bản chung cho mỗi interface

1. Dựng `BoForm` với field của bộ mẫu dùng interface đó và `initialValues` từ item mẫu: không phát `update:modelValue`.
2. Thiếu khóa options: dùng mặc định component (Edge Cases).
3. Mỗi khóa options: ít nhất một test kiểm hiệu ứng (SC-003).
4. Kịch bản sửa (`expected.<interface>.json`): giá trị phát ra bằng mong đợi (SC-002).
5. `disabled`, `nonEditable`, `loading` (skeleton), lỗi validation hiện ở `FormField`.
6. Bàn phím: thao tác chính không cần chuột (browser project với interface có overlay).

## 6. Axe và hiệu năng (browser)

- `a11y.browser.test.ts`: form `bo_std` + `bo_groups`, bảng 18 display, ở sáng và `html.dark`; `axe.run` 0 vi phạm
  `serious`/`critical`; ngoại lệ ghi trong test với lý do (như `a11y.spec.ts` 012).
- `perf.browser.test.ts`: 50 field / 100×10 ô, `performance.now()` < 1.000 ms, thử lại 2 lần.

## 7. Đối chiếu seed ở hai API (`tests/parity/src/web/fixtures-seed.test.ts`)

Trong profile `web` (có Directus và API mới): chạy `seed.mjs` + `export.mjs` vào từng app (DB riêng của cặp hoặc
tên collection `bo_<app>_*` rồi đổi tên khi so), chuẩn hóa, `expect(exportNew).toEqual(exportDirectus)`; khác biệt
thật ghi R-xx. Chạy trong job parity hiện có (không job mới).

## 8. Cổng CI

`web:lint` (ESLint, `check-raw-colors` với danh sách miễn Q-C), `web:typecheck`, `web:test` (unit + browser,
coverage ≥ 60%), `web:build` (ngân sách chunk R12), guard `check-port-headers`, `guard-directus-unchanged`, parity
`web`.
