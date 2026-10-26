# Data Model: Ẩn hiện ô tìm kiếm, Import, Export theo collection (022)

## Bảng `backoffice_migrations` (mới, do `runBackofficeMigrations` tạo khi chưa có)

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `version` | string(255), khóa chính | `YYYYMMDD` + một chữ cái, như Directus (`20261026A`); không trùng được với `directus_migrations` vì khác bảng |
| `name` | string(255), not null | tên trong `index.ts` (`Add Collection UI Toggles`) |
| `timestamp` | timestamp, default `knex.fn.now()` | DB điền khi insert |

Chuyển trạng thái của một migration riêng: `chưa chạy` (không có dòng) → `up()` xong → `đã chạy` (có dòng). Không có
chiều ngược (không `down`); rollback tay: xóa cột, dòng `directus_fields`, dòng `backoffice_migrations`. Dòng chỉ ghi
sau `up()` xong, không transaction bao ngoài (như Directus). Dòng có version không có trong `index.ts` = DB của bản
Backoffice mới hơn → `start` dừng (FR-016).

Collection hệ thống (D-181): dòng trong `libs/system-data/src/collections/collections.yaml` `{ collection:
backoffice_migrations, hidden: true, note: Backoffice migrations }` → `systemCollectionRows` thêm `system: true`;
không có yaml field hệ thống (cột có meta null ở cả hai app).

## Cột mới của `directus_collections` (migration `20261026A`)

| Cột | Kiểu | Default | Null | Ý nghĩa |
|-----|------|---------|------|---------|
| `bo_show_search` | boolean | `true` | có | null hoặc true: ô nhập từ khóa hiện ở trang Content |
| `bo_show_import` | boolean | `true` | có | null hoặc true: phần import của mục Import/Export hiện |
| `bo_show_export` | boolean | `true` | có | null hoặc true: nút Export và link CSV hiện |

Chỉ `false` mới ẩn (FR-007). Web đọc `meta.bo_show_* !== false`. Directus app hiện ba toggle trong form collection,
Content của Directus app không đọc.

## Dòng `directus_fields` (ba dòng, migration `20261026A`)

| Thuộc tính | Giá trị |
|------------|---------|
| `collection` | `directus_collections` |
| `field` | `bo_show_search` / `bo_show_import` / `bo_show_export` |
| `special` | `cast-boolean` (MySQL, SQLite trả boolean trong `meta`) |
| `interface` | `boolean` |
| `width` | `half` |
| `translations` | `[{ language: en-US, translation: Show Search }, { language: vi-VN, translation: Hiện ô tìm kiếm }]` (tương tự Show Import / Hiện Import, Show Export / Hiện Export) |
| `sort`, `group`, `note`, `options` | null (field đứng sau các field hệ thống, card cuối của form D-150) |
| các cột khác | default của bảng (`readonly` false, `hidden` false, `required` false) |

`up` chạy lại: bỏ qua cột đã có (`hasColumn`) và dòng đã có (`where { collection, field }`).

## Danh sách migration riêng (`apps/api/src/database/backoffice-migrations/index.ts`)

```ts
export interface BackofficeMigration {
	version: string; // '20261026A'
	name: string; // 'Add Collection UI Toggles'
	up(knex: Knex): Promise<void>;
}
export const BACKOFFICE_MIGRATIONS: readonly BackofficeMigration[]; // theo thứ tự version
```

Thêm migration = thêm file + một dòng ở đây. Kiểm tra lúc `start`: tập version của `index.ts` = tập version trong bảng.

## Khóa Redis

| Khóa | Namespace | Ai giữ | Bao lâu |
|------|-----------|--------|---------|
| `backoffice-migrations` | `REDIS_LOCK_NAMESPACE` (mặc định `directus:lock`), kv của `useLock()` | process chạy migration riêng trong `bootstrap`/`init` | `lockTimeout` 5000 ms, redlock gia hạn khi callback còn chạy [Unverified] |

Không có Redis (một instance): kv local, không chờ.

## Trạng thái web (không lưu)

| Tên | Nguồn | Dùng ở |
|-----|-------|--------|
| `showSearch`, `showImport`, `showExport` | `currentCollection.meta.bo_*` (`useCollection(collection).info`) | `CollectionRoute.vue` |
| `activeSearch` | `showSearch ? search : null` | prop `search` của layout wrapper và `ExportSidebarDetail` |

Preset/bookmark (`search`, `filter`) không đổi khi ẩn (FR-004).
