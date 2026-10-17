# Contract: kiểm thử (R9, R12)

## 1. Vitest trong `apps/web` (như 013–016)

- `unit` (happy-dom): `use-flow-editor.test.ts` (12 kịch bản SC-006 so JSON body `PATCH /operations` + `PATCH
  /flows/:id` với mốc chép từ Directus app ở T002; vòng dữ liệu → lỗi D-105), 9 test arrows port nguyên,
  `triggers.test.ts` (port `triggers.test.ts` Directus + overview URL dùng `getApiUrl`), `operations/registry.test.ts`
  (so fixture trích: id, icon, name, description, options tĩnh, options hàm với 4 bộ đối số, overview với options
  mẫu), `modules/settings.test.ts` (route flows, guard not-found), `ExtensionOptions.test.ts` (+ `type operation`
  không chạm store field), `lang/overlay.test.ts` (+ khóa D-106 ở hai ngôn ngữ).
- `browser` (chromium): `FlowsOverviewRoute` (bảng, sắp xếp, menu: `PATCH {status}` và lỗi giữ store, xóa, nút tạo
  khóa theo quyền, rỗng), `FlowDrawer` (hai tab, khóa Next, 5 trigger và reset options, body `POST`/`PATCH`), `FlowRoute` (chế độ
  xem/sửa, panel và mũi tên từ `bo_all_ops`, kéo panel → staging, kéo nối/tháo, "+" gọi `router.push` tới
  `settings-flows-operation` `operationId '+'` (router giả; mở drawer thật kiểm ở `OperationDetail` sau khi có route con), Duplicate, Copy To
  `POST /operations`, Delete, Save body, Clear Changes, guard), `OperationDetail` (15 loại: số field, điều kiện ẩn,
  key tự sinh, duy nhất, loại lạ, Done với defaults; `mail` có notice D-106 hai ngôn ngữ), `error-codes.test.ts` (so
  `libs/errors/src/codes.ts`), Save lỗi giữ staging (R-47), trigger null, `LogsSidebarDetail` + `LogsDrawer` (nhóm
  ngày, icon, lọc, phân trang, drawer bước), axe cho bảng flow, trang flow (hai chế độ), drawer flow (hai tab), drawer
  operation (exec, mail, trigger), Logs + drawer log (sáng, tối), perf `perf.browser.test.ts` (`PERF=1`,
  `machineFactor()`).
- Coverage gộp ≥ 60 %.

## 2. API giả lập (`test-utils/fetch.ts`, `mockFixtureApi`)

- Thêm #178–#184; dữ liệu từ `fixtures/interfaces/snapshot/flows.json`, `operations.json`, và `revisions.flows.json`
  (3 log của `bo_all_ops`, xuất bằng `export.mjs`).
- Ca lỗi: mock trả 500 cho `POST /flows`, `PATCH /flows/<id>`, `PATCH /operations` khi test yêu cầu.
- `PATCH /flows/<id>`: mock nhận body lồng và trả `{id}`; test khẳng định body (không mô phỏng ghi lồng); sau đó `GET
  /flows` trả snapshot cập nhật tay trong test khi cần.
- `GET /revisions`: lọc theo `item`, `page`, trả `meta`/`aggregate` đếm.
- Request ngoài danh sách → test thất bại (`KNOWN_REQUESTS`).

## 3. E2E `apps/web-e2e` (ba cấu hình, SC-001)

| Spec | Nội dung | Projects |
|------|----------|----------|
| `settings-flows-overview.spec.ts` | US1: bảng, sắp xếp, menu đổi trạng thái, drawer tạo (5 trigger), sửa, xóa, lỗi lưu (route chặn trả 500 → hộp lỗi, drawer còn), điều hướng sau tạo (lượt 1 chỉ kiểm URL `/settings/flows/<id>`, trang đích kiểm ở `settings-flows-editor` lượt 2); trạng thái rỗng chỉ ở browser test (mock) vì bảng thật luôn có bộ mẫu | chromium 768/1280 ba cấu hình |
| `settings-flows-editor.spec.ts` | US2: xem `bo_all_ops` (panel, mũi tên, mờ), sửa: kéo panel, "+" thêm, kéo nối/tháo, Duplicate, Copy To, Delete, Save (so body qua `recordWrites`), Clear Changes, guard, Ctrl+S, Delete Flow | chromium 768/1280 ba cấu hình + firefox/webkit 1280 cùng origin |
| `settings-flows-operations.spec.ts` | US3: mở drawer từng loại trong `bo_all_ops`, so field với bảng data-model §5 (nhãn, loại input), key tự sinh/duy nhất, loại lạ `bo_orphan`, notice `mail` | chromium |
| `settings-flows-logs.spec.ts` | US4: badge 3, nhóm ngày, icon 2 resolve/1 reject, lọc, drawer bước và JSON | chromium |
| `settings-flows-manual.spec.ts` | US5: tạo flow manual tạm (sync với xác nhận, và một flow `async`), nút ở `/content/bo_content` và item, hộp xác nhận, `POST /flows/trigger/:id`, log mới | chromium |
| `settings-flows-cross-use.spec.ts` | FR-102 (a)–(d) trên Directus app 8155 | chromium-1280, `proxy-api` (`DIRECTUS_APP_SPECS`) |
| `settings-parity-ui.spec.ts` (+) | SC-004 (a)–(e) cho bảng flow, trang `bo_all_ops`, drawer flow, drawer operation | chromium-1280 |

