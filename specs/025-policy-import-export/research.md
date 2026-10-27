# Research: Quyền Import, Export theo policy, bỏ Share khỏi giao diện

Đọc code ngày 2026-10-28 (`apps/api`, `apps/web`, `libs`, `tests/parity`, `apps/web-e2e`, `deploy`), chưa chạy thử.
Mỗi mục: Decision, Rationale, Alternatives. Mục ghi [Inference] là suy ra từ code, có task test xác nhận.

## R1. Bảng `backoffice_permissions` và migration riêng (FR-001, FR-003, FR-005)

**Decision**: file mới `apps/api/src/database/backoffice-migrations/20261028A-create-backoffice-permissions.ts`
(`version = '20261028A'`, `name = 'Create Backoffice Permissions'`), thêm vào `BACKOFFICE_MIGRATIONS`
(`index.ts:15`). `up`: `hasTable` → `createTable` trong `try` như `20261026A` (process khác tạo trước thì bỏ qua khi
`hasTable` đã đúng):

| Cột           | Knex                              | Như `directus_permissions`                  |
|---------------|-----------------------------------|---------------------------------------------|
| `id`          | `increments('id')`                | có                                          |
| `policy`      | `uuid('policy').notNullable()`    | `uuid`, không khóa ngoại (FR-001)           |
| `collection`  | `string('collection', 64).nullable()` | có; null để dành cho action không gắn collection |
| `action`      | `string('action', 64).notNullable()` | `varchar(10)` ở Directus; 64 để action sau không đổi schema (FR-003) |
| `permissions` | `json('permissions').nullable()`  | có                                          |
| `validation`  | `json('validation').nullable()`   | có                                          |
| `presets`     | `json('presets').nullable()`      | có                                          |
| `fields`      | `text('fields').nullable()`       | có, csv                                     |
| `options`     | `json('options').nullable()`      | mới: `{ "formats": ["csv", "json"] }`       |

Index `(policy, collection, action)`, không unique (Directus cũng không unique trên `directus_permissions`; nhiều dòng
cùng bộ ba được cộng dồn như nhau). Không dòng `directus_fields`, không dòng `directus_collections`.

`backoffice_permissions` là collection hệ thống của Backoffice như `backoffice_migrations` (D-181): thêm vào
`libs/system-data/src/collections/collections.yaml` (`hidden: true`, không `note`) và `SYSTEM_DENY_LIST` của GraphQL
(`apps/api/src/services/graphql/schema/index.ts:50`); `isSystemCollection` đã nhận tiền tố `backoffice_`
(`libs/system-data/src/collections/index.ts:21`), nên `/items/backoffice_permissions` trả 403 như `backoffice_migrations`.

**SchemaOverview dùng chung**: Directus dựng SchemaOverview từ mọi bảng trong DB và ghi vào cache Redis dùng chung
(002); bảng này không có dòng `directus_fields` nên trong overview của cả hai app nó là bảng thường: không `special`
(`cast-json`, `cast-csv`), `accountability: 'all'`, `note: null` [Inference: `directus/api/src/utils/get-schema.ts`,
như ghi chú ở `collections.yaml:127-128` cho `backoffice_migrations`]. Backoffice KHÔNG thêm fields yaml cho bảng này
(overview phải giống bản Directus dựng, 002); việc ép kiểu JSON, csv làm ở service (R6).

**Rationale**: cùng dạng cột với `directus_permissions` nên drawer Use custom và engine quyền dùng lại được (bộ lọc,
field, `$CURRENT_USER`); `action` là chuỗi và `options` JSON nên action sau chỉ thêm vào registry (R2). Không khóa
ngoại: Directus không thấy ràng buộc nào tới bảng của nó (owner 2026-10-28); dòng mồ côi vô hại vì chỉ đọc theo
policy của người gọi (R3).

**Alternatives**: (a) action mới trong `directus_permissions`: Directus trả 500 ở `/permissions/me`
(`fetch-accountability-collection-access.ts:50`, spec dòng 1); (b) mỗi tính năng một cột boolean: thêm tính năng là
DDL; (c) dòng `directus_fields` cho các cột JSON để SchemaOverview có `special`: Directus sẽ đưa field có meta vào
snapshot (`get-snapshot.ts:28`, `excludeUntracked` chỉ bỏ meta null) và `schema apply` ở môi trường khác có thể xóa
field; ngoài ra khác overview của Directus dựng.

