# Contract: API mà module Settings gọi (FR-018, FR-029, FR-043, FR-054, FR-060, FR-077, FR-087, FR-110, SC-005)

Bổ sung vào danh sách đóng của 012 (#1–#32), 013 (#33–#49), 014 (#50–#96), 015 (#97–#136).
`apps/web-e2e/src/helpers/allowed-paths.ts` và `KNOWN_REQUESTS` của `test-utils/fetch.ts` thêm các dòng dưới. Đã có
(dùng lại, không lặp): #50 danh sách, #51 đếm (`directus_presets`, `directus_translations`), #54–#56 presets, #68
server info, #70–#78 ghi item/preset (`PATCH /presets` batch), #91–#92 utils export/import, #103 `GET /roles` (query khác
ở #140), #105, #135 `GET /roles/<id>`, #136 `GET /access` (query khác ở #146).

## Đọc

| # | Method | Path | Ai gọi | Query | Ghi chú |
|---|--------|------|--------|-------|---------|
| 137 | GET | `/collections` | store collections (`hydrate` ở guard, sau mỗi ghi) | | 012 #21; thêm người gọi |
| 138 | GET | `/collections/<c>` | `FieldsRoute` (`useItem`) | | |
| 139 | GET | `/fields` | store fields (`hydrate` ở guard, `FieldsManagement`, sau `save()` của drawer) | | `skipTranslation` chỉ là cờ client |
| 140 | GET | `/fields/<c>/<f>` | store `fieldDetail.startEditing` (giá trị thô) | | |
| 141 | GET | `/relations` | store relations (sau xóa collection, sau tạo relation) | | |
| 142 | GET | `/schema/snapshot` | `SnapshotSidebarDetail` | | `apiFetch` → `snapshot.json` |
| 143 | GET | `/roles` | `RolesCollectionRoute` (fetchAll) | `limit=-1` `fields=id,name,description,icon,users,children.name,children.id` `deep[users]={"_aggregate":{"count":"id"},"_groupBy":["role"],"_sort":"role","_limit":-1}` `sort=name` | |
| 144 | GET | `/roles/<id>` | `RoleItemRoute` (`useItem`); `system-scope` (`fields=id,name`) | `deep[users][_limit]=0` | |
| 145 | GET | `/policies` | `PoliciesCollectionRoute` (fetchAll) | `limit=-1` `fields=id,name,icon,description,enforce_tfa,ip_access,app_access,admin_access,users,roles` `deep[users]=…count:"user"…` `deep[roles]=…count:"role"…` `sort=name` | |
| 146 | GET | `/policies/<id>` | `PolicyItemRoute` (`useItem`); `PermissionsDetail` (`deep[users][_limit]=0`) | | |
| 147 | GET | `/permissions` | `SystemPermissions` (`fields=*` `filter={"_and":[{"policy":"<id>"}]}` `page=0` `limit=-1`); `use-duplicate` (`filter={"policy":{"_eq":"<id>"}}` `limit=-1` `fields=collection,action,permissions,validation,presets,fields,policy`) | | |
| 148 | GET | `/permissions/<id>` | `PermissionsDetail` | | |
| 149 | GET | `/access` | `RolePublicRoute` | `filter={"_and":[{"role":{"_null":true}},{"user":{"_null":true}}]}` `fields=id` `limit=-1` | #136 đã có path; thêm query |
| 150 | GET | `/settings` | store settings (`hydrate` sau `setOwner`) | | 012 #20; thêm người gọi |
| 151 | GET | `/presets` | `PresetsInfoSidebarDetail` | `filter[bookmark][_nnull]=true` `fields=id` `meta=filter_count,total_count` | danh sách là #50 với `collection=directus_presets` |
| 152 | GET | `/presets/<id>` | `PresetItemRoute` | | |
| 153 | GET | `/translations` | danh sách (#50 với `collection=directus_translations`); store translations `refreshCurrentLanguage` (`filter[language][_eq]`, `limit=-1`) | | |
| 154 | GET | `/translations/<id>` | `TranslationItemRoute` (`useItem`) | | |
| 155 | GET | `/users/<id>` | `system-scope` | `fields=id,first_name,last_name,email` | #60/#102 đã có path; thêm query |
| 156 | GET | `/folders` | `system-folder` (`useFolders`) | `sort=name` | #97 đã có |

## Ghi

| # | Method | Path | Ai gọi | Body | Ghi chú |
|---|--------|------|--------|------|---------|
| 157 | POST | `/collections` | `NewCollection` (`{collection, schema:{}, fields:[…], meta:{…}}`), `CollectionDialog` tạo folder (`{collection, meta}`), store `fieldDetail.save()` bước 2 (`collections.junction|related`) | | |
| 158 | PATCH | `/collections` | kéo thả cây (`onSort`) | `[{collection, meta:{sort, group}}]` | không chờ (Clarifications) |
| 159 | PATCH | `/collections/<c>` | guard `settings-fields` (`{meta:{}}`), `CollectionOptions` (`{meta:{hidden}}`, `{meta:{collapse}}`), `CollectionDialog` sửa (`{meta}`), `FieldsRoute` lưu (`{meta:{…}}`), `save()` bước 2 khi collection đã có | | |
| 160 | DELETE | `/collections/<c>` | hộp xóa collection/folder, `FieldsRoute` xóa, bảng không meta | | |
| 161 | POST | `/fields/<c>` | `save()` bước 1 (mới) và bước 3 (`fields.*`), nhân bản field | field | |
| 162 | PATCH | `/fields/<c>` | kéo thả lưới field | `[{field, meta:{sort, group}}]` | lạc quan, hoàn tác |
| 163 | PATCH | `/fields/<c>/<f>` | menu field (`{meta:{hidden}}`, `{meta:{width}}`), mở field không meta (`{meta:{special}}`), `save()` bước 1 (sửa) và bước 3 | | |
| 164 | DELETE | `/fields/<c>/<f>` | xóa field, phụ thuộc khi xóa collection | | |
| 165 | POST | `/relations` | `NewCollection` (`user_*`), `save()` bước 4 | relation | |
| 166 | PATCH | `/relations/<c>/<f>` | `save()` bước 4 khi relation đã có | | |
| 167 | POST | `/items/<c>` hoặc `/<hệ thống>` | `save()` bước 5 (seed ngôn ngữ) | mảng dòng | `getEndpoint(collection)` |
| 168 | POST | `/utils/translations/generate` | `system-collections-translations` | `{collection, translationsCollection, fields}` hoặc `{collection, fields, translationsCollection, languagesCollection, parentFkField, languageFkField, createLanguagesCollection, seedLanguages}` | |
| 169 | POST / PATCH / DELETE | `/roles`, `/roles/<id>` | `NewRole` (`{name}`), `RoleItemRoute` (`PATCH` edits lồng), xóa | | |
| 170 | POST / PATCH / DELETE | `/policies`, `/policies/<id>` | `NewPolicy` (`{name, admin_access, app_access}`), `use-duplicate` (7 khóa), `PolicyItemRoute` (`PATCH` edits lồng gồm `permissions`), xóa | | |
| 171 | POST | `/permissions` | `NewPolicy` (mảng minimal + `policy`), `use-duplicate` (mảng chép + `policy`) | mảng | ma trận không gọi |
| 172 | POST / PATCH / DELETE | `/access` | `RolePublicRoute` (song song; `DELETE` body mảng id) | | |
| 173 | PATCH | `/settings` | `ProjectRoute`, `AppearanceRoute` (store `updateSettings`) | chỉ khóa đổi | |
| 174 | POST | `/settings/owner` | `system-owner` (store `setOwner`) | `{project_owner, project_usage, org_name, product_updates}` | API không báo cáo (D-38) |
| 175 | POST / PATCH / DELETE | `/presets`, `/presets/<id>` | `PresetItemRoute` (`POST`/`PATCH` chỉ khóa đổi + scope), xóa (`DELETE /presets` body `[id]`), danh sách (`DELETE /presets` mảng, `PATCH /presets` batch #72) | | |
| 176 | POST / PATCH / DELETE | `/translations`, `/translations/<id>` | `TranslationItemRoute`, danh sách (`DELETE` mảng, `PATCH` batch) | | |
| 177 | POST | `/users/invite` | `RoleItemRoute` (`UsersInvite` với `role`) | `{email[], role}` | 015 đã có; thêm người gọi |

Không có request nào khác trong E2E (SC-009); `preRegisterCheck` không gọi API. Mọi request ghi lồng (`PATCH /roles|
policies`) kiểm ở T002 (research R6).
