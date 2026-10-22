# Rà phần còn thiếu so với Directus 11.17.4 (spec 001–019)

Ngày rà: 2026-10-20, trên `main` tại `f3762da`. Rà tĩnh: so route, id, tên file giữa `directus/` và `apps/`, đọc bảng
D-id và bảng Q trong `specs/*/spec.md`. Không chạy app để kiểm hành vi. Các mục ghi [Inference] là suy luận, chưa đo.

## 1. Tổng quan

| Phần                 | Directus | Backoffice    | Phần thiếu                                            |
| -------------------- | -------- | ------------- | ----------------------------------------------------- |
| Router API           | 36       | 31            | 5, đều ngoài phạm vi (mục 2); số đếm theo file router |
| Flow operation (API) | 15       | 15            | —                                                     |
| DB vendor            | 7        | 7             | —                                                     |
| Storage driver       | 6        | 2 (local, s3) | 4, D-16                                               |
| Module app           | 8        | 6             | `visual`, `deployment` (mục 2)                        |
| Interface            | 68       | 67            | `system-mcp-prompts` (mục 2)                          |
| Display              | 18       | 18            | —                                                     |
| Layout               | 5        | 5             | —                                                     |
| Panel                | 11       | 11            | —                                                     |
| Operation (app)      | 15       | 15            | —                                                     |
| Lệnh CLI             | 9        | 0             | Mục 4.6                                               |
| File ngôn ngữ app    | 70       | 2             | D-46                                                  |

## 2. Không làm, có chủ đích (hiến pháp mục XI hoặc D-id đã duyệt)

### 2.1 API

| Phần Directus                                                        | Hành vi Backoffice                                                            | Căn cứ                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| `/admin` (`SERVE_APP`)                                               | `404 ROUTE_NOT_FOUND`; app chạy container riêng                               | D-08 (001), D-120 (019)        |
| Storage `gcs`, `azure`, `cloudinary`, `supabase`                     | Dừng khi khởi động, báo location                                              | D-16 (001); xem mục 5.2        |
| Image `bootstrap` + `pm2-runtime`, `/metrics` gộp process            | `node main.js` một process dưới tini                                          | D-19 (001), D-121 (019)        |
| Auth `saml`                                                          | Bỏ qua, log `warn`, route `404`; ingress đưa `/auth/login/<saml>` về Directus | D-24 (003), `deploy/README.md` |
| Gửi email (reset mật khẩu, invite, mention, flow mail)               | Ghi log `warn`                                                                | D-33, D-34, D-36               |
| GraphQL subscription                                                 | Type `Subscription` vẫn có trong schema, không có transport                   | D-17 (011)                     |
| `/websocket`, collaborative editing, system logs realtime            | Không có                                                                      | Hiến pháp XI                   |
| Cài, gỡ, bật tắt extension; endpoint, hook, bundle app của extension | Như Directus từ 020 (2026-10-21)                          | D-37 gỡ ở 020                     |
| Báo cáo chủ dự án (`COMPLIANCE_URL`)                                 | Không gửi                                                                     | D-38 (010)                     |
| `/deployments`, webhook deployment                                   | Không có                                                                      | Hiến pháp XI                   |
| `/mcp`, `/ai/*`                                                      | Không có (`404`)                                                              | Hiến pháp XI; xem mục 4.2      |
| Telemetry, `requestCounter`                                          | Không có                                                                      | Hiến pháp XI                   |

### 2.2 App

