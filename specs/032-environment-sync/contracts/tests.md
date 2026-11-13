# Contract: Kiểm thử (FR-038, FR-039)

## 1. Unit `apps/api`

| File | Kiểm |
|------|------|
| `sync/state.test.ts` | `readState` trên SQLite trong bộ nhớ: mỗi nhóm trả đúng bảng và cột; bỏ cột của data-model; bỏ field có special `encrypt`/`conceal`/`hash`; preset chỉ `user` null và `role` null; link chỉ `user` null; index chỉ `ready`; operations nằm trong flow, panels trong dashboard; ngày giờ là chuỗi |
| `sync/diff.test.ts` | bốn trạng thái cho từng `kind`; `cascade` của collection, policy, role, folder theo bảng "Xóa kèm" của data-model; thay đổi chỉ ở giá trị bỏ qua (ngày giờ, người sửa) không đổi `hash`; khóa so khớp của data-model (permission, preset, translation, extension, index theo khóa tự nhiên; còn lại theo id); trùng khóa; `depends` của từng loại; `selectable: false` cho admin role/policy `target_only`, field settings trỏ file thiếu, field mã hóa, extension một bên; `impact`; collection `source_only` nuốt field mới của nó; dòng `same` không mang giá trị |
| `sync/source.test.ts` | axios giả: URL `https://user:pass@host` → 400; 301 cùng host → 503; trả lời lớn hơn 100 MB → 503; lỗi trả về không chứa nội dung trả lời của nguồn; 401 → 400 "rejected the token"; 403; 404 → "does not support"; 3xx → 503; timeout → 503; sai hình dạng → 503; URL không http/https hoặc có credentials → 400; bảng và cột lạ trong `state` bị bỏ (FR-006); lỗi ném ra không chứa URL, token, không có `cause` |
| `sync/apply.test.ts` | khóa được giữ trước khi đọc lại hai bên và so hash (một thay đổi ở đích giữa lúc so sánh và lúc lấy khóa vẫn bị bắt); `selected` thiếu một dòng trong `cascade` → 400; lỗi ở việc sau commit → 200 với `warnings`; thứ tự của data-model; flow mới với FK vòng; xóa flow đặt `resolve`/`reject` null trước; dòng lỗi → rollback, lỗi mang `extensions.row`; `selected` lạ, không tick được, thiếu phụ thuộc → 400 trước khi ghi; hash lệch → 400; việc sau commit được gọi đúng một lần và chỉ khi nhóm tương ứng có ghi; index chạy sau commit, lỗi index không hoàn tác; người gọi mất admin → 400 và rollback |
| `services/backoffice-sync.service.test.ts` | `info()` lấy từ `BACKOFFICE_VERSION`, `checkMigrations`; so `SyncInfo` (khác phiên bản, khác danh sách migration); khóa: cờ trong process cho 503 ngay |
| `controllers/backoffice-sync.controller.test.ts` (supertest) | bốn route: 401, 403 user thường, 200 admin; `res.locals.cache === false`; body sai 400; `groups` lạ 400 |

## 2. Parity

### 2a. `tests/parity/src/sync/route.test.ts` (cặp chính; bộ rút gọn và đủ; Postgres, SQLite, MySQL)

1. D-214: `GET /backoffice/sync`, `GET /backoffice/sync/state`, `POST /backoffice/sync/diff`, `POST /backoffice/sync/apply`
   tại Directus → 404 `ROUTE_NOT_FOUND`.
2. Backoffice: `GET /backoffice/sync` admin → 200 với `backoffice`, `directus: '11.17.4'`, `vendor`, hai danh sách
   migration; user thường → 403; không token → 401; `/server/specs/oas` không chứa `/backoffice/sync` (analyze E5).

### 2b. Profile `sync` (chỉ Postgres; `describe.skipIf` khi profile không chạy)

Nguồn: `backoffice-api` của cặp chính, URL trong mạng Docker `http://backoffice-api:8055`, token tĩnh của một user admin
tạo cho suite. Đích: `backoffice-api-sync` (cổng 10856) với `ADMIN_TOKEN` của `env/profile-sync.env` (cùng extension và migration với cặp chính; analyze E1); node thứ hai
`backoffice-api-sync-2` (10857) cùng DB.