Kiểm 7 vendor: unit trên SQLite trong bộ nhớ như `20261026A-add-collection-ui-toggles.test.ts` (chạy hai lần, chạy
song song hai process giả lập); parity profile `bootstrap` dump chỉ so bảng `directus_*` (`bootstrap/dump.ts:39`) nên
bảng mới không làm lệch; deploy test `backoffice-migrations.test.ts:30` đang chờ `['20261026A']` → `['20261026A',
'20261028A']`; Helm `kind-test.sh:161` kiểm migrations: xem có liệt kê version không (task).

## R2. Registry action của Backoffice (FR-003)

**Decision**: file mới `libs/constants/src/backoffice-permissions.ts` (export thêm ở `index.ts`; `PERMISSION_ACTIONS`
ở `permissions.ts:2` không đổi):

```ts
export const BACKOFFICE_EXPORT_FORMATS = ['csv', 'csv_utf8', 'json', 'xml', 'yaml'] as const;
export const BACKOFFICE_IMPORT_FORMATS = ['csv', 'json'] as const;
export const BACKOFFICE_PERMISSION_ACTIONS = {
	import: { requires: ['create', 'update'], formats: BACKOFFICE_IMPORT_FORMATS },
	export: { requires: ['read'], formats: BACKOFFICE_EXPORT_FORMATS },
} as const;
export type BackofficePermissionsAction = keyof typeof BACKOFFICE_PERMISSION_ACTIONS;
```

Web giữ bản sao nhỏ trong `apps/web/src/interfaces/_system/system-permissions/app-permissions.ts` (như
`editablePermissionActions` là bản sao của `PERMISSION_ACTIONS`): `editablePermissionActions = ['create', 'read',
'update', 'delete', 'import', 'export']`, `backofficeActions = { import: {...}, export: {...} }` với nhãn tab và danh
sách định dạng. Mime của import ánh xạ: `csv` ↔ `text/csv`, `application/vnd.ms-excel`; `json` ↔ `application/json`
(`import-export.service.ts:253`).

**Rationale**: một chỗ ở API (kiểm, `/permissions/me`), một chỗ ở web (cột, drawer, hộp export). `apps/web/package.json`
có một tham chiếu `@backoffice/*` (kiểm khi làm): nếu `@backoffice/constants` dùng được trong Vite thì web import
thẳng và bỏ bản sao; nếu không thì bản sao như `editablePermissionActions` hiện nay.

**Alternatives**: đọc registry từ API (`/server/info`): payload lệch Directus thêm một chỗ.

## R3. Đọc và kiểm quyền import, export ở API (FR-006..FR-014)

**Decision**: thư mục mới `apps/api/src/permissions/modules/backoffice-permissions/`:

- `fetch-backoffice-permissions.ts`: `fetchBackofficePermissions({ policies, collection, action }, context)` →
  `withCache('backoffice-permissions', ...)` (`permissions/utils/with-cache.ts`, cache `permissions` dùng chung với
  Directus, xóa bởi `clearPermissionCache` ← `clearSystemCache` ở cả hai app; Directus xóa thừa vô hại): một `select`
  trên `backoffice_permissions` `whereIn('policy', policies).where({ collection, action })`; `permissions`,
  `validation`, `presets`, `options` qua `parseJSON` (Postgres trả object, SQLite/MySQL trả chuỗi), `fields` tách csv.
  Dòng của policy không còn tồn tại không bao giờ vào `policies` của người gọi (`fetchPolicies`), nên FR-012 tự thỏa.
- `fetch-backoffice-access.ts`: `fetchBackofficeAccess({ accountability, collection, action }, context)` →
  `{ allowed: boolean; filter: Filter | null; fields: string[]; formats: string[] }`: admin → `allowed`, `filter null`,
  `fields ['*']`, mọi định dạng; khác: `fetchPolicies(accountability)` → rows → biến động `$CURRENT_USER`... qua
  `processPermissions` + `fetchDynamicVariableData` như `fetchPermissions` (`permissions/lib/fetch-permissions.ts:24-42`)
  [Inference: `processPermissions` nhận mảng `Permission`; dòng của bảng mới có cùng dạng]; cộng dồn bằng
  `mergePermissions('or', ...)` của `permissions/utils/merge-permissions.ts` (cách Directus cộng quyền của nhiều
  policy: `filter` `_or`, null nếu một dòng null; `fields` hợp, `['*']` nếu một dòng `*`); `formats` = hợp của
  `options.formats`, mọi định dạng nếu một dòng không có `options.formats` (FR-011, FR-017).