| Phần Directus                                      | Hành vi Backoffice                    | Căn cứ                                                                          |
| -------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| Module `visual` (visual editor)                    | Không có; live preview vẫn có         | D-41, D-67 (014)                                                                |
| Module `deployment`                                | Không có                              | Hiến pháp XI                                                                    |
| Settings: AI, System logs (Marketplace, Extensions có từ 020) | Không có                              | D-93 (016)                                                                      |
| Nhóm AI, MCP trong Project settings                | Ẩn                                    | D-93 (016)                                                                      |
| Interface `system-mcp-prompts`                     | Không có                              | D-93 (016)                                                                      |
| Link "Report bug", "Request feature"               | Không có                              | D-94, D-95 (016)                                                                |
| AI assistant, realtime, collab                     | Không có                              | Hiến pháp XI                                                                    |
| Banner license, bước license ở `/setup`            | Không có                              | D-53 (012)                                                                      |
| Link docs                                          | Không có                              | D-49 (012), D-100 (016)                                                         |
| Breadcrumb                                         | Không có                              | D-101 (016)                                                                     |
| 68 gói ngôn ngữ khác                               | Chỉ `en-US`, `vi-VN`                  | D-46 (012)                                                                      |
| Theme Directus                                     | Theme TailAdmin, override từ settings | D-43, D-47, D-89; hiến pháp XII                                                 |
| Nút "Report error"                                 | Không có                              | D-109 (018)                                                                     |
| Snackbar                                           | Notice tại chỗ (`BoNotice`), hộp lỗi  | D-66 (013), xét lại và giữ ở 018                                                |
| Store AI; store extensions                         | Không nạp                             | D-45 (012): AI vĩnh viễn; store extensions có từ 020 |
| Lớp chồng so với khung app (`z-index`), `--header-bar-height`, dialog chặn chuột trên `body`; vài khác biệt hình thức nhỏ | Như hiện tại; sửa khi một extension cụ thể bị ảnh hưởng | D-142 (020) |
| Header dính của danh sách Roles, Policies | Không dính | D-143 (020) |
| Module extension trên thanh module | Gom vào một tab `Extensions` có menu trên thanh tab trên cùng, theo `module_bar` (sidebar trước D-157) | D-144 (020), D-157 (012) |

## 3. Đã có, chạy được nhưng thiếu một phần (có ghi trong spec; cả hai bỏ theo quyết định 2026-10-20)

| Mục           | Hiện trạng                                                                                                       | Căn cứ                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `/register`   | Trang public "chưa có sẵn" với link về đăng nhập; không có form đăng ký                                          | D-44 (012): owner 2026-10-20 bỏ, không làm   |
| `/shared/:id` | Đăng nhập share xong mở trang item của module Content trong session share; không có màn chỉ-đọc `share-item.vue` | D-126 (012): owner 2026-10-20 bỏ, không port |

## 4. Thiếu mà spec không ghi lý do

### 4.1 `/server/info` báo `websocket` theo env (trái hiến pháp XI)

**Đã sửa 2026-10-20** (chủ dự án quyết): REST và GraphQL `server_info` luôn trả `websocket: false`; ghi vào D-17 (001)
và danh sách khác biệt được chấp nhận của parity.

- Code: `apps/api/src/services/server.service.ts:104-134`. Khi `WEBSOCKETS_ENABLED=true`, trả object `websocket`
  (`rest`, `graphql`, `heartbeat`, `collaborativeEditing`, `logs`) như Directus. Chỉ khi biến tắt mới trả `false`.
- Hiến pháp `.specify/memory/constitution.md:316-317` và spec 012 (`spec.md:343`) ghi `/server/info` trả
  `websocket: false`.
- Nguồn gốc: 004 T036 (commit `cf3395c`) port nguyên nhánh của Directus, không ghi D-id.
- Ảnh hưởng: env dùng chung bật websocket cho Directus thì app nhận `websocket` khác `false`.
  - [Inference] Directus app trỏ vào Backoffice sẽ thử mở `/websocket`. Ở domain chung, lb xoay vòng request cả sang BE,
    nên kết nối có thể rơi vào replica không có route.
  - [Inference] App Backoffice không dùng realtime, nên ít bị ảnh hưởng.
- Đề xuất: luôn trả `false`, sửa test parity `server/info` theo, ghi D-id mới. Cách khác: giữ như hiện tại và sửa hiến
  pháp.

### 4.2 `/server/info` báo `mcp_enabled`, `ai_enabled` mặc định `true`

**Đã sửa 2026-10-20**: luôn trả `false`, cùng D-17.