Flow tạm của E2E đặt tên `web-e2e-<cfg>-<spec>-<n>` và xóa ở `afterAll` (`DELETE /flows` mảng qua `AdminApi`). Không
E2E nào chạy `bo_all_ops` (badge log 3 do seed). Webkit: test kéo có thể `test.fixme` nếu flake, lý do ghi ở spec.

## 4. Bộ so payload và bộ so DB (`proxy-api`)

- `payload/flows.spec.ts` (`test.skip(e2eConfig !== 'proxy-api')`): kịch bản (1) tạo flow manual qua drawer, (2) thêm 4
  operation và Save, (3) kéo panel + tháo + nối lại + Save, (4) Duplicate + Delete + Save, (5) đổi trạng thái ở menu,
  (6) Copy To, (7) sửa trigger qua pencil, (8) chạy từ trang item (confirm), (9) mở Logs (đọc `GET /revisions`), (10)
  xóa flow. Mỗi kịch bản chạy trên Directus app 8155 rồi Backoffice, `recordWrites` + `normalizeFlowsBody`; mốc
  `payload/baselines/flows-*.json` ghi ở T002 bằng tay trên Directus app và so lại khi chạy.
- Bộ so DB: `changesSince`/`snapshot` với `FLOWS_TABLES` sau kịch bản (1)–(7), (10); so sau chuẩn hóa (data-model §3).
- Request song song (`PATCH /operations` nhiều phần tử là một request mảng; `hydrate` sau ghi) sắp theo `(method,
  path, body)` trước khi so.

## 5. Kịch bản dùng chéo (SC-002, SC-003, `settings-flows-cross-use.spec.ts`)

1. Tạo `web-e2e-proxy-api-cross` (manual, confirmation `reason`) + 4 operation ở Backoffice → `openDirectusFlow` →
   `readDirectusGrid` (`--pos-x/--pos-y`) = `readGrid` (`data-pos-x/y`) (0 ô lệch), `countDirectusArrows` = `{resolve 3, reject 1}`, drawer `condition`
   hiện `filter` giống; `FLOWS_TABLES` bằng mốc.
2. Trên Directus app: Edit Flow, "+" ở reject của `transform` → `log` → Save → Backoffice tải lại: panel mới đúng ô và
   mũi tên.
3. Ngược lại: tạo flow + 2 operation trên Directus app → tải lại Backoffice (store chỉ nạp khi đăng nhập/ghi) → mở →
   so lưới, mũi tên, drawer.
4. Chạy từ trang item ở hai app (`reason` hợp lệ) → Logs hai app: badge +2, cùng bước; drawer của lần Backoffice chạy
   mở ở Directus app hiện cùng Options/Payload.
5. Flow `trigger operation` tạo ở Backoffice có trong select `trigger.flow` của drawer operation Directus app.

## 6. Cổng CI

- `quality`: lint, typecheck, `web:test` (unit + browser, coverage ≥ 60 %), `check-port-headers`, `check-brand`,
  `check-bundle` (`BUDGET_017`, `LAZY_BUDGETS_017`).
- `e2e-web`: ma trận ba cấu hình × projects; `settings-flows-editor` vào danh sách core; `settings-flows-cross-use`
  vào `DIRECTUS_APP_SPECS`; giới hạn 100 phút giữ.
- Parity `web`: `fixtures-seed.test.ts` so snapshot `flows.json`, `operations.json` giữa hai app (bỏ log).