- `assert-backoffice-action.ts`: `assertBackofficeAction({ accountability, collection, action, format? }, context)`:
  không `allowed`, hoặc `format` không trong `formats` → `createCollectionForbiddenError('', collection)` (cùng lỗi 024,
  FR-008). Trả `access` để chỗ gọi áp bộ lọc, field.
- `apply-export-access.ts`: `applyExportAccess(query, access)`: `query.filter = { _and: [query.filter, access.filter] }`
  (bỏ phần null); `fields`: không có hoặc chứa `*` → thay `*` bằng `access.fields` (giữ `*` khi `access.fields` là
  `['*']`); có field (kể cả `a.b`: xét phần trước dấu chấm) không nằm trong `access.fields` → ném lỗi FR-008 (clarify
  câu 2; field quan hệ `a.b` xét theo `a`, CHK024). Giao với quyền `read` đã cộng dồn của người gọi do engine làm khi
  đọc (`getAstFromQuery` → `processAst`; không ghép theo từng policy, CHK023), nên AND bộ lọc và giao field
  với `read` không phải viết thêm (FR-015).

Điểm gọi (sau `assertToggle`/`assertCollectionToggles` của 024, FR-009):

| Điểm | Việc |
|------|------|
| `middleware/collection-toggles-guard.ts` (trước `checkCacheMiddleware`, `app-pipeline.ts:169`) | khi `req.sanitizedQuery.export` và collection của route trong `req.schema.collections` (`/items/<c>`, `/<x>` → `directus_<x>`, như 024): `assertBackofficeAction(..., 'export', format)` rồi `applyExportAccess(req.sanitizedQuery, access)` (controller đọc `req.sanitizedQuery` nên bộ lọc và field có hiệu lực ở `readByQuery` và ở `respond.ts:78`) |
| `controllers/utils.controller.ts:177` (export) | `assertBackofficeAction(..., 'export', req.body.format)` rồi `applyExportAccess(sanitizedQuery, access)` trước `exportToFile` |
| `controllers/utils.controller.ts:127` (import) | collection người dùng: `assertBackofficeAction(..., 'import', <định dạng từ mime của file>)`: định dạng chỉ biết khi busboy có file → kiểm `allowed` trước busboy (403 trước khi đọc file, FR-007), kiểm định dạng và truyền `rowGuard` khi có file (dưới); collection hệ thống: không kiểm (`ImportService.import:225` đã từ chối người không phải admin như Directus; admin luôn được), nên request giống Directus (analyze I1) |
| `middleware/validate-batch.ts` (`SEARCH` ở mọi route) | `validateBatch('read')` gán body query vào `req.sanitizedQuery` sau guard, cho `SEARCH` của items và 21 controller hệ thống (`users`, `files`, `dashboards`, `roles`, `policies`, `activity`...; `grep @Search apps/api/src/controllers`), nên `respond.ts:78` xuất file theo `export` của body: ngay sau khi gán, nếu method là `SEARCH` và có `export`: `assertBackofficeAction({ collection: req.collection, action: 'export', format })` rồi `applyExportAccess(req.sanitizedQuery, access)`; toggle 024 vẫn kiểm trong `items.controller.ts search()` như cũ, chạy sau `validateBatch` nhưng trước `readHandler` (analyze C1, checklist CHK015) |

Import Use custom (FR-016): `ImportService.import(collection, mimetype, stream, options)` nhận thêm
`options.rowGuard?: (row: Record<string, unknown>) => void` (mặc định không có: flow, extension, service nội bộ không
đổi, FR-014); `importJSON`/`importCSV` gọi `rowGuard(task.data)` ngay trước `upsertOne` trong `saveQueue`
(`import-export.service.ts:356-370`, bản CSV tương ứng); lỗi ném ra vào `errorTracker` → `reject` → transaction hủy, cả
file bị từ chối (clarify câu 1). `rowGuard` của controller: cột ngoài `access.fields` (khi không `*`) → lỗi FR-008; bộ
lọc dòng → `validatePayload(access.filter, row)` của `@backoffice/utils` (cách Directus áp bộ lọc `permissions` của
`create` lên payload, `process-payload.ts:119`) ném `FailedValidationError` → đổi thành lỗi FR-008. Sửa file port có
comment `// Backoffice (spec 025)`; câu chữ FR-014 sửa: "ImportService nhận hook tùy chọn, mặc định không có" (R14).

**Rationale**: cùng cơ chế với quyền Directus (policy → dòng → biến động → cộng dồn), cùng cache và cùng lỗi với 024;
bộ lọc, field vào query nên engine đọc hiện có làm phần giao với `read`; không sửa `ExportService`.