| File | Ca |
|------|----|
| `sync/diff.test.ts` | seed ở nguồn: collection `parity_sync_a` (3 field, 1 relation), flow 2 operation, policy + 3 permission + 1 quyền import, role + link, translation, preset global, dashboard + panel, folder, index; seed ở đích: flow và collection riêng, một policy sửa khác. So sánh: mỗi nhóm đủ bốn trạng thái; `GET /backoffice/sync/state` không chứa `**********`; sau so sánh, dump số dòng của các bảng cấu hình ở hai bên không đổi (FR-015); nguồn là chính đích → mọi dòng `same` (analyze E3) |
| `sync/apply.test.ts` | tick flow, collection, policy + permission, một field settings → áp dụng → ở đích: `GET /flows/:id` có đủ operations và `status` như nguồn; trigger webhook của flow chạy ở **cả hai node** đích; tạo item trong `parity_sync_a` ở cả hai node; permission đúng; field settings đúng; dòng không tick không đổi (so dump trước và sau, SC-002); activity và revision của các dòng mang user admin của đích (FR-028). Tick xóa flow và collection của đích → biến mất cùng permission và preset của collection (có trong `cascade` của
dòng collection); dòng `target_only` không tick và không nằm trong `cascade` còn nguyên. Sửa một flow có operation chỉ ở
đích → operation đó bị xóa, operation của nguồn được thêm. Index: tick một index → kết quả `creating`, sau đó `ready` |
| `sync/refuse.test.ts` | nguồn là Directus (`http://directus:8055`) → 400 "does not support"; token sai → 400; URL không tới được → 503; `http://localhost:8055` → 400 "not allowed" (danh sách chặn mặc định); route giả của `registry`: lệch phiên bản → 400 kèm hai phiên bản, chuyển hướng → 503, sai hình dạng → 503; user thường ở đích → 403; đổi một flow ở nguồn sau khi so sánh rồi áp dụng → 400 "out of date", đích không đổi; hai lượt áp dụng cùng lúc vào cùng node → một 200, một 503 ngay; vào hai node → một 200, lượt kia 503 hoặc 400 "out of date", không ghi gì (analyze I1); thu hồi token nguồn giữa diff và apply → 400 (analyze E3); một dòng lỗi giữa chừng (permission trỏ policy bị xóa khỏi `selected`) → 400 trước khi ghi; lỗi khi ghi sau khi đã tạo collection → collection không còn ở đích (SC-004); xóa policy admin của đích không tick được; áp dụng làm người gọi mất admin → 400, không đổi |
| `sync/no-trace.test.ts` | sau các lượt trên: token nguồn và chuỗi `backoffice-api:8055` không có trong log của hai node đích, trong `directus_activity`, `directus_revisions` của đích (SC-005) |
| `sync/directus-cross.test.ts` | (analyze C1) nguồn `backoffice-api-sync`, đích `backoffice-api` của cặp chính (chung DB và Redis với `directus`): sau khi áp dụng một flow và một collection, `directus` đọc, tạo item, sửa flow được; áp dụng lần hai đổi tên flow → `directus` đọc thấy tên mới (cache đã xóa); dọn qua Directus (FR-029, US6 kịch bản 3, SC-007) |

Route giả thêm vào `tests/parity/registry/server.mjs`: `/sync-fake/mismatch/backoffice/sync` (phiên bản khác),
`/sync-fake/redirect/backoffice/sync` (302 sang host khác), `/sync-fake/shape/backoffice/sync` + `/state` (JSON sai).

### 2c. `tests/parity/accepted-differences.ts`

Hai entry `doc`, `feature: '032'`: D-214 (bốn route chỉ có ở Backoffice), D-214.1 (trang Settings). Không entry `http`.

## 3. Unit và browser `apps/web`

| File | Kiểm |
|------|------|
| `composables/use-environment-sync.test.ts` | 200 → available; 404, lỗi mạng → không; cache theo URL API |
| `modules/settings/components/SettingsNavigation.test.ts` | link hiện khi available, ẩn khi không |
| `modules/settings/routes/sync/use-sync.test.ts` | tick kèm phụ thuộc và bỏ tick ngược; ô nhóm không tick dòng xóa; dòng không tick được; `url`, `token` bị xóa khi hủy; không ghi `localStorage`, `sessionStorage` |
| `SyncRoute.test.ts` | các `phase`; lỗi API hiện đúng chuỗi; lệch phiên bản hiện hai phiên bản; "out of date" có nút so sánh lại |
| `SyncRoute.browser.test.ts` | axe ở `idle`, `compared`, hộp xác nhận, `done`; điều khiển bằng bàn phím: tick dòng, tick nhóm, mở chi tiết, áp dụng |

## 4. E2E `apps/web-e2e/src/settings-sync.spec.ts`

Nguồn: `backoffice-api-sync` (`http://backoffice-api-sync:8055` từ API, `http://localhost:10856` từ Playwright để seed).
Đích: API mà web đang dùng. CI job `e2e-web` bật thêm profile `sync`.

| Cấu hình | Ca |
|---|---|
| `proxy-directus` | Settings không có mục đồng bộ; `/admin/settings/sync` hiện not-found |
| `proxy-api`, `cors` | seed một flow và một collection ở nguồn → mở trang, nhập URL và token, So sánh → thấy hai dòng "chỉ ở nguồn" → tick → Áp dụng → hộp xác nhận → kết quả; mở Flows và Data Model thấy cả hai; tải lại trang: form trống. Tạo một flow chỉ ở đích → So sánh → tick xóa → hộp xác nhận liệt kê tên flow, nút danger → sau khi xác nhận flow biến mất. Dọn mọi thứ đã kéo |
| mọi cấu hình có trang | axe trên trang ở `compared` |

`helpers/allowed-paths.ts`: thêm bốn route mới.

## 5. Đo một lần (không vào CI)

T-đo: với 200 collection, 100 flow, 2.000 permission ở nguồn (seed bằng script), thời gian `POST /backoffice/sync/diff`
và thời gian hiện bảng; ghi vào research "Kết quả lượt 1" và chỉnh SC-006 nếu cần.
