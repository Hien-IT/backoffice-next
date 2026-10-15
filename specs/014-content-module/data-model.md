# Data model: Module Content (014)

Mọi kiểu lấy từ `@directus/types` 15.0.3 (`Collection`, `Field`, `Preset`, `Filter`, `ContentVersion`, `Revision`,
`Comment`, `Share`, `FlowRaw`) hoặc chép từ `directus/app/src/types`. Không có DB mới; mọi thứ là trạng thái trình
duyệt dựng từ API.

## 1. Route (`modules/content.ts`, FR-001, FR-002)

| Tên | Path (dưới `/admin/content`) | Component | Props | Guard |
|-----|------------------------------|-----------|-------|-------|
| `no-collections` | `` | `NoCollections` | — | `beforeEnter`: chuyển tới collection gần nhất hoặc gốc đầu tiên |
| `content-collection` | `:collection` | `CollectionOrItem` | `collection`, `bookmark` (query), `archive` (`'archived'`, `'all'`, null) | `checkForSystem` |
| `content-item` | `:collection/:primaryKey` | `ItemRoute` | `collection`, `primaryKey` (`+` = mới) | `checkForSystem` (giữ `?bookmark=`) |
| `content-item-preview` | `:collection/:primaryKey/preview` | `PreviewRoute` | `collection`, `primaryKey` | — |
| `content-item-not-found` | `:_(.+)+` | `ContentNotFound` | — | `checkForSystem` |

`checkForSystem`: `getSystemCollectionRoute(collection)` → redirect (`/users`, `/files`, `/insights`, `/activity`,
`/settings/{project,data-model,roles,presets,translations,flows}`); đích là khung 012 (D-72).

## 2. Preset cục bộ (`use-preset.ts`, FR-010 đến FR-019)

| Trường | Kiểu | Nguồn | Ghi chú |
|--------|------|-------|---------|
| `localPreset` | `Partial<Preset>` | `getPresetForCollection(collection)` hoặc `getBookmark(id)` | `{layout: 'tabular'}` mặc định |
| `layout` | `string` | `localPreset.layout ?? 'tabular'` | ghi `updatePreset({layout})` |
| `layoutOptions` | `Record<string, any> \| null` | `localPreset.layout_options[layout]` | ghi gộp theo layout |
| `layoutQuery` | `Record<string, any> \| null` | `localPreset.layout_query[layout]` | |
| `filter` | `Filter \| null` | `localPreset.filter` | |
| `search` | `string \| null` | | |
| `refreshInterval` | `number \| null` | `refresh_interval` | |
| `bookmarkTitle` | `string \| null` | `translate(localPreset.bookmark)` | set → lưu ngay |
| `bookmarkExists`, `bookmarkSaved`, `bookmarkIsMine`, `busy` | boolean | | `bookmarkSaved = isEqual(localPreset, store bookmark)` |
| `temporary` | boolean (tham số) | drawer chọn item | không ghi API |

Ghi API: không bookmark → `savePreset(localPreset)` sau 450 ms với **toàn bộ preset cục bộ**: `POST /presets` lần đầu
body `{collection, layout, layout_query, layout_options, filter, search, refresh_interval, user}` (không `id`,
`bookmark`); `PATCH /presets/:id` sau đó cũng gửi toàn bộ preset cục bộ; preset có `id` của user khác → `POST` bản mới
(store). Phiên share: không nạp, không ghi. `resetPreset` ghi ngay
`{layout_query: null, layout_options: null, layout: 'tabular', filter: null, search: null, refresh_interval: null}`.

Store `presets` (mở rộng): `collectionPresets` (hydrate 012), getter `bookmarks` (thứ tự global, role, user, tên),
`getPresetForCollection`, `getBookmark`, `create` (`POST /presets`), `update` (`PATCH /presets/:id`), `delete`
(`DELETE /presets` mảng id), `savePreset`.

## 3. Layout (`contracts/layouts.md`)

| Khái niệm | Kiểu | Ghi chú |
|-----------|------|---------|
| `LayoutConfig` | `{ id, name, icon, component, slots: {options, sidebar, actions}, headerShadow?, sidebarShadow?, smallHeader?, setup(props, {emit}) }` | 5 config nội bộ |
| `LayoutProps` | `{ collection, selection, layoutOptions, layoutQuery, filter, filterUser, filterSystem, search, selectMode, showSelect ('none'\|'one'\|'multiple'), readonly, resetPreset, clearFilters, layoutProps? }` | wrapper nhận |
| `LayoutState` | giá trị `setup` trả (items, loading, counts, page, limit, sort, fields, refresh, download, selectAll, resetPresetAndRefresh + riêng từng layout) | lộ qua slot và `expose.state` |
| Query theo layout | `tabular`, `cards`, `map`: `{fields, sort, page, limit}`; `kanban`: `{page, limit, sort?, fields?}`; `calendar`: không có | lưu `layout_query[<id>]` |
| Option theo layout | tabular `{widths, align, spacing, limit?}`; cards `{size, icon, imageSource, title, subtitle, imageFit}`; calendar `{template, startDateField, endDateField, firstDay, viewInfo}`; kanban `{groupField, groupTitle, dateField, tagsField, userField, titleField, textField, imageSource, crop, showUngrouped, groupOrder}`; map `{cameraOptions, geometryField, clusterData, displayTemplate}` | lưu `layout_options[<id>]` |