**Alternatives**: (a) kiểm trong `ExportService.exportToFile`: flow/extension gọi service sẽ bị chặn (FR-014); (b)
parse lại file ở controller để kiểm từng dòng: trùng parser CSV/JSON của service; (c) cache riêng trong
`localSchemaCache` như 024: 024 là cấu hình theo collection (không theo người gọi), quyền theo policy hợp với cache
`permissions` có sẵn `withCache`.

## R4. Thứ tự với toggle 024 và lỗi (FR-008, FR-009)

**Decision**: giữ nguyên 024 chạy trước (toggle tắt → `assertToggle` ném lỗi cho mọi người, kể cả admin); chỉ khi qua
mới gọi R3. Cùng `createCollectionForbiddenError`, nên người gọi không phân biệt được ba lý do (không quyền đọc, toggle
tắt, không quyền import/export). Collection hệ thống: 024 không có toggle (FR-010 của 024) nên chỉ R3 áp.

## R5. `/permissions/me` và GraphQL `permissions_me` (FR-018, FR-019, D-189)

**Decision**: `fetch-accountability-collection-access.ts` của Backoffice (file port, comment `// Backoffice (spec
025, D-189)`): admin → thêm `import`, `export`: `{ access: 'full', fields: ['*'], formats: <mọi định dạng> }` cho mọi
collection; khác: sau vòng `directus_permissions`, một `select` `backoffice_permissions` `whereIn('policy', policies)`
(không lọc collection, action; qua `withCache` của R3 với `collection`, `action` undefined) → với mỗi collection đã có
trong `infos` (có ít nhất một dòng `directus_permissions`): `import`, `export` mặc định `{ access: 'none' }`, dòng có bộ
lọc → `partial`, không → `full`; `fields` hợp như action khác; `formats` hợp (thiếu = mọi định dạng). Collection chỉ có
dòng ở bảng mới không xuất hiện (như Directus: export cần read, import cần create, update), nên parity D-189 chỉ lệch ở
khóa `/<c>/import`, `/<c>/export` (analyze U1). `libs/types/src/permissions.ts` `CollectionPermissions`: thêm `import?`, `export?`
(tùy chọn, có `formats?: string[]`); `PERMISSION_ACTIONS` không đổi.

GraphQL `permissions_me` (`services/graphql/resolvers/system.ts:338`) gọi cùng hàm → cùng JSON; scalar
`permissions_me_type` không đổi nên introspection, SDL không đổi (clarify specify Q1).

Response cache: không đổi (D-189.2, owner 2026-10-28). Ghi quyền qua service của R6 kế thừa `ItemsService` nên khi
`CACHE_AUTO_PURGE=true` cache dữ liệu bị xóa như ghi `directus_permissions` (`utils/should-clear-cache.ts`).

**Rationale**: web đã đọc `/permissions/me` (`stores/permissions.ts:39`); thêm khóa không đổi dạng các action có sẵn;
IP access và `$CURRENT_USER` đi cùng đường `fetchPolicies`.

**Alternatives**: endpoint riêng cho quyền import, export: web thêm một request mỗi lần khởi động; owner chọn
`/permissions/me`.

## R6. Service và endpoint ghi quyền (FR-020, FR-021, D-189.6)

**Decision**: `apps/api/src/services/backoffice-permissions.service.ts`:
`BackofficePermissionsService extends ItemsService` (`super('backoffice_permissions', ...)`), như `PermissionsService`:

- Schema cục bộ: constructor truyền `schema` đã vá `special` cho collection này (`permissions`, `validation`, `presets`,
  `options` → `cast-json`; `fields` → `cast-csv`) bằng một bản sao nông của `schema.collections.backoffice_permissions`
  (không đụng cache dùng chung, R1), để `PayloadService` ép kiểu như `directus_permissions`.
- Quyền (FR-020): người gọi không phải admin thì mỗi phương thức gọi `validateAccess({ collection:
  'directus_permissions', action })` trước; `ItemsService` bên trong chạy với bản sao `accountability` có `admin: true`
  (engine không có dòng quyền nào trên `backoffice_permissions`), activity và revisions vẫn ghi `user`, `ip`, `origin`
  của người gọi [Inference: `ItemsService.createOne` đọc `this.accountability.user`; unit test xác nhận]. Trên thực tế
  chỉ admin vào Settings, nhưng luật giữ như `directus_permissions` (owner). Giới hạn: kiểm ở mức collection, không áp
  bộ lọc theo item của quyền trên `directus_permissions` (spec Assumptions, analyze U2).
