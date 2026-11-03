# Contract: Web (D-210.4 giao diện)

## `composables/use-collection-indexes.ts`

```ts
export interface CollectionIndex { id; collection; name; fields: string[]; type: 'btree' | 'trigram'; unique: boolean; status: 'creating' | 'ready' | 'failed'; error: string | null; date_created: string; missing: boolean | null }
export function useCollectionIndexes(collection: Ref<string>): {
  available: Ref<boolean>;        // GET trả 200 (false khi 404 Directus, 403, lỗi mạng; không log)
  indexes: Ref<CollectionIndex[]>; meta: Ref<{ trigram: boolean; concurrent: boolean }>;
  loading: Ref<boolean>; error: Ref<unknown>;
  load(): Promise<void>; create(body: { fields: string[]; type: 'btree' | 'trigram'; unique: boolean }, concurrent: boolean): Promise<CollectionIndex>;
  remove(name: string): Promise<void>;
  indexesOf(field: string): CollectionIndex[];   // cho hộp thoại xóa field (FR-019a)
}
```

- Một cache theo module keyed `collection` để card và `FieldsManagement.vue` dùng chung một danh sách.
- Poll: khi `indexes` có `status === 'creating'`, `setInterval(load, 5000)`; dừng khi hết hoặc `onUnmounted`; không dùng
  `useAutoRefresh` (chấm D-199).
- Toast (`notify`): sau 202 `index_created_notice`; khi một dòng chuyển `ready` → `index_ready_notice`, `failed` →
  `index_failed_notice` (chỉ khi trang còn mở).
- Lỗi API hiện inline bằng `translateAPIError` trong `BoNotice type="danger"` của dialog; lỗi mạng ở card bằng cùng
  BoNotice.

## `modules/settings/routes/data-model/components/CollectionIndexes.vue`

Props `{ collection: string }`. Chỉ render khi `available` (card ẩn ở Directus) và collection không phải hệ thống (prop
từ `FieldsRoute.vue`). Đặt sau `<BoForm>` trong `FieldsRoute.vue` (research R8). `data-testid="collection-indexes"`.

| Phần | Component | Ghi chú |
|------|-----------|---------|
| Header | `BoIcon name="data_table"`? → dùng `database` (Material Symbols); `h3` `$t('indexes')`; `p` `$t('indexes_description')`; `BoButton size="sm" icon="add"` `$t('add_index')` | a11y: `aria-labelledby` id tiêu đề |
| Bảng | `BoTable :columns row-key="name" :loading :caption` cột `name`, `fields` (chip theo thứ tự), `type` (`$t('index_type_btree')`/`trigram`), `unique` (BoIcon `check` / `—`), `status` | `status`: `creating` = vòng xoay + `$t('index_status_creating')`; `ready`; `failed` + `error` (title); `missing` = `BoChip` `$t('index_missing')` |
| `#item-append` | `BoButton variant="ghost" square icon="delete" :aria-label` | disabled khi `creating` |
| `#empty` | `$t('indexes_empty')` | |
| Dialog thêm | `BoDialog :title="$t('add_index')"` | focus trả về nút thêm (BoDialog tự làm) |
| – field | `BoSelect :items="cột thật chưa chọn" :placeholder="$t('index_fields_add')"` → chọn là push vào `fields`, reset về null | items lọc `alias`, kiểu FR-001a theo `meta` (text không trên MySQL: web không biết vendor → để API trả 400) |
| – danh sách | `BoSortableList v-model="fields" item-key="(f) => f" :item-label :row-actions="Remove"` | menu dòng có Move up/down/Remove (bàn phím) |
| – type | `BoSelect :items="[btree, trigram khi meta.trigram]"` | chọn trigram: `fields` cắt còn 1, `unique = false` + disabled |
| – unique | `BoSwitch :label="$t('index_unique_label')"` | |
| – concurrent | `BoSwitch :label="$t('index_concurrent')"` bật sẵn, chỉ khi `meta.concurrent` | |
| – actions | Cancel; `BoButton variant="primary" :loading :disabled="fields.length === 0"` `$t('create')` | lỗi 400 hiện `BoNotice` trong dialog |
| Dialog xóa | `BoDialog :title="$t('index_delete_title')"`, thân `index_delete_text` + tên trong `code` (`wrap-anywhere`); Cancel / `variant="danger"` `$t('delete_label')` | |

## `FieldsManagement.vue` (hộp thoại xóa field, FR-019a)

Trong `<BoDialog v-model:open="deleteOpen" :title="$t('delete_field_are_you_sure', …)">` thêm body:
`<p v-if="dropped.length" class="text-sm text-gray-500 dark:text-gray-400">{{ $t('indexes_dropped_with_field') }}
{{ dropped.map(i => i.name).join(', ') }}</p>` với `dropped = indexesOf(deleteTarget.field)` từ composable (chỉ khi
`available`). Không chặn xóa.

## Chuỗi (overlay en-US / vi-VN, khối "Spec 030")

| Key | en-US | vi-VN |
|-----|-------|-------|
| `indexes` | Indexes | Index |
| `indexes_description` | Composite and search indexes of this collection, created by Backoffice. | Index ghép và index tìm kiếm của collection này, do Backoffice tạo. |
| `add_index` | Add index | Thêm index |
| `index_fields_add` | Add a field… | Thêm field… |
| `index_type` | Index type | Loại index |
| `index_type_btree` | B-tree | B-tree |
| `index_type_trigram` | Trigram (search, PostgreSQL) | Trigram (tìm kiếm, PostgreSQL) |
| `index_unique_label` | Unique: reject duplicate combinations | Unique: từ chối tổ hợp trùng |
| `index_concurrent` | Create without locking the table | Tạo không khóa bảng |
| `index_status_creating` | Creating… | Đang tạo… |
| `index_status_ready` | Ready | Sẵn sàng |
| `index_status_failed` | Failed | Thất bại |
| `index_missing` | Missing on the database | Không còn trên DB |
| `index_delete_title` | Delete index? | Xóa index? |
| `index_delete_text` | The index is dropped from the database; the rows stay as they are. | Index bị gỡ khỏi DB; dữ liệu các dòng giữ nguyên. |
| `index_created_notice` | Index "{name}" is being created | Đang tạo index "{name}" |
| `index_ready_notice` | Index "{name}" is ready | Index "{name}" đã sẵn sàng |
| `index_failed_notice` | Index "{name}" failed: {error} | Index "{name}" thất bại: {error} |
| `indexes_dropped_with_field` | These indexes will be dropped: | Các index sau sẽ bị gỡ: |
| `indexes_empty` | No indexes yet | Chưa có index |

Key DR dùng thẳng: `unique`, `type`, `status`, `remove`, `cancel`, `create`, `delete_label`, `move_up`, `move_down`.

## `test-utils/fetch.ts` và `web-e2e/helpers/allowed-paths.ts`

```ts
{ id: 229, method: 'GET',    path: new RegExp(`^/backoffice/collections/${ID}/indexes$`) },
{ id: 230, method: 'POST',   path: new RegExp(`^/backoffice/collections/${ID}/indexes$`) },
{ id: 231, method: 'DELETE', path: new RegExp(`^/backoffice/collections/${ID}/indexes/${ID}$`) },
```
