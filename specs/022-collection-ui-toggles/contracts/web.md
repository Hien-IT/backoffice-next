# Contract: web (D-179, D-181)

## `SearchInput.vue` (`apps/web/src/components`)

| Prop | Kiểu | Mặc định | Khi `false` |
|------|------|----------|-------------|
| `showSearch` | boolean | `true` | không render nút search, `<input>`, nút xóa; pill `w-11`; `activate()` về ngay; đóng popover bộ lọc không focus input |
| `showFilter` | boolean | `true` | (có sẵn) |

Cả hai `false`: không render pill (không có gì để hiện). `modelValue`, `filter` không bị sửa khi ẩn.

## `ExportSidebarDetail.vue` (`apps/web/src/components/sidebar`)

| Prop | Mặc định | Khi `false` |
|------|----------|-------------|
| `showImport` | `true` | không render phần import (nhãn, chọn file, checkbox chạy nền, nút Import); `BoDivider` sau phần import chỉ khi `showExport` |
| `showExport` | `true` | không render nút Export và link `download_page_as_csv` |

Phần import vẫn cần `createAllowed` như nay. Dialog export, dialog lỗi giữ nguyên trong template.

## `CollectionRoute.vue` (`apps/web/src/modules/content/routes`)

```ts
const toggles = computed(() => (currentCollection.value?.meta ?? {}) as Record<string, unknown>);
const showSearch = computed(() => toggles.value['bo_show_search'] !== false);
const showImport = computed(() => toggles.value['bo_show_import'] !== false);
const showExport = computed(() => toggles.value['bo_show_export'] !== false);
// FR-004: a hidden search box sends no preset/bookmark/URL keyword; the stored preset stays.
const activeSearch = computed(() => (showSearch.value ? search.value : null));
```

| Chỗ | Trước | Sau |
|-----|-------|-----|
| layout wrapper `:search` | `search` | `activeSearch` |
| `<SearchInput>` | — | `:show-search="showSearch"` |
| `<ExportSidebarDetail>` | luôn render, `:search="search ?? undefined"` | `v-if="showImport || showExport"`, `:show-import`, `:show-export`, `:search="activeSearch ?? undefined"` |

Không đổi: `usePreset`, `clearFilters`, bookmark, DrawerCollection, các module khác.

## Collection hệ thống `backoffice_migrations` ở web

| File | Thay đổi |
|------|----------|
| `stores/collections.ts` | `isSystemCollection`: tiền tố `directus_` hoặc `backoffice_`; `COLLECTIONS_DENY_LIST` thêm `backoffice_migrations` |
| `utils/get-item-route.ts` | `isSystemCollection`: thêm `collection.startsWith('backoffice_')` → `getCollectionRoute` trả `''`, Content ra not found |

## Lỗi và trạng thái

- Collection không có cột (DB chưa migrate, chỉ xảy ra ở cấu hình proxy tới Directus trên DB chưa chạy Backoffice):
  `meta.bo_*` undefined → hiện như nay.
- Share session: `CollectionRoute` đã không có preset; `activeSearch` null.

## Test

- `SearchInput.test.ts`: `showSearch=false` → không `textbox`, có nút `filter`, badge số bộ lọc; click pill không lỗi.
- `ExportSidebarDetail.test.ts`: ba case (ẩn import, ẩn export, cả hai bật) theo `getByRole`.
- `CollectionRoute.test.ts`: meta `bo_show_search: false` → layout nhận `search: null` dù preset có từ khóa; meta
  `bo_show_import: false, bo_show_export: false` → không có `ExportSidebarDetail`; meta null → như nay.
- Browser project (axe): `SearchInput` với `showSearch=false` không vi phạm.