- `clearCaches` như `PermissionsService` (`clearSystemCache` + `cache.clear()` khi auto purge) sau mỗi ghi.
- `readByQuery` không thêm `withAppMinimalPermissions` (không có quyền tối thiểu cho bảng mới).

Endpoint: `apps/api/src/controllers/backoffice-permissions.controller.ts`, `@Controller('backoffice/permissions')`
(tiền tố `/backoffice/` cho mọi endpoint riêng của Backoffice về sau; D-189.6, chủ dự án duyệt path), các route như
`permissions.controller.ts`: `POST /` (một hoặc nhiều), `GET /` (query: `filter`, `fields`, `limit`, `sort`...),
`GET /:pk`, `PATCH /` (batch mảng hoặc `{ keys, data }`), `PATCH /:pk`, `DELETE /` (mảng khóa), `DELETE /:pk`; đăng ký
ở `app.module.ts` `controllers` và `useCollection('backoffice_permissions')` ở `configure`. `GET /:pk` cũng cần cho drawer
(`PermissionsDetail.vue` đọc `/permissions/:id`). Không `?export=`, không GraphQL cho bảng này (`SYSTEM_DENY_LIST`).

Xóa theo (FR-021): `PoliciesService.deleteMany` (`policies.service.ts:98`) gọi thêm
`knex('backoffice_permissions').whereIn('policy', keys).delete()` trước `super.deleteMany` trong cùng transaction nếu
có (`ItemsService.deleteMany` dùng `this.knex`); `CollectionsService.deleteOne` (`collections.service.ts:711`) thêm
`trx('backoffice_permissions').delete().where('collection', collectionKey)`. Bảng chắc chắn có vì `start` dừng khi
thiếu migration riêng (`database/validate-migrations.ts`).

**Rationale**: `ItemsService` cho activity, revisions, auto purge, `cast-json` qua `PayloadService` không viết lại;
tiền tố `/backoffice/` để lb, Ingress và client phân biệt endpoint riêng (R12).

**Alternatives**: (a) `/permissions` nhận action `import`, `export` rồi tự lưu sang bảng mới: Directus app ở cấu hình
proxy-api đọc phải dòng action lạ qua `/permissions?filter[policy]` [Inference: ma trận Directus có thể lỗi]; (b)
service Knex thuần + `ActivityService`/`RevisionsService` tự ghi: nhiều code hơn, trùng `ItemsService`.

## R7. Web: ma trận hai nguồn (FR-022..FR-027)

**Decision**:

- `app-permissions.ts:12`: `editablePermissionActions` 6 phần tử, không `share`; `backofficeActions` (R2);
  `isBackofficeAction(action)`.
- `SystemPermissions.vue`: `usePermissions` thêm nguồn thứ hai: `fetchedBoItems` từ
  `GET /backoffice/permissions?filter[policy][_eq]=<id>&limit=-1&fields=*` (bỏ qua khi `primaryKey === '+'`), staging
  `boAlterations: { create: [], update: [], delete: [] }` cùng dạng `Alterations<Permission>`; `displayItems` gộp hai
  nguồn (dòng bảng mới có `action` `import`/`export` nên không trùng khóa); `getPermission`, `editItem`, `stageEdits`,
  `setFullAccess`, `setNoAccess`, `removeCollection` rẽ theo `isBackofficeAction` sang `create/update/remove` của
  nguồn hai; `setFullAccessAll`/`setNoAccessAll` lặp 6 action (FR-024; dòng `share` cũ không trong danh sách nên không
  bị đụng, FR-023). `disabledActions` giữ nguyên (`directus_extensions`: create, delete) và thêm `import` cho mọi
  collection hệ thống (`isSystemCollection` của web; FR-022, analyze I1).
- Lưu: `PolicyItemRoute.vue` `provide('bo-permissions-staging', staging)` (một `ref` alterations + `hasEdits`);
  interface `inject` và ghi vào đó; sau `save()` của `use-item` ở `saveAndStay`, `saveAndAddNew`, `saveAndQuit`: `POST`
  (create với `policy: primaryKey`), `PATCH` batch (update), `DELETE` (delete) tới `/backoffice/permissions`, rồi xóa
  staging; `hasEdits` của trang = `hasEdits || staging.hasEdits` cho nút Save và `useEditsGuard`. Policy mới (`NewPolicy`
  → `use-save.ts`) không đổi: ma trận sửa ở trang item. Lỗi lưu nguồn hai → `showUnexpectedError`, staging giữ lại.
