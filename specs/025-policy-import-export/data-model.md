# Data Model: Quyền Import, Export theo policy, bỏ Share khỏi giao diện

Một bảng hệ thống mới của Backoffice, tạo bằng migration riêng (Nguyên tắc II 3.2.0). Không cột, dòng, migration
`directus_*` mới.

## `backoffice_permissions` (mới, migration `20261028A`)

| Cột           | Kiểu (Knex)        | Null | Ý nghĩa                                                                                 |
|---------------|--------------------|------|-----------------------------------------------------------------------------------------|
| `id`          | `increments`       | no   | khóa chính                                                                              |
| `policy`      | `uuid`             | no   | `directus_policies.id`; KHÔNG khóa ngoại (dòng mồ côi bỏ qua khi đọc, FR-012)           |
| `collection`  | `string(64)`       | yes  | collection; `null` để dành cho action không gắn collection (chưa dùng)                  |
| `action`      | `string(64)`       | no   | `import`, `export`; action sau chỉ thêm vào registry (FR-003)                          |
| `permissions` | `json`             | yes  | bộ lọc dòng (`Filter`, biến động `$CURRENT_USER`... như `directus_permissions`); null = mọi dòng |
| `validation`  | `json`             | yes  | chưa dùng ở bản đầu (Assumptions)                                                       |
| `presets`     | `json`             | yes  | chưa dùng ở bản đầu                                                                      |
| `fields`      | `text` (csv)       | yes  | field được phép; null hoặc `*` = mọi field                                              |
| `options`     | `json`             | yes  | cấu hình riêng của action; bản đầu `{ "formats": string[] }`, thiếu = mọi định dạng (FR-017) |

Index: `(policy, collection, action)`, không unique (như `directus_permissions`). Ví dụ:

```json
{ "policy": "0b9c…", "collection": "articles", "action": "export",
  "permissions": { "status": { "_eq": "published" } }, "fields": "id,title", "options": { "formats": ["csv"] } }
```

Trong SchemaOverview dùng chung: bảng thường như Directus dựng (không `special`, `accountability: 'all'`, `note`
null); `BackofficePermissionsService` vá `special` (`cast-json`, `cast-csv`) trên bản sao cục bộ (research R1, R6).
Backoffice: collection hệ thống ẩn (`collections.yaml`, `SYSTEM_DENY_LIST`), 403 ở `/items`, không có trong GraphQL
(D-189.5). Directus: bảng chưa quản lý.

Vòng đời: tạo, sửa, xóa qua `/backoffice/permissions` (activity, revisions như `directus_permissions`); xóa theo khi
xóa policy hay collection qua Backoffice (FR-021); xóa qua Directus để lại dòng mồ côi.

## Registry action (code, `libs/constants/src/backoffice-permissions.ts`)

| Action   | `requires` (quyền Directus cần có) | `formats` hợp lệ                            | Use custom                     |
|----------|------------------------------------|---------------------------------------------|--------------------------------|
| `import` | `create`, `update`                 | `csv`, `json`                               | `permissions`, `fields`, `options.formats` |
| `export` | `read`                             | `csv`, `csv_utf8`, `json`, `xml`, `yaml`    | `permissions`, `fields`, `options.formats` |

Thêm action = thêm một khóa ở đây (và bản sao ở web, research R2), một điểm kiểm ở API, một tab/cột ở web; không DDL.

## Quyền đã cộng dồn (khái niệm, không lưu)

`fetchBackofficeAccess({ accountability, collection, action })` (research R3):

```ts
type BackofficeAccess = {
	allowed: boolean;         // admin: true; khác: có ít nhất một dòng của policy của người gọi
	filter: Filter | null;    // _or các bộ lọc (null nếu một dòng null); AND với read khi export; kiểm từng dòng khi import
	fields: string[];         // hợp; ['*'] nếu một dòng *
	formats: string[];        // hợp options.formats; mọi định dạng nếu một dòng không có
};
```

Cache: `withCache('backoffice-permissions', ...)` trong cache `permissions` dùng chung (xóa bởi `clearSystemCache` ở
cả hai app); biến động xử lý mỗi request như `fetchPermissions`.

## `/permissions/me` (thay đổi dạng, D-189)

Mỗi collection: 5 action của Directus như cũ, thêm:

```json
{
  "articles": {
    "read": { "access": "full", "fields": ["*"] },
    "export": { "access": "partial", "fields": ["id", "title"], "formats": ["csv"] },
    "import": { "access": "none" }
  }
}
```

`formats` thiếu = mọi định dạng. Admin: `full`, `["*"]`, mọi định dạng cho mọi collection. Cùng JSON ở GraphQL
`permissions_me` (scalar, schema không đổi). `libs/types` `CollectionPermissions`: `import?`, `export?` với
`formats?: string[]`.

## Staging ở web (bộ nhớ trang policy)

`Alterations<Permission>`-like `{ create: Row[]; update: Row[]; delete: number[] }` cho dòng `backoffice_permissions`,
`provide`/`inject` giữa `PolicyItemRoute.vue` và `system-permissions`; ghi ra API sau khi policy lưu xong (research R7).

## Không đổi

- `directus_permissions` (kể cả dòng `share` cũ), `directus_policies`, `directus_access`.
- `bo_show_import`, `bo_show_export` của 022/024 (chặn trước, mọi người).