Trạng thái nạp (`useItems`): `items`, `loading` (sau 150 ms), `loadingItemCount`, `error`, `itemCount` (theo
`filter` + `search`), `totalCount` (theo `filterSystem`), `totalPages = ceil(itemCount / limit)`; memo đếm theo
`(url, filter, search)`; generation cho đếm; abort cho danh sách.

Lựa chọn: `selection: PrimaryKey[]` ở màn collection, xóa khi đổi collection; `showSelect` `'multiple'` khi có checkbox.

## 4. Màn item (`use-item.ts`, FR-050 đến FR-062)

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `item` | `Item \| null` | `GET <endpoint>/<pk>` (`?version=<key>&versionRaw=true` khi ở version; singleton `GET <endpoint>`) |
| `edits` | `Item` | chỉ field đã sửa (`BoForm` `modelValue`) |
| `hasEdits` | boolean | `Object.keys(edits).length > 0` |
| `isNew` | boolean | `primaryKey === '+'` |
| `isArchived` | `boolean \| null` | so `item[archive_field]` với `archive_value` (`'true'` → `true`) |
| `permissions` | `usePermissions` | `collectionPermissions` (create, update, delete, sort, archive, revisions), `itemPermissions` (update, delete, share, archive, `fields`, `loading`) |
| `validationErrors` | `ValidationError[]` | từ `validateItem` cục bộ hoặc API (`FAILED_VALIDATION`, `RECORD_NOT_UNIQUE`) |
| `saving`, `deleting`, `archiving`, `loading`, `error` | | |
| `save()` | → item | validate cục bộ (`pushGroupOptionsDown`, `clearHiddenFieldsByCondition`, `mergeItemData`) rồi `POST`/`PATCH` |
| `saveAsCopy()` | → pk mới | GraphQL `<c>_by_id` với `item_duplication_fields`, bỏ khóa, nối thành `create`, `POST` |
| `archive()`, `remove()`, `refresh()`, `getItem()` | | |

Trạng thái màn: `isSavable`, `isFormDisabled`, `disabledOptions` (`['save-and-add-new','save-as-copy']` khi không có
quyền tạo; `['save-as-copy']` khi mới), `confirmLeave` + `leaveTo` (guard), `confirmDelete`, `confirmArchive`,
`title`, `breadcrumb`, `backRoute`, `showHeaderShadow`, `actualPrimaryKey`, `internalPrimaryKey`.

Thông báo tại chỗ (D-66): `useNotices()` → danh sách `{id, type: 'success'|'danger', text}` hiện dưới page header,
tự ẩn 5 s, `aria-live="polite"`.

## 5. Version (`use-versions.ts`, FR-070 đến FR-073)

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `rawVersions` | `ContentVersion[]` | `GET /versions` lọc `collection`, `item`, `sort -date_created`, `fields *` |
| `versions` | `ContentVersionMaybeNew[]` | `[draft (global, id '+' nếu chưa có), ...local]` |
| `currentVersion` | `ContentVersionMaybeNew \| null` | từ `?version=<key>`; null = bản chính |
| `queryVersion` | `string \| null` | đồng bộ route query |
| `saveVersion(edits, item, pk)` | | `POST /versions` khi `'+'` rồi `POST /versions/:id/save` với `edits` |
| `validationErrors`, `saveVersionLoading`, `loading`, `readVersionsAllowed` | | quyền trên `directus_versions` |

So sánh (`use-comparison.ts`): `mode` (`'version'` \| `'revision'`), `comparisonData` (`base`, `incoming`,
`selectableDeltas`, `revisionFields`, `outdated`, `mainHash`), `normalizedData` (tên hiển thị, ngày, user mỗi bên,
`fieldsWithDifferences`), `selectedComparisonFields`, `compareToOption` (`'Previous'` \| `'Latest'`). Version:
`GET /versions/:id/compare` → `{outdated, mainHash, current, main}`; promote `POST /versions/:id/promote`
`{mainHash, fields}`. Revision: `revision.data`/`delta` so với revision trước hoặc item hiện tại; "Apply" → `edits`.

## 6. Revision, comment, share, flow (`contracts/api-calls.md`)