- `PermissionsDetail.vue` (drawer): `load` đọc `/backoffice/permissions/:id` khi `isBackofficeAction` (hoặc dòng staging
  `+`); `tabsValue`: `permissions` (bộ lọc dòng; nhãn `item_permissions`), `fields` (nhãn `field_permissions`),
  `formats` (tab mới `FormatsTab.vue`: nhóm checkbox các định dạng của action, không chọn = tất cả, FR-017; nhãn mới
  `bo_formats` trong overlay en-US/vi-VN); không `validation`, `presets`; tiêu đề `… -> <collection> -> Import/Export`
  (`t('import')`, `t('export')` có sẵn).
- Ô mờ khi toggle 024 tắt (FR-025): `PermissionsRow.vue` nhận `collection` meta từ `collectionsStore`
  (`bo_show_import`, `bo_show_export`); `PermissionsToggle.vue` prop `mutedHint?: string` → `opacity-50` + `title`/tooltip
  với chuỗi overlay `bo_toggle_off_hint` ("Đã tắt trong Data Model"); vẫn bấm, sửa, lưu được. Ô có bộ lọc/field/định
  dạng → biểu tượng "partial" như action khác (hasValue đã có).
- `use-duplicate.ts:32`: đọc thêm `GET /backoffice/permissions?filter[policy][_eq]=<id>&limit=-1` và `POST` lại với
  `policy` mới (FR-027).
- Ma trận khi API là Directus (FR-034): `permissionsStore` thêm `hasBackofficeActions` = một collection trong
  `/permissions/me` có khóa `import`; `SystemPermissions.vue` lấy cột từ `editablePermissionActions` lọc bỏ
  `import`/`export` khi `!hasBackofficeActions` (admin ở Backoffice luôn có khóa, R5).

**Rationale**: giữ o2m `permissions` của policy nguyên (Directus app vẫn đọc được), nguồn hai lưu riêng qua endpoint
riêng; staging cùng dạng `Alterations` nên `useActions`/`useUtil` hiện có dùng lại được.

**Alternatives**: gửi dòng mới qua o2m `permissions` rồi API tách: API phải sửa `PermissionsService` và payload o2m
lệch Directus.

## R8. Web: import, export ở các module (FR-028, FR-034)

**Decision**: `use-collection-permissions.ts` thêm `importAllowed`, `exportAllowed`, `exportFormats`:
`permissionsStore.hasBackofficeActions` → `hasPermission(collection, 'import' | 'export')` và
`getPermission(collection, 'export')?.formats`; không (API là Directus, FR-034) → `exportAllowed = readAllowed`,
`importAllowed = createAllowed && updateAllowed`, mọi định dạng; collection hệ thống: `importAllowed` chỉ true với
admin ở cả hai chế độ (`ImportService` như Directus; analyze I1). `ExportSidebarDetail.vue`: phần import `v-if="importAllowed
&& showImport"` (`:532`, thay `createAllowed`), phần export (gồm "Download Page as CSV", clarify câu 5) `v-if="exportAllowed
&& showExport"`; `format` select lọc theo `exportFormats` (`:627-634`), `format` mặc định là định dạng đầu được phép.
Chỗ dùng (`CollectionRoute.vue:568`, `UsersCollectionRoute.vue:344`, `FilesCollectionRoute.vue:610`,
`PresetsCollectionRoute.vue:221`, `TranslationsCollectionRoute.vue:218`) không đổi prop; `InsightsOverviewRoute.vue`
`:268-271` nút export theo `exportAllowed('directus_dashboards')` (thay `createAllowed`), `:294` `BasicImportSidebarDetail`
theo `importAllowed`. `BasicImportSidebarDetail.vue:120` dùng `importAllowed`.

**Rationale**: một composable, mọi module theo; store biết API có hỗ trợ hay không (FR-034).

## R9. Web: bỏ share (FR-029, D-189.4)

**Decision**: xóa `SharesSidebarDetail.vue` (+ test) và chỗ dùng ở `ItemRoute.vue:819-824`; xóa route `shared`
(`router/index.ts:91-93`) và component của nó (`routes/Shared*.vue`, kiểm tên khi làm); `router/guard.ts` giữ (phiên
share qua API vẫn hợp lệ, D-189.4 chỉ bỏ giao diện); `use-item-permissions.ts` giữ `shareAllowed` (không còn ai dùng:
xóa luôn nếu lint báo); drawer `PermissionsDetail.vue:71` bỏ `'share'` khỏi danh sách tab vì không còn mở được. E2E:
xóa `content-share.spec.ts`, bỏ phần share của `payload/comments-shares.spec.ts` (giữ comment); `helpers/allowed-paths.ts`
bỏ `/shares` nếu chỉ còn dùng ở đó. Fixture `bo-share` (`apps/web/fixtures/interfaces/lib.mjs`) giữ cho API test.