- Code: `apps/api/src/services/server.service.ts:70-71`, mặc định `true` như Directus (`MCP_ENABLED`, `AI_ENABLED`).
- `/mcp` và `/ai/*` trả `404`. Hai biến thuộc nhóm C "chưa hỗ trợ"
  (`specs/001-platform-foundation/contracts/config.md:75`).
- App Backoffice đã bỏ hai cờ này (012 `research.md:151`), nên app mới không bị ảnh hưởng.
- [Inference] Directus app đi qua lb có thể hiện tính năng AI/MCP rồi gặp lỗi khi gọi.
- Đề xuất: luôn trả `false`, ghi D-id mới.

### 4.3 So sánh phiên bản: không diff HTML cho rich text

**Đã làm 2026-10-20**: `diff` 7.0.0, port `use-comparison-diff.ts`, `reconstruct-comparison-html.ts`,
`should-show-comparison-diff.ts`. Khác Directus ở D-124 (014): khôi phục revision gửi giá trị gốc, không gửi HTML đã tô
màu.

- Code: `apps/web/src/components/comparison/use-comparison.ts:3-5`. Không port `processRichTextHtmlFields`,
  `use-comparison-diff.ts`, `reconstruct-comparison-html.ts`, vì cần package `diff`.
- Field rich text vẫn được đánh dấu là khác, nhưng hai bên chỉ hiện giá trị thô, không tô phần thêm/xóa.
- Research của 014 có dự định port, nhưng không có D-id cho việc bỏ.
- Đề xuất: thêm `diff` (cùng phiên bản Directus dùng), port ba file. Hoặc ghi D-id.

### 4.4 Tiến độ upload theo file, không theo byte

**Đã làm 2026-10-20**: multipart qua `uploadWithProgress` (XMLHttpRequest), tiến độ theo byte như axios
`onUploadProgress` của Directus (đúng 015 FR-022).

- Code: `apps/web/src/components/files/BoUpload.vue:5`. Upload multipart dùng `fetch`, không có sự kiện tiến độ, nên
  thanh tiến độ chỉ nhảy khi xong từng file.
- Upload qua TUS (khi `uploads.tus` bật) không bị ảnh hưởng.
- Đề xuất: dùng `XMLHttpRequest` cho multipart; Directus dùng axios `onUploadProgress`
  (`directus/app/src/utils/upload-file.ts:130`). Hoặc ghi D-id.

### 4.5 Comment cũ về `injectVersionField`

**Đã làm 2026-10-20**: không chỉ là comment cũ, field `$version` thật sự chưa có. `FieldList` nhận `injectVersionField`
(useFakeVersionField như `v-field-list.vue`), `SystemFilter` truyền xuống, `InputGroup` hiện ô chọn cho `$version` như
`input-group.vue`.

- `apps/web/src/components/FieldList.vue:5` ghi `injectVersionField` "chờ feature versions". Versions đã có từ 014.
- `apps/web/src/interfaces/_system/system-filter/SystemFilter.vue:5` nhận option này. `AdvancedConditions.vue:54` có
  truyền vào.
- Cần kiểm lại: field ảo `$version` có hiện trong FieldList như Directus không. Chưa kiểm.

### 4.6 Lệnh CLI của Directus

**Đã ghi 2026-10-20**: D-123 (019), hướng dẫn ở `deploy/README.md` mục "Lệnh CLI".

- Directus có 9 lệnh (`directus/api/src/cli/commands`): `bootstrap`, `cache`, `count`, `database`, `init`, `roles`,
  `schema`, `security`, `users`.
- Backoffice không có CLI. D-19 chỉ nói về `bootstrap` trong image; 006 dùng API `/schema` thay `schema snapshot/apply`.
- Hiện vẫn phải dùng image Directus cho migrate DB, tạo user/role, xóa cache, sinh key.
- [Inference] Directus vẫn chạy song song nên không chặn vận hành. Chỉ thành vấn đề khi muốn bỏ hẳn Directus.
- Đề xuất: ghi D-id "CLI dùng image Directus". Hoặc port các lệnh cần.

## 5. Việc còn mở từ các spec trước

### 5.1 Chờ người duyệt hoặc người dùng