| Thực thể | Trường dùng | Nạp |
|----------|-------------|-----|
| Revision | `id`, `collection`, `item`, `activity.{action,timestamp,user{id,email,first_name,last_name},ip,user_agent,origin}`, `data`, `delta`, `version` | 10/trang, `sort -id`, nhóm theo ngày (`today`, `yesterday`, `date-fns_date_short*`); đếm `aggregate count` |
| Comment | `id`, `comment`, `date_created`, `user_created{id,email,first_name,last_name,avatar{id,modified_on}}`, `display` (đã khử HTML, `@uuid` → `<mark>tên</mark>`) | nhóm theo ngày; `userPreviews` từ `/users?filter[id][_in]` |
| Share | `id`, `name`, `collection`, `item`, `role`, `password`, `date_start`, `date_end`, `max_uses`, `times_used`, `date_created` | `sort name`; link `<origin><root>admin/shared/<id>` |
| ManualFlow | `FlowRaw` + `tooltip`, `isFlowDisabled` | từ store flows theo `options.collections`, `options.location` |
| Bộ lọc | cây `Filter` (`_and`/`_or` lồng, `{field: {op: value}}`, hàm `year(field)`, biến `$CURRENT_USER`...) | JSON như Directus; `activeFilterCount` = số toán tử |
| Nền bản đồ | `BasemapSource {name, type: 'raster'\|'tile'\|'style', url, tileSize?, attribution?}` | `[Mapbox?]`, OpenStreetMap, `settings.basemaps`; chọn trong `app.basemap` |
| Export | `exportSettings {limit, filter, search, fields, sort}`, `format`, `location` (`download`\|`files`), `folder`, `itemCount`, `exportCount`, `lockedToFiles` | ngưỡng `queryLimit.max`, 2500 |
| Import | `file`, `uploading`, `progress`, `importing`, `background`, `errorDialogRows: APIError[]` | multipart `file`; `?background=true` |

## 7. localStorage (D-39)

| Khóa | Giá trị | Nguồn Directus |
|------|---------|----------------|
| `backoffice-last-accessed-collection` | tên collection | `directus-last-accessed-collection` |
| `backoffice-live-preview-mode` | `'split'` \| `'popup'` \| null | `live-preview-mode` |
| `backoffice-live-preview-size` | số (%) | `live-preview-size` |
| `backoffice-live-preview-full-width` | boolean | `live-preview-full-width` |
| `backoffice-sidebar-collapsed` (012), độ rộng cột 013 | giữ | |

Không lưu nền bản đồ (store `app.basemap`, trong phiên) và trạng thái mở nhóm cây (`useNavigation`, trong phiên) như
Directus.

## 8. Store mở rộng

| Store | Thêm | Nguồn |
|-------|------|-------|
| `presets` | `bookmarks`, `getBookmark`, `create`, `update`, `delete`, `savePreset` | `stores/presets.ts` |
| `app` | `basemap` (ref, mặc định `'OpenStreetMap'`) | `@directus/stores` `app.ts` |
| `sidebar` (layout) | `activeAccordionItem: string \| null` | `stores/sidebar.ts` Directus |
| `collections` | `visibleCollections`, `sortedCollections`, `getCollection` đã có; thêm `collapse` đọc từ `meta` | |
| `translations` | `create`/`update` nếu `system-input-translated-string` cần | `stores/translations.ts` |
| `flows` | `getManualFlowsForCollection` đã có; `isActiveFlow` | |

## 9. Bộ mẫu mở rộng (`apps/web/fixtures/interfaces`)

| Thêm | Nội dung |
|------|----------|
| seed `bo_content` (mới; `bo_std` và snapshot 013 giữ nguyên, CHK054) | field `id`, `status` (choices draft/published/archived), `title`, `body`, `date_published`, `sort`, `author` (m2o `directus_users`), `cover` (file), `tags` (csv), `location` (geometry.Point khi có PostGIS); `meta.versioning: true`, `archive_field: status`, `archive_value: 'archived'`, `unarchive_value: 'draft'`, `archive_app_filter: true`, `display_template: '{{ title }}'`, `preview_url: 'https://preview.example/{{ id }}?v={{ $version }}'`, `sort_field: sort`; 30 item |
| seed cây | folder `bo_folder` (collection không `schema`, `collapse: locked`) chứa `bo_content`; `bo_groups` giữ nguyên |
| seed `bo_singleton` (mới) | `meta.singleton: true`, field `id`, `site_name`, `tagline`, `maintenance` (boolean), một item; quyền như `bo_content` (FR-058, US2-7) |
| presets | preset user (admin, `bo_content` tabular 3 cột), preset role (`bo-editor`), preset global, bookmark cá nhân `bo-bookmark` (filter `status = published`), bookmark global |
| versions | version `draft` và `local-1` của `bo_content/1` có delta |
| shares | share có mật khẩu `bo-share-password` cho `bo_content/1`, `max_uses: 5` |
| flows | `bo-flow` `options.location: 'both'`, `requireSelection: true`; thêm `bo-flow-item` (`location: 'item'`, `requireConfirmation` + 1 field) |
| comments | 2 comment trên `bo_content/1`, một có `@<uuid bo-viewer>` |
| export | `presets.json`, `versions.json`, `shares.json`, `flows.json` (mở rộng), `revisions.bo_content.json`, `comments.bo_content.json`; chuẩn hóa như 013 (uuid → `bo-<n>`, thời gian → null, `hash`/`mainHash` → cố định, id revision/activity theo thứ tự) để `fixtures-seed.test.ts` vẫn đối chiếu được |
| expected | `expected.content.json`: body preset mong đợi của US1-3 và mẫu request `/items` mỗi layout (viết tay, nguồn Directus: dòng code hoặc DevTools của Directus app); bộ so payload là xác nhận cuối |