## R10. Lb, Ingress (FR-031, D-189.7)

**Decision**: `deploy/compose/lb/shared-domain.conf` thêm trước `location /`:

```nginx
# Spec 025 (D-189.7): /permissions/me carries import/export and /backoffice/* exists at Backoffice only.
location = /permissions/me { error_page 502 504 = @retry_bo; proxy_pass http://bo_pool; }
location ^~ /backoffice/ { error_page 502 504 = @retry_bo; proxy_pass http://bo_pool; }
```

`standalone.conf`, `separate-domain.conf`: không đổi (pool không có Directus). Helm `ingress.yaml:32`: thêm path
`/permissions/me` (pathType `Exact`) và `/backoffice` (`Prefix`) tới Service `-api-only` như `/extensions/sources`
(các path này đứng trước `/`). Deploy test `tests/parity/src/deploy/`: file mới `backoffice-permissions.test.ts` như
`extensions.test.ts:95-106` (D-137): 8 lần `GET /permissions/me` và `GET /backoffice/permissions` qua lb, `lbLog` không
có dòng nào tới IP của `directus`; `skipIf(SEPARATE)`.

## R11. Parity (FR-033, Nguyên tắc V)

**Decision**:

- `tests/parity/accepted-differences.ts`: D-189 `http` (`endpoints: ['GET /permissions/me', 'POST /graphql/system']`,
  `location: { jsonPointer: /^\/data\/(permissions_me\/)?[^/]+\/(import|export)$/ }` (chỉ khóa của
  `/permissions/me` và `permissions_me`, CHK007), `directus: { absent: true }`; `AcceptedDifference.location` nhận
  `jsonPointer` regex, `accepted-differences.ts:19`); D-189.1 `http` cho `parity_bo_perm_*`
  (`GET /items/parity_bo_perm_*`, `POST /utils/export/parity_bo_perm_*`, `POST /utils/import/parity_bo_perm_*`,
  `when.backofficeCode: 'FORBIDDEN'`); D-189.2..D-189.7 `doc`.
- `tests/parity/src/normalizers.ts:122` và `parity.ts:206`: lọc theo tiền tố `backoffice_` (regex `/backoffice_/`) thay
  tên `backoffice_migrations`.
- File mới `tests/parity/src/permissions/backoffice-permissions.test.ts` (chạy một mình như `collection-toggles`,
  thêm vào `suite.ts`): collection per-run `parity_bo_perm_<run>`; policy, user qua `permissions/fixtures.ts`
  (`createPolicy`, `attachPolicy`, `createUser`); dòng quyền tạo qua `POST /backoffice/permissions` ở Backoffice; case:
  không quyền → export/import Directus 200, Backoffice 403 (D-189.1); có quyền → `assertParity` của export CSV/JSON,
  import; Use custom (bộ lọc, field, định dạng) chỉ ở Backoffice (per app); `/permissions/me` D-189; `permissions_me`
  GraphQL; nhiều policy; public (policy Public); share (`auth/shares.test.ts` cách đăng nhập); admin; xóa policy,
  collection ở Backoffice xóa dòng; xóa ở Directus để lại dòng, Backoffice vẫn chạy; Directus `schema snapshot`,
  `apply`, `migrate` trên DB có bảng (US6, profile `bootstrap` hoặc case trong file).
- `permissions/matrix*.ts` không đổi (5 action của Directus).
- Blackbox: không đổi.

## R12. E2E (FR-033)

**Decision**: sửa E2E hiện có export, import bằng người không phải admin (Kết quả T002) thuộc lượt 1, vì lượt 1 làm
chúng đỏ ở `proxy-api`, `cors` (analyze O1, như T027 của 024); đường `/backoffice/permissions` vào
`e2e/helpers/allowed-paths.ts` và rà `e2e/payload/settings*.spec.ts` cùng task ma trận (analyze G3).
`settings-roles-policies.spec.ts:146` (ma trận): thêm bước 6 cột, không cột Share, bật export cho
`bo_std`, Use custom định dạng `csv`, lưu, tải lại; `:188` nhân bản có dòng mới; spec mới `settings-permissions-bo.spec.ts`
hoặc thêm vào `content-permissions.spec.ts`: user `bo-editor` (fixture) không có export → không phần export ở Content;
admin cấp → có; Users, Files, Insights; ba cấu hình: ở proxy-directus kiểm FR-034 (ma trận 4 cột, export theo read).
Share: R9.