| Mục                                                | Spec               | Trạng thái                          |
| -------------------------------------------------- | ------------------ | ----------------------------------- |
| T075: buổi dùng thử SC-003 với 5 người dùng nội bộ | 012 `tasks.md:533` | Chưa làm, không chặn đóng           |
| Q-7: logo, favicon                                 | 012                | Đóng 2026-10-20: giữ chữ "B"        |
| Q-1..Q-12: recipe design cho màn CMS, SC-009       | 014                | Đóng 2026-10-20: design owner duyệt |
| D-44: `/register`                                  | 012                | Bỏ (owner 2026-10-20)               |

### 5.2 Thiếu bản ghi duyệt

Đã xong 2026-10-20: tech lead duyệt D-16 (001), D-120..D-123 và T079 (019), D-17 mở rộng (001), D-124 (014).

### 5.3 CI và đo hiệu năng

- Nightly (`.github/workflows/nightly.yml:2-4`): lịch tắt "cho đến khi xong mọi chức năng". Mọi feature đã xong, có thể
  bật lại `cron: '0 18 * * *'`. Cần kiểm trước: startup test cho các vendor khác (ghi chú cùng file) đã hỗ trợ chưa.
- ~~Benchmark web "files: next page" đỏ~~: chạy lại 2026-10-20 trên 7fb8faf thì đạt (run 39417286435; 126 / 112 ms so
  với 113 ms), không sửa code. Ngưỡng p95 trong `SPECKIT-GUIDE.md` §11 không đo lại trong CI thường, chỉ chạy job
  `benchmark` hằng tuần.

### 5.4 Vệ sinh tài liệu

**Đã dọn 2026-10-20**: Status 014, 017, 018 thành Done kèm commit đóng; dòng "chờ tech lead duyệt" ở plan 017, 018 ghi
ngày duyệt; checklist 014 sửa; D-67 của 013 đổi thành D-125; D-45 đánh dấu phần 013, 017 đã gỡ, phần còn lại vĩnh viễn,
bỏ "tìm kiếm toàn cục" (Directus 11.17.4 không có trong `directus/app/src`); D-66 thành vĩnh viễn.

| Chỗ                                                 | Vấn đề                                                                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specs/014-content-module/spec.md`                  | Status "Implementing (… closing)", feature đã đóng 2026-10-16                                                                                            |
| `specs/017-flows-editor/spec.md`                    | Status "Draft", feature đã đóng 2026-10-17                                                                                                               |
| `specs/018-insights-activity-notifications/spec.md` | Status "Draft", feature đã đóng 2026-10-18                                                                                                               |
| Plan 017, 018; checklist 014                        | Còn dòng "chờ duyệt" trong khi spec ghi đã duyệt                                                                                                         |
| D-67                                                | Trùng mã: 013 `spec.md:679` (`input-rich-text-html`) và 014 (visual editing)                                                                             |
| D-45 (012 `spec.md:623`)                            | Cột "gỡ" ghi 014, 018 "đã gỡ"; phần 017 (flows editor) chưa đánh dấu; phần AI, extensions, tìm kiếm toàn cục còn "tạm thời" mà không có feature nào nhận |
| D-66 (013)                                          | Vẫn ghi "ngoài phạm vi (tạm thời)" dù 018 đã quyết giữ; nên đổi thành vĩnh viễn                                                                          |

## 6. Đề xuất thứ tự

1. ~~Sửa 4.1 và 4.2~~: đã sửa 2026-10-20 (D-17).
2. ~~Quyết 4.3, 4.4, 4.6~~: đã làm 4.3, 4.4; 4.6 ghi D-123. 3.2 (`/shared` chỉ-đọc, D-126) và D-44 (`/register`) bỏ
   (owner 2026-10-20).
3. ~~Dọn 4.5 và mục 5.4~~: đã làm 2026-10-20.
4. Bật lại nightly sau khi chạy tay `workflow_dispatch` một lần xanh.
5. ~~Xin duyệt D-16, 019, Q-1..Q-12, Q-7~~: đã duyệt 2026-10-20. Còn T075 (lịch buổi dùng thử).
