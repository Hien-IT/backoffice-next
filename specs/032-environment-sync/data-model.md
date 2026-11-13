# Data Model: Đồng bộ cấu hình từ môi trường khác (032)

Không bảng mới, không cột mới, không migration, không key Redis bền (chỉ khóa `backoffice-sync-apply` trong lúc áp dụng).
Mọi kiểu dưới đây chỉ sống trong một request (FR-003). Tên kiểu là đề xuất cho code, đặt ở `apps/api/src/sync/types.ts`
và chép phần web cần sang `apps/web`.

## Kiểu

```ts
type GroupKey =
  | 'schema' | 'flows' | 'access' | 'settings' | 'translations'
  | 'presets' | 'dashboards' | 'indexes' | 'folders' | 'extensions';

interface SyncInfo {
  backoffice: string;                       // BACKOFFICE_VERSION
  directus: string;                         // DIRECTUS_COMPAT_VERSION
  vendor: string;                           // getDatabaseClient()
  migrations: { directus: string[]; backoffice: string[] };   // version đã chạy, đã sắp xếp
}

interface SyncState {                        // kết quả của readState(groups), cùng hàm ở nguồn và đích
  schema?: Omit<Snapshot, 'systemFields'>;
  flows?: Row[];                             // mỗi flow có operations: Row[]
  access?: { roles: Row[]; policies: Row[]; links: Row[]; permissions: Row[]; bo_permissions: Row[] };
  settings?: Row;                            // một dòng, đã bỏ field mã hóa
  translations?: Row[];
  presets?: Row[];                           // user null và role null
  dashboards?: Row[];                        // mỗi dashboard có panels: Row[]
  indexes?: Row[];                           // status ready: collection, name, fields, type, unique
  folders?: Row[];
  extensions?: { name: string; bundle: string | null; enabled: boolean }[];
}

type RowState = 'same' | 'changed' | 'source_only' | 'target_only';

interface SyncRow {
  id: string;                                // `${group}/${kind}:${key}`, duy nhất trong một lượt so sánh
  group: GroupKey;
  kind: string;                              // xem bảng dưới
  key: string;                               // khóa so khớp
  label: string;                             // tên hiển thị (tên flow, tên collection, "policy · collection · action")
  state: RowState;
  changes?: { path: string; source: unknown; target: unknown }[];   // khi changed
  source?: Row;                              // khi source_only
  target?: Row;                              // khi target_only
  depends: string[];                         // id các dòng phải được áp dụng cùng nếu chúng chưa "same"
  cascade: string[];                         // id các dòng target_only bị xóa theo khi dòng này bị xóa
  selectable: boolean;
  reason?: string;                           // khóa i18n khi selectable = false
  impact?: { items?: number; users?: number; files?: number; permissions?: number; active?: boolean };
}

interface SyncResult {
  created: Partial<Record<GroupKey, number>>;
  updated: Partial<Record<GroupKey, number>>;
  deleted: Partial<Record<GroupKey, number>>;
  deletedLabels: string[];                   // tên collection, field, dòng đã xóa
  indexes: { collection: string; name: string; action: 'create' | 'delete'; status: 'creating' | 'done' | 'failed'; error?: string }[];
  warnings: string[];                        // bước sau commit bị lỗi (xóa cache, reload flow, reload extension), FR-025
}
```

`Row` là object JSON thường sau `JSON.parse(JSON.stringify(...))` (ngày giờ thành chuỗi ISO).

## Nhóm, loại dòng, khóa so khớp

| Nhóm (FR-007) | `kind` | Bảng | Khóa so khớp | Tạo ở đích | Bỏ khi so và khi chép |
|---|---|---|---|---|---|
| `schema` | `collection` | qua snapshot | tên collection | `applyDiff` (kèm field mới của nó) | — |
| `schema` | `field` | qua snapshot | `collection.field` (chỉ khi collection có ở cả hai bên) | `applyDiff` | — |
| `schema` | `relation` | qua snapshot | `collection.field` | `applyDiff` | — |
| `flows` | `flow` | `directus_flows` + `directus_operations` | id flow; operation theo id, nằm trong dòng flow | giữ id nguồn | `date_created`, `user_created` |
| `access` | `role` | `directus_roles` | id | giữ id nguồn | — |
| `access` | `policy` | `directus_policies` | id | giữ id nguồn | — |
| `access` | `link` | `directus_access` (chỉ dòng `user` null) | id | giữ id nguồn | `user` |
| `access` | `permission` | `directus_permissions` | `policy:collection:action` | không truyền id | `id` |
| `access` | `bo_permission` | `backoffice_permissions` | `policy:collection:action` | không truyền id | `id` |
| `settings` | `field` | `directus_settings` | tên field | cập nhật singleton | `id`, field có special `encrypt`/`conceal`/`hash` |
| `translations` | `translation` | `directus_translations` | `language:key` | không truyền id | `id` |
| `presets` | `preset` | `directus_presets` (`user` null, `role` null) | `collection:bookmark` (bookmark rỗng khi null) | không truyền id | `id`, `user`, `role` |
| `dashboards` | `dashboard` | `directus_dashboards` + `directus_panels` | id dashboard; panel theo id, nằm trong dòng | giữ id nguồn | `date_created`, `user_created` |
| `indexes` | `index` | `backoffice_indexes` (`status` ready) | `collection:name` | `BackofficeIndexesService.create` sau commit | `id`, `status`, `error`, ngày giờ |
| `folders` | `folder` | `directus_folders` | id | giữ id nguồn | — |
| `extensions` | `extension` | `directus_extensions` + manifest | tên gói, hoặc `tên bundle/tên entry` | không tạo | mọi thứ trừ `enabled` |