## R13. Lượt làm (tasks)

Ba lượt như prompt tasks: (1) API: migration, registry, service + endpoint, R3 kiểm, `/permissions/me`, xóa theo,
unit, parity, deploy test migrations, sửa E2E hiện có export/import bằng người không phải admin (analyze O1); (2) Web: ma trận, drawer, lưu, nhân bản, module, bỏ share, E2E; (3) deploy (lb,
Ingress, deploy test) và tài liệu. Lượt 2 chạy được trên API của lượt 1 ở mọi cấu hình E2E (proxy-directus theo
FR-034).

## R14. Sửa câu chữ spec khi plan

- FR-005: thêm "trong SchemaOverview dùng chung, bảng là bảng thường như Directus dựng (không `special`); service ép kiểu
  JSON, csv" (R1).
- FR-014: "ImportService nhận hook tùy chọn `rowGuard`, mặc định không có, nên flow, extension, service nội bộ không đổi"
  (R3).
- FR-020: "service kiểm quyền trên `directus_permissions` rồi ghi bảng mới với bản sao accountability admin; activity ghi
  người gọi" (R6); path `/backoffice/permissions` ở D-189.6, D-189.7.
- Bảng Đánh giá: dòng 20 (`apps/web` không import `@backoffice/*`) cho R2.

## R15. Sửa khi `/speckit.analyze` (2026-10-28)

| Mã | Sửa                                                                                                           | Ở đâu                                    |
| -- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| C1 | `SEARCH` có `export` trong body query: kiểm ở `validate-batch.ts` (mọi route `SEARCH`, mở rộng ở checklist CHK015) | R3, spec FR-006, tasks |
| I1 | Import vào collection hệ thống: chỉ admin như Directus, không kiểm `import`; ô import hệ thống khóa; web chỉ admin | R3, R7, R8, spec FR-007/009/022/028/034 |
| O1 | Sửa E2E hiện có chuyển lên lượt 1                                                                              | R12, R13, tasks                          |
| U1 | `/permissions/me` không liệt kê collection chỉ có dòng ở bảng mới                                              | R5, spec FR-018                          |
| U2 | Quyền sửa bảng mới ở mức collection                                                                           | R6, spec Assumptions                     |
| G1 | Unit với action giả (SC-006)                                                                                   | tasks, contracts/tests.md                |
| G2 | Profile `bootstrap` + job deploy cho SC-003                                                                    | tasks, spec FR-033                       |
| G3 | Allowed path và payload settings cùng task ma trận                                                             | R12, tasks                               |
| G4 | Deploy test nhiều replica (FR-013)                                                                             | tasks, spec FR-033, contracts/tests.md   |
| T1 | Tài liệu ở `deploy/README.md`                                                                                  | spec FR-032                              |

## R16. Sửa khi `/speckit.checklist` api-compat (2026-10-28)

| Mục    | Sửa                                                                                                        | Ở đâu                                    |
| ------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| CHK002 | D-189.1: export có Use custom trả 200 với nội dung khác Directus                                            | spec                                     |
| CHK003 | D-189.1, Edge Cases: Directus app ở cấu hình proxy tới API mới nhận 403 cho tới khi được cấp               | spec                                     |
| CHK007 | `jsonPointer` của D-189 chỉ khớp khóa của `/permissions/me` và `permissions_me`                            | R11, contracts/tests.md, tasks           |
| CHK008 | Edge Case: dòng activity, revisions của `backoffice_permissions` trong Directus                            | spec                                     |
| CHK015 | Kiểm export của `SEARCH` ở `validate-batch.ts` cho mọi route, không chỉ `/items`                            | R3, spec FR-006, contracts, tasks        |
| CHK023 | AND với quyền read đã cộng dồn, không ghép theo từng policy                                                | R3, spec FR-015                          |
| CHK024 | Field quan hệ `a.b` xét theo `a`                                                                           | R3, spec FR-015                          |
| CHK030 | Cách kiểm 7 vendor                                                                                         | spec FR-033, contracts/tests.md, tasks   |
| CHK031 | Kiểu cột do Knex chọn, độ dài tên index                                                                    | spec Assumptions                         |
| CHK032 | Migration hỏng giữa chừng sửa tay, ghi ở `deploy/README.md`                                                 | spec Assumptions, tasks                  |
| CHK034 | FR-035: request khác giống Directus                                                                         | spec                                     |
| CHK035 | SC-002 tính bước cấp quyền thêm vào setup                                                                  | spec                                     |
