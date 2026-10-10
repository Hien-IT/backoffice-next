# Data Model: Schema overview và cache dùng chung

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Feature này không tạo bảng hay cột nào và không ghi DB. Dữ liệu gồm 4 phần:

1. Các bảng được đọc.
2. SchemaOverview dựng trong bộ nhớ.
3. Trạng thái cache trong mỗi process.
4. Dữ liệu dùng chung trên Redis với Directus. Định dạng từng byte của phần này nằm ở
   [contracts/redis.md](./contracts/redis.md).

## 1. Bảng được đọc (chỉ SELECT)

| Nguồn | Cột hoặc dữ liệu | Dùng cho |
|-------|------------------|----------|
| Catalog của DB qua `createInspector(knex).overview()` | bảng, cột, kiểu, mặc định, nullable, generated, precision, scale, khóa chính | collection và field (FR-001 đến FR-003) |
| Catalog qua `inspector.foreignKeys()` | foreign key: `table`, `column`, `foreign_key_table`, `foreign_key_column`, `constraint_name`, `on_update`, `on_delete` | `relation.schema` (FR-006) |
| `directus_collections` | `collection`, `singleton`, `note`, `sort_field`, `accountability` | metadata collection |
| `directus_fields` | `id`, `collection`, `field`, `special`, `note`, `validation`, `searchable` | metadata field, field alias |
| `directus_relations` | mọi cột | `relation.meta` |
| `@backoffice/system-data` | `systemCollectionRows`, `systemFieldRows` (kèm auth provider), `systemRelationRows` | collection, field, relation hệ thống |
| `directus_access`, `directus_policies` | `role`, `user`, `policy`, `sort`; `id`, `ip_access` | giá trị cache `policies` |
| `directus_permissions` | mọi cột | giá trị cache `raw-permissions` |

## 2. SchemaOverview

Kiểu đã có ở `libs/types/src/schema.ts` và `relations.ts` (port từ `directus/packages/types`). Quy tắc dựng
lấy từ `getDatabaseSchema` và `RelationsService.readAll(undefined, undefined, true)` của Directus. Chi tiết và
cách so sánh nằm ở [contracts/schema-overview.md](./contracts/schema-overview.md).

```text
SchemaOverview
├── collections: { [collection]: CollectionOverview }
│   ├── collection, primary, singleton, note, sortField, accountability
│   └── fields: { [field]: FieldOverview }
│       └── field, defaultValue, nullable, generated, type, dbType, precision, scale,
│           special[], note, validation, alias, searchable
└── relations: Relation[]
    └── collection, field, related_collection, schema (ForeignKey | null), meta (RelationMeta | null)
```

Ràng buộc:

- Chỉ bảng có khóa chính, tên không có dấu cách, không nằm trong `DB_EXCLUDE_TABLES` mới thành collection.
- Field alias có `type: 'alias'`, `alias: true`, `dbType: null`. Field có `special` chứa `no-data` bị loại.
- `relations` giữ đúng thứ tự Directus trả về. Thứ tự có ý nghĩa khi so sánh.
- Toàn bộ giá trị phải biểu diễn được bằng JSON, vì schema được gửi qua bus (`schemaCache--done`).

## 3. Trạng thái trong mỗi process

| Trạng thái | Kiểu | Vòng đời |
|------------|------|----------|
| `memorySchemaCache` | `Readonly<SchemaOverview>`, đóng băng sâu | Gán khi process tự dựng xong hoặc nhận `schemaCache--done`. Về `null` khi nhận `schemaChanged` hoặc khi chạy `clearSystemCache` |
| `localSchemaCache` | Keyv memory, namespace `<CACHE_NAMESPACE>_schema`, TTL `CACHE_SYSTEM_TTL` | Bị xóa cùng `memorySchemaCache`. Ở 002 chưa có ai ghi |
| Lớp local của permissions cache | LRU tối đa 100 key (có Redis) hoặc 500 key (không Redis) | Xóa theo key, hoặc xóa hết, khi nhận `multi-cache` từ process khác |
| Bộ xử lý của bus | `Set` handler theo kênh | Handler `schemaCache--done` chỉ tồn tại trong lúc một request đang chờ |
| Kv/bus local | Khi không có Redis | Chỉ trong process. Đã có cảnh báo một instance từ 001 |

Chuyển trạng thái cache schema của một process khi `CACHE_SCHEMA=true`:

```text
            schemaChanged / clearSystemCache
   ┌──────────────────────────────────────────────┐
   ▼                                              │
 Trống ── INCRBY = 1 ──► Đang dựng ── xong ──► Sẵn sàng
   │                         │ lỗi: phát {schema:null}, xóa khóa, ném lỗi (500)
   │
   └── INCRBY ≥ 2 ──► Đang chờ ── nhận {schema} ──► Sẵn sàng
                         │ hết CACHE_SCHEMA_SYNC_TIMEOUT hoặc nhận {schema:null}
                         └──► thử lại (tối đa 3 lần), rồi lỗi "Failed to get Schema information: hit infinite loop"
```

Khi `CACHE_SCHEMA=false`: mỗi lần gọi đều dựng mới, không có trạng thái.

## 4. Dữ liệu dùng chung trên Redis

| Tên (mặc định) | Loại | Ai ghi | Ai đọc |
|----------------|------|--------|--------|
| `directus:lock:schemaCache--preparing` | số nguyên (`INCRBY`, `UNLINK`) | mọi process khi cache trống | mọi process |
| `directus:bus:schemaCache--done` | kênh pub/sub, `{schema}` | process dựng schema | process đang chờ |
| `directus:bus:schemaChanged` | kênh pub/sub, `{autoPurgeCache?}` | `clearSystemCache` | mọi process |
| `permissions:<namespace>-<hash>` | JSON (gzip từ 1000 byte) | `withCache` | `withCache` |
| `permissions:multi-cache` | kênh pub/sub, `{type,key?,origin}` | permissions cache (`set`, `delete`, `clear`) | permissions cache ở process khác |
| `sets:namespace:system-cache_system:system-cache_system:*` | Keyv | Directus. App mới chỉ xóa ở 002 | Directus |
| `sets:namespace:system-cache_lock:system-cache_lock:system-cache-lock` | Keyv `{"value":true,"expires":…}`, `PX 10000` | `clearSystemCache` | `clearSystemCache` |

Tên thật đổi theo `REDIS_LOCK_NAMESPACE`, `REDIS_BUS_NAMESPACE`, `REDIS_PERMISSIONS_NAMESPACE`, `CACHE_NAMESPACE`.