Hai dòng cùng khóa ở một bên (ví dụ hai preset global cùng collection và bookmark): dòng đầu được so, các dòng sau có
`selectable: false`, `reason: 'sync_duplicate_key'`.

## Trạng thái và thao tác

| `state` | Tick nghĩa là | Mặc định | Ô nhóm tick |
|---|---|---|---|
| `same` | không có gì | không có ô | không |
| `changed` | sửa đích theo nguồn | không tick | có |
| `source_only` | tạo ở đích | không tick | có |
| `target_only` | xóa ở đích | không tick | không (FR-018) |

Index không có `changed` (cùng tên là cùng định nghĩa). Extension chỉ có `same` hoặc `changed`; extension chỉ ở một bên
hiện `source_only` hoặc `target_only` với `selectable: false`, `reason: 'sync_extension_missing'` (FR-014).

## Phụ thuộc (`depends`) và lý do không tick được

| Dòng | Cần | Khi thiếu |
|---|---|---|
| field, relation | collection của nó (và collection đích của relation) | tick kèm; nếu dòng cần không tick được thì chặn |
| collection có `meta.group` | collection nhóm cha | tick kèm |
| link | role và policy | tick kèm |
| permission, bo_permission | policy; collection (nếu là collection người dùng) | tick kèm |
| role có `parent` | role cha | tick kèm |
| preset, index | collection (index: cả các field) | tick kèm |
| folder có `parent` | folder cha | tick kèm |
| settings field m2o tới folder, role | folder, role đó | tick kèm |
| settings field m2o tới file | file có ở đích | `selectable: false`, `reason: 'sync_file_missing'` (clarify 2) |
| settings field mã hóa | — | `selectable: false`, `reason: 'sync_value_hidden'` (clarify 3) |
| xóa role, policy có quyền admin | — | `selectable: false`, `reason: 'sync_admin_protected'` (clarify 1) |

"Tick kèm" là việc của web (tiện ích). Máy chủ kiểm lại ở lượt áp dụng: dòng được chọn mà phụ thuộc chưa `same` và không
nằm trong `selected` thì 400, không ghi gì (FR-020). Xóa folder và các dòng khác bị xóa theo: xem "Xóa kèm" dưới.

## Xóa kèm (`cascade`, chiều ngược của `depends`; checklist 2026-11-14, CHK029)

Thêm vào `SyncRow` một trường `cascade: string[]`: id các dòng `target_only` sẽ bị xóa theo khi dòng này bị xóa. Web tick
xóa chúng kèm và không cho bỏ tick khi dòng này còn tick; hộp xác nhận liệt kê tên chúng; máy chủ từ chối `selected`
có dòng này mà thiếu một dòng trong `cascade`.

| Dòng bị xóa | Xóa kèm ở đích | Nguồn |
|---|---|---|
| collection | permission, bo_permission, preset của collection; index của collection; field và relation của nó (trong dòng) | `collections.service.ts:691-716`; 030 D-210.3 |
| policy | permission (FK `ON DELETE CASCADE`), bo_permission, link của policy | `migrations/20240806A-permissions-policies.ts:168`, `policies.service.ts:108-110` |
| role | link và preset của role; role con mất cha (không xóa, dòng role con thành `changed` ở lần so sánh sau) | `roles.service.ts:66-93` |
| folder | folder con `target_only` (bắt buộc, FK không `onDelete`); folder con có ở nguồn với cha khác (`changed`) phải được tick sửa cùng, nếu không dòng gốc bị chặn | `seeds/06-folders.yaml:13-17` |
| flow, dashboard | operation, panel (nằm trong dòng) | — |

Dòng trong `cascade` mà là `selectable: false` (ví dụ role có quyền admin) làm dòng gốc cũng `selectable: false`.

## `impact` (cho hộp xác nhận, FR-021)

| Dòng | Trường | Cách tính ở đích |
|---|---|---|
| collection `target_only` | `items` | `count(*)` của bảng |
| role `target_only` | `users` | số user có role đó (sẽ thành `suspended`, `role: null`) |
| policy `target_only` | `permissions` | số permission của policy (xóa theo FK) |
| folder `target_only` | `files` | số file trong folder (về gốc) |
| flow `source_only` hoặc `changed` | `active` | `status === 'active'` ở nguồn |

## Thứ tự áp dụng (một transaction, R4)

1. `applyDiff` với phần diff của các dòng `schema` được tick; đọc lại schema qua transaction.
2. Xóa dòng, theo chiều ngược phụ thuộc: presets → dashboards (panels trước) → flows (operations trước, sau khi đặt
   `resolve`/`reject` về null) → translations → bo_permissions → permissions → links → policies → roles (con trước) →
   folders (con trước).
3. Tạo và sửa, theo chiều phụ thuộc: folders (cha trước) → roles (cha trước) → policies → links → permissions →
   bo_permissions → settings → translations → presets → flows (flow với `operation: null` → operations với
   `resolve`/`reject` null → cập nhật `resolve`/`reject` → cập nhật `flow.operation`) → dashboards (rồi panels) →
   extensions (`enabled`).
4. Kiểm người đang thao tác còn quyền admin (R7); không thì ném lỗi.
5. Commit.
6. Sau commit (R5, R10): xóa cache hệ thống và cache permissions, reload flow nếu có ghi, reload và broadcast extension
   nếu có ghi, rồi tạo và xóa index (từng index một, lỗi báo riêng).

Lỗi ở bước 1–4: rollback toàn bộ (trên Postgres gồm cả cấu trúc), trả dòng lỗi và lý do.
