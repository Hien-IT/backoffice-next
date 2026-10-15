# Contract: layout (registry, wrapper, năm layout)

Chép từ `@directus/extensions` `defineLayout` và `directus/packages/composables/src/use-layout.ts`; id, slot, option
và query giữ nguyên tên để preset dùng chung với Directus (FR-020, SC-005).

## 1. `LayoutConfig` (`apps/web/src/layouts/types.ts`)

```ts
interface LayoutConfig<Options = any, Query = any> {
  id: 'tabular' | 'cards' | 'calendar' | 'kanban' | 'map';
  name: string;            // '$t:layouts.<id>.<id>' (kanban: 'layouts.kanban.name')
  icon: string;            // table_rows, grid_view, event, view_week, map
  component: Component;    // layout chính, nhận LayoutState qua v-bind
  slots: { options: Component; sidebar: Component; actions: Component };
  headerShadow?: boolean; sidebarShadow?: boolean; smallHeader?: boolean;
  setup(props: LayoutProps<Options, Query>, ctx: { emit: LayoutEmit }): Record<string, unknown>; // LayoutState
}
```

`layouts/index.ts`: `getLayouts()` (5, sắp theo id), `getLayout(id)` → config hoặc `undefined` (màn rơi về
`tabular`).

## 2. `LayoutProps` và `useLayout` (`layouts/use-layout.ts`)

| Prop | Kiểu | Nguồn ở màn collection | Nguồn ở `DrawerCollection` |
|------|------|------------------------|-----------------------------|
| `collection` | string | route | prop |
| `selection` (v-model) | `PrimaryKey[]` | `useSelection` | lựa chọn drawer |
| `layoutOptions`, `layoutQuery` (v-model) | object \| null | preset | preset tạm (`temporary`) |
| `filterUser` | `Filter \| null` | preset `filter` | bộ lọc người dùng trong drawer |
| `filterSystem` | `Filter \| null` | `archiveFilter` | bộ lọc của interface (`filter` prop) |
| `filter` | `Filter \| null` | `mergeFilters(filterUser, filterSystem)` | như vậy |
| `search` | `string \| null` | preset | ô tìm drawer |
| `selectMode` | boolean | false | true |
| `showSelect` | `'none'\|'one'\|'multiple'` | `'multiple'` | theo `multiple` |
| `readonly` | boolean | false | false |
| `resetPreset` | `() => Promise<void>` | `usePreset` | no-op |
| `clearFilters` | `() => void` | đặt filter, search null | |
| `layoutProps` | object | `{ height }` cho calendar | |

Wrapper: `<LayoutWrapper ref v-slot="{ layoutState }" v-model:selection ... />`; `expose.state` = `layoutState`
(màn gọi `state.refresh()`, `state.download()`). Emit: `update:selection`, `update:layoutOptions`,
`update:layoutQuery`.

## 3. `LayoutState` chung (mọi layout trả)

`items`, `loading`, `error`, `itemCount`, `totalCount`, `totalPages`, `page`, `toPage`, `limit`, `sort`, `fields`,
`primaryKeyField`, `info`, `showingCount`, `refresh()` (items + hai đếm; đếm trả cache của `useMemoize` khi khóa
`(url, filter, search)` không đổi, như Directus, FR-023), `resetPresetAndRefresh()`, `selectAll()`, `download()`
(`saveAsCSV`), `filter`, `search`, `filterUser`, `isFiltered` (calendar/kanban/map).

## 4. Theo layout

| Layout | Query (`layout_query.<id>`) | Option (`layout_options.<id>`) | State riêng | Slot `actions` | Slot `options` |
|--------|------------------------------|--------------------------------|-------------|----------------|----------------|
| tabular | `{fields: string[] (4 đầu), sort: [field], page: 1, limit: 25}` | `{widths: {field: px}, align: {field: left\|center\|right}, spacing: cozy\|compact\|comfortable, limit?}` | `tableHeaders`, `tableSort`, `tableRowHeight`, `tableSpacing`, `activeFields`, `onSortChange`, `onAlignChange`, `onRowClick`, `changeManualSort`, `sortField`, `aliasedFields`, `aliasedKeys`, `fieldsWithRelationalAliased` | số đếm | khoảng cách dòng |
| cards | `{sort: [pk], page: 1, limit: 25}` (fields tính từ option) | `{size: 4, icon: 'box', imageSource: file đầu, imageFit: 'crop', title, subtitle}` | `fileFields`, `getLinkForItem`, `isSingleRow`, `width` | số đếm, sắp xếp, kích thước trang | ảnh, fit, tiêu đề, phụ đề, kích thước, icon |
| calendar | — (page 1, limit = `queryLimit.max` hoặc 1000) | `{template, startDateField, endDateField, firstDay: 0, viewInfo: {type, startDateStr}}` | `createCalendar`, `destroyCalendar`, `resize`, `dateFields`, `filterWithCalendarView` | hôm nay/trước/sau/view (FullCalendar toolbar), số đếm tương đối | template, field ngày, ngày đầu tuần |
| kanban | `{page, limit: 1000}` (sort = sort_field hoặc pk) | `{groupField, groupTitle, dateField, tagsField, userField, titleField, textField, imageSource, crop: true, showUngrouped: false, groupOrder: {groupField, sortMap}}` | `groupedItems`, `groups`, `isRelational`, `canReorder*`, `change`, `changeGroupSort`, `addGroup`, `editGroup`, `deleteGroup`, `fieldGroups`, `userFieldType`, `ungroupedDisabled` | số đếm tương đối | nhóm, tiêu đề nhóm, ảnh, fit, tiêu đề, text, ngày, tag, user, chưa nhóm |
| map | `{sort: [pk], page: 1, limit: 1000}` | `{geometryField, displayTemplate, clusterData: false, cameraOptions: {center, zoom, bearing, pitch, bbox}}` | `geojson`, `geojsonBounds`, `geojsonLoading`, `geojsonError`, `geometryOptions`, `handleClick`, `handleSelect`, `fitDataBounds`, `itemPopup`, `updateItemPopup`, `directusSource`, `directusLayers`, `featureId`, `template` | số đếm (phân trang khi > 1 trang), vừa dữ liệu | field hình học, nền (`app.basemap`), cụm, template |

Giá trị mặc định và tên khóa là của Directus 11.17.4; preset ghi ra chỉ chứa khóa đã đổi (gộp `assign` như
`use-preset.ts`).

## 5. Bàn phím (D-69)

| Kéo thả | Đường bàn phím |
|---------|----------------|
| Sắp xếp tay bảng | menu dòng "Lên", "Xuống" (`BoSortableList` 013) |
| Thứ tự cột, độ rộng | menu header "Chuyển trái", "Chuyển phải"; độ rộng: ô nhập trong menu header |
| Thẻ kanban | menu thẻ "Chuyển sang nhóm…" (submenu), "Lên", "Xuống" |
| Cột kanban | menu cột "Chuyển trái/phải" |
| Sự kiện calendar | sửa ngày trong form item (không UI thêm) |
| Chọn trên bản đồ | danh sách item đang hiện (`MapActions`), mỗi mục nút chọn/mở |
| Tay cầm live preview | mũi tên trái/phải ±5 %, Home/End |
| Điều kiện bộ lọc | menu điều kiện "Lên", "Xuống" |
