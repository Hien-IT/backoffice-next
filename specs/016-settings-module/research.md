# Research: Module Settings (016)

Ngày 2026-10-16. Mỗi mục: quyết định, lý do, phương án bỏ. Directus tham chiếu 11.17.4 (`directus/app` 15.10.0,
`directus/packages/system-data`). Dòng [Unverified] kiểm ở T002 (task đầu lượt 1, sau khi 015 mở khóa); kết quả ghi lại
vào file này. Hành vi Directus trong file này lấy từ hai báo cáo đọc mã nguồn (2026-10-16), chưa chạy thử trên Directus
thật; T002 so bằng bộ so DB trước khi code màn tương ứng. Release-gate CHK001–CHK105 đã áp (owner, 2026-10-16). Dữ kiện
đã kiểm khi áp (đọc mã nguồn): `dbSafe` của `v-input.vue`; snapshot tải là body `{data}` tên `snapshot.json`; xóa folder
đặt `group: null` cho con (`api/src/services/collections.ts:643`); tạo policy gửi `{...permission, policy}` gồm `system:
true` (`policies/use-save.ts:33-42`); API mới chặn mất admin cuối bằng `UnprocessableContentError`; `BoTabs` chưa có
`orientation`; `BoInput` chưa có `dbSafe`; `system-theme` 015 chưa có option `appearance`; registry 013 bỏ phần lớn
`preview`. T003 (CHK100): chạy tay bốn luồng ghi trên Directus app 8155 (tạo collection, field m2m, policy với quyền,
preset) và lưu body làm mốc trước khi viết bộ so payload.

## R1. Thư viện và phiên bản

**Quyết định**: không thêm gói. Đã có đủ: `vuedraggable` 4.1.0 (qua `BoSortableList` 013), `nanoid` (`autoKey`,
`system-modules` link id), `@directus/format-title` (tiêu đề collection), `@directus/utils` (`getEndpoint`,
`getRelationType`, `getFunctionsForType`), `lodash-es` (`orderBy`, `merge`, `setWith`, `isEqual`, `cloneDeep`),
`jiti` (dev, chạy script sync như 015).

**Phương án bỏ**: `@directus/system-data` (gói workspace của Directus; dữ liệu lấy bằng script), `@backoffice/system-data`
trong web (lib Node với js-yaml, R5), thư viện cây/matrix (cây là `<ul>` lồng như 014 §9, ma trận là `<table>`).

## R2. Route, sub-menu, dùng lại `use-item`

**Quyết định**:

- `modules/settings.ts` thay `placeholderRoutes('settings').slice(1)` bằng route chép từ `modules/settings/index.ts`
  (data-model §1), component `() => import(...)`; `flows` giữ hai route khung (`settings-flows-collection`,
  `settings-flows-item` → `ModulePlaceholder`, D-92); `ai`, `marketplace`, `extensions`, `system-logs` không khai báo
  (rơi vào `settings-not-found`, D-93). Guard `beforeEnter` của `settings-collections` và `settings-fields` chép nguyên
  (`PATCH /collections/:c {meta:{}}` cho bảng không meta).
- `SettingsNavigation.vue` (chép `navigation.vue`) vào slot `navigation` của `PrivateView`: năm nhóm `<ul>` với
  `<hr>`; mục ngoài phạm vi bỏ; Report Bug/Request Feature chỉ khi settings có URL (D-94); dòng cuối `<li>` chữ
  "Backoffice" mờ, không link (D-95).
- Màn collection, role, policy, translation dùng `useItem(ref('directus_collections'|'directus_roles'|
  'directus_policies'|'directus_translations'), primaryKey, null, extraQuery)` của 014: `getEndpoint` cho
  `/collections`, `/roles`, `/policies`, `/translations`; `deep[users][_limit]=0` qua `extraQuery` ở role. Màn
  collection dùng `edits.meta` là model của `BoForm` (Directus `item.vue` cũng vậy). [Unverified] `useItem` với khóa
  chính chuỗi là tên collection và `collectionInfo` của `directus_collections` (store collections có dòng hệ thống này
  không? Directus có vì `GET /collections` trả cả hệ thống); kiểm T002. T002 cũng kiểm store fields có `meta.system` cho
  field hệ thống (CHK099).
- Màn không tìm thấy: `ContentNotFound` 014 thêm `module: 'settings'` vào union và bảng `NAVIGATION`.

**Phương án bỏ**: giữ `placeholderRoutes` và chèn route thật lên trên (route `:pathMatch(.*)*` của khung nuốt
`settings-not-found` của Directus); viết màn item riêng không qua `use-item` (mất `SaveOptions`, `use-edits-guard`,
Revisions).

## R3. Cây collection và lưới field kéo thả (D-96)

**Quyết định**:

- `BoSortableList` (013, D-60) đã có `nested`, `tree`, `group`, `itemDisabled`, `rowActions`, emit `indent`/`outdent`
  (menu "indent_item"/"outdent_item"). Cây collection: một `BoSortableList group="collections"` ở gốc và một trong mỗi
  `CollectionItem` có con (`nested`), `handle=".drag-handle"`, `swapThreshold 0.3`; `indent` = vào folder liền trước,
  `outdent` = ra nhóm cha → cùng `onSort` → `PATCH /collections` mảng (không chờ, Clarifications 2026-10-16).
  Lưới field: `BoSortableList group="fields"` ở gốc với lớp grid (`half`/`full`/`fill`) và một trong mỗi `FieldSelect`
  group; `indent`/`outdent` = vào/ra group. [Unverified] `BoSortableList` lồng hai cấp với cùng `group` cho phép thả vào
  danh sách rỗng của group (vuedraggable cần vùng thả tối thiểu: `min-h`); kiểm T002 bằng browser test, thiếu thì thêm
  prop `emptyDropZone`.
- Trạng thái gập: `useExpandCollapse` chép, khóa `backoffice-collapsed-collection-ids` qua `useLocalStorage` của
  @vueuse (012 dùng cho `collapsed`).
- Bề rộng dòng field: class `col-span-1` (half) / `col-span-2` (full, fill) trên grid 2 cột, dưới 600 px 1 cột (như form
  grid 013); `fill` khác `full` chỉ ở form item (013 đã có), ở lưới chỉ là nhãn. Cuộn tự động khi kéo xa dùng `scroll:
  true` mặc định của Sortable trong vùng cuộn của màn (CHK087).

**Phương án bỏ**: vuedraggable trực tiếp trong màn (mất menu bàn phím D-69/D-96 và test có sẵn); thư viện tree.

## R4. Đăng ký 18 interface `_system`, options component, `ExtensionOptions`

**Quyết định**:

- Registry 013 nạp `./_system/*/index.ts` bằng `import.meta.glob` nên chỉ cần thêm thư mục; `registry.test.ts` so với
  fixture `fixtures/interfaces/directus-registry.json` (`optionsKind`, `system`) [Unverified] fixture đã chứa 28
  `_system` (sinh từ Directus) hay chỉ phần đã port; thiếu thì chạy lại `scripts/extract-directus-registry.mjs`.
- `ExtensionOptions.vue` (chép `shared/extension-options.vue`): nhận `type: 'interface'|'display'`, `extension`,
  `showAdvanced`, `options` (model), `disabled`; tính `usableOptions` từ `config.options`: mảng → tất cả là `standard`;
  `{standard, advanced}` → hai `BoForm`; hàm → gọi với ngữ cảnh store (`fieldDetail` state) rồi xử lý như trên;
  `null`/`undefined` → notice `no_options_available`; nếu có component `options` (chỉ 4 cái: `list`, `map`, 2 interface:
  `list`, `map`; display `translations`, `related-values` có options dạng hàm, đã kiểm T002) → vẽ component với `value`,
  `collection`, `field`, `interface`/ `display`, emit `input`. 013 đã giữ nguyên `options` (comment
  `interfaces/types.ts`), nên hàm options gọi được với state store cùng hình dạng Directus (`field`, `editing`,
  `collection`, `relations`, `collections`, `fields`, `items`, `localType`, `autoGenerateJunctionRelation`, `saving`,
  `loading`).
- Options component: thêm vào `index.ts` của `list`, `map` trường `options: OptionsComponent` (như Directus: `options:
  InterfaceListOptions`) [Unverified] 013 có giữ khóa `options` dạng component là `null` (D-56) → đổi sang component,
  cập nhật fixture `optionsKind`.
- `system-interface-options` và `system-display-options` dùng `ExtensionOptions` (Directus cũng vậy); chế độ
  `isConditionOptions` truyền `batchMode` cho `BoForm` (013 có `batchMode` từ `DrawerBatch`).
- Ảnh xem trước thẻ interface (CHK001): `scripts/extract-directus-registry.mjs` chép `preview` SVG (`?raw`) của mọi
  interface Directus vào `index.ts` 013 dạng chuỗi; thiếu thì icon. Fixture `directus-registry.json` sinh lại: diff chỉ
  được thêm 18 `_system`, 4 `optionsKind: component`, `preview`; test registry 013 cập nhật cùng commit (CHK102).
- `system-theme` 015 thêm option `appearance` (`light|dark`) như `index.ts` Directus (CHK065).

**Phương án bỏ**: viết form options riêng cho từng interface (Directus không làm; 013 giữ dữ liệu chính vì lý do này).

## R5. Dữ liệu tĩnh chép từ Directus (quyền tối thiểu, quyền gợi ý)

**Quyết định**: `apps/web/scripts/sync-permissions-data.mjs` (jiti, như `sync-theme-presets.mjs`) đọc
`directus/packages/system-data/src/app-access-permissions/{app-access-permissions,schema-access-permissions}.yaml`
(js-yaml của repo root dev deps) và import `directus/app/src/app-permissions.ts` (`appRecommendedPermissions`,
`editablePermissionActions`), ghi `src/permissions/app-permissions-data.json` `{ minimal: Permission[], recommended:
Permission[], actions: string[] }` với `policy: null`, `system: true` cho minimal như `appAccessMinimalPermissions` của
Directus (`directus/packages/system-data/src/app-access-permissions/ index.ts`: gộp hai yaml, mặc định `permissions {}`,
`validation null`, `presets null`, `fields ['*']`). Test `app-permissions-data.test.ts` chạy lại script ra file tạm và
so. `MODULE_BAR_DEFAULT` đã có ở `constants.ts` 012 (không sinh). Target Nx `web:sync-permissions-data`.
`app-permissions.ts` chỉ import kiểu `Permission` của `@directus/types` (đã kiểm T002) (jiti bỏ qua type import) — kiểm
T002.

**Phương án bỏ**: import `@backoffice/system-data` (Node, js-yaml, R1); chép tay JSON (lệch khi Directus đổi; không
test được).

## R6. Lưu role và policy với quan hệ lồng; ma trận không ghi `/permissions`

**Quyết định**: giữ đúng Directus: `list-m2m`/`list-o2m` của 013 phát `{create, update, delete}` vào `edits.policies`,
`edits.users`, `edits.roles`; `system-permissions` phát `{create, update, delete}` vào `edits.permissions`; `useItem.
save()` gửi một `PATCH /roles/:id` hoặc `PATCH /policies/:id`. API mới (004, ItemsService + PayloadService port) xử lý
quan hệ lồng như Directus. [Unverified] T002: tạo policy ở app mới với 3 permission (create/update/delete lồng) và so
`directus_permissions` với Directus app; `PATCH /access` song song của trang Public. Lệch → lỗi API, mở issue sửa ở
`apps/api` (parity 004), FE không đổi body.

Hộp tạo policy gửi `POST /policies` rồi `POST /permissions` mảng (Directus làm hai request, không lồng) — giữ. Body mỗi
dòng là `{...permission, policy}` của `appAccessMinimalPermissions` nên gồm `system: true` (đã kiểm, CHK047). T004
(CHK097): tạo policy có permission lồng ở API mới, so DB với Directus app; lệch → task sửa `apps/api` trong lượt 3 kèm
parity 004.

**Kết quả T004 (2026-10-16)**: `apps/web-e2e/src/payload/nested-save.spec.ts` gửi cùng chuỗi `PATCH /policies/:id`
(tạo hai permission, gán role), `PATCH /policies/:id` (sửa một, xóa một), `PATCH /roles/:id` (gỡ policy) tới 8155 và 8156;
thay đổi DB bằng nhau. T075 không cần.

**Phương án bỏ**: FE tự gọi `/permissions` từng dòng (khác Directus, bộ so payload đỏ, mất tính nguyên tử phía API).

## R7. Store field (`fieldDetail`) và alteration

**Quyết định**: chép `field-detail/store/index.ts`, `types.ts`, `alterations/*.ts`, `utils/*.ts` gần như nguyên (đổi
import store 012, `api` → `sdk`, `getEndpoint` của `@directus/utils`, notification → `showUnexpectedError` của 014);
`defineStore('fieldDetail')` Pinia như Directus; test port `store/index.test.ts` (Directus có sẵn) chạy trong `unit`.
Hai lỗi quan sát ở `translations.ts` (dòng 362 gán chuỗi vào `relations.o2m.meta`, dòng 291 đọc `relations.o2m.
sort_field`) chép nguyên để kết quả DB giống Directus; T002 so dòng `directus_relations` của field translations tạo ở
hai app; nếu Directus thật ghi `meta.sort_field` thì sửa theo DB và ghi R-xx. `save()` giữ thứ tự sáu bước và cách
nuốt lỗi (R-40).

Hàm ghi store (chép từ `stores/{collections,fields,relations}.ts` Directus): `collections.upsertCollection`,
`updateCollection`, `deleteCollection`; `fields.upsertField`, `updateField`, `updateFields` (mảng, lạc quan + hoàn tác,
chỉ áp response mới nhất bằng bộ đếm), `deleteField`; `relations.upsertRelation`. [Unverified] store 012 có dòng hệ
thống trong `collections` (cho mục "collection hệ thống") và `fields` có `meta.system` (Directus `GET /fields` trả field
hệ thống có `meta.system true`); kiểm T002. `updateFields` giữ một bộ đếm "response mới nhất" chung (biến module-level
`currentUpdate` của Directus `stores/fields.ts:68`, đã kiểm T002, CHK041).

**Phương án bỏ**: viết lại store theo `use-item` (R2); gộp alteration thành một hàm (mất test port).

## R8. Ma trận quyền và drawer chi tiết

**Quyết định**: chép `system-permissions/*` (`system-permissions.vue`, `permissions-header.vue`, `permissions-row.vue`,
`permissions-toggle.vue`, `add-collection/*`, `detail/permissions-detail.vue`,
`detail/components/{tabs,actions,app-minimal,permissions,fields,validation,presets}.vue`) và
`app/src/app-permissions.ts` dùng JSON của R5: bảng `<table>` với `<caption>` sr-only, chip là `BoMenu` trigger `button
aria-haspopup` (mức đọc được: sr-only "all/none/custom"); drawer `BoDrawer` với `BoTabs orientation="vertical"` (013 chỉ
có tab ngang, đã kiểm 2026-10-16; 016 thêm prop `orientation` của Reka Tabs và test phím mũi tên lên/xuống; ở 768 px tab
dọc thành tab ngang cuộn được, CHK053, CHK098); tab Fields dùng `BoCheckboxTree` 013 với `useFieldTree` tách (R9 của 014
đã có logic trong `FieldList.vue`); tab Permissions/Validation dùng `system-filter` 014 với `includeValidation`,
`includeRelations`; tab Presets dùng `input-code` 013 (`language json`). `admin_access`/`app_access` đọc từ
`inject('values')` của `BoForm` (có từ 013). Lỗi so sánh `item.action === perm.collection` của Directus chép nguyên (kết
quả hiển thị không đổi).

**Phương án bỏ**: bảng dạng card hay accordion (khác Directus, SC-004 (a)); drawer tab ngang (Directus dọc; Q-23).

## R9. Kiểm thử: E2E ba cấu hình, bộ so payload, bộ so DB, dùng chéo

**Quyết định**: như 014/015 (`contracts/tests.md`). Mới ở 016: (a) bộ so DB mở rộng `helpers/db-rows.ts`
(`snapshot(['directus_collections','directus_fields','directus_relations','directus_permissions','directus_access',
'directus_policies','directus_roles','directus_presets','directus_translations','directus_settings'])`, chuẩn hóa
`id`, `sort` tự tăng của `directus_fields`, thời gian); (b) kịch bản dùng chéo `settings-cross-use.spec.ts` trong
`DIRECTUS_APP_SPECS` ở `proxy-api`: tạo data model ở app mới → `onDirectusApp` mở `/admin/content/bo_articles/+`, điền
10 field (helper `field(page, label)` của 015), lưu → `GET /items/bo_articles` qua API mới; tạo role/policy ở app mới →
tạo user qua API → đăng nhập user ở Directus app và app mới (context riêng) → 6 thao tác; chiều ngược lại tạo bằng
`directusApi` rồi mở ở app mới. Dọn bằng `DELETE /collections/bo_articles*` và `DELETE /roles`, `/policies` ở
`afterAll`. [Unverified] `DIRECTUS_APP_SPECS` là danh sách tên file trong `playwright.config.ts`; thêm spec.
Hai thao tác DDL thật (tạo collection, field) chạy tuần tự trong worker 1 (như parity DDL 006).

**Phương án bỏ**: so chỉ payload (không chứng minh "dùng được trên Directus"); seed tạo bằng SQL (không qua API, khác
Directus).

## R10. i18n

**Quyết định**: mọi khóa của màn Settings (`settings_data_model`, `creating_new_collection`, `collection_setup`,
`optional_system_fields`, `fields_and_layout`, `saves_automatically`, `create_in_advanced_field_creation_mode`,
`interface_group_*`, `schema_setup_key`, `permissionsLevel.*`, `reset_system_permissions_to`, `interfaces.system-*.*`,
`no_layout_collection_selected_yet`, `translation_key_placeholder`…) có trong `en-US.yaml` và `vi-VN.yaml` sinh ở 012.
Không overlay mới: chữ "Backoffice" của D-95 là hằng (tên sản phẩm). [Unverified] `vi-VN.yaml` thiếu khóa nào thì
`missing-key` làm E2E đỏ → T002 chạy `keys.test.ts` với danh sách khóa của 016.

## R11. Năm lượt commit (FR-112)

**Quyết định**: lượt 1 route + sub-menu + danh sách collection + màn collection + lưới field + hàm ghi store + 5
interface (`system-collection`, `system-field`, `system-field-tree`, `system-display-template`,
`system-collections-translations`) + `use-field-tree` tách; lượt 2 drawer field (store, alteration, 2 chế độ, 7 tab),
`ExtensionOptions`, 2 options component (`list`, `map`), 7 interface (`system-interface`, `system-interface-options`,
`system-display`, `system-display-options`, `system-fields`, `system-inline-fields`, `system-collections`,
`system-manual-flow-select`); lượt 3 roles, policies, `system-permissions`, dữ liệu tĩnh R5; lượt 4 project, appearance,
presets, translations, `system-owner`, `system-modules`, `system-folder`, `system-scope`; lượt 5 bộ so payload, bộ so
DB, dùng chéo, parity UI, perf, bundle, tài liệu. Mỗi lượt: recipe nháp → code → test → E2E → commit lên `main` với CI
xanh; lượt 1 bắt đầu sau khi 015 báo đóng (FR-111). Mỗi lượt nhắn session 015 (hoặc session đang chia sẻ checkout) trước
và sau push.

T001 (2026-10-16): session 015 nhắn "016 can start implementing now" (theo yêu cầu của user, theo lời session đó): code
015 đã push (HEAD `6b3fdaa`), ba job `e2e-web` xanh ở run 38872164807 (`53f0d47`; run có job khác đỏ do lỗi ngẫu
nhiên); run 38881347877 còn chạy cho các job chập chờn. 016 nhận env `parity-postgres` và dev server 4200; session 015
chỉ sửa file test của job đỏ và nhắn trước mỗi push. `CLAUDE.md` thêm dòng Active Technologies của 016.

## R12. Hiệu năng và bundle

**Quyết định**: chunk lười theo route (`() => import`); drawer field (store + tab + alteration) là chunk riêng nạp khi
mở route `:field`; `system-permissions` + JSON quyền là chunk riêng (nạp ở trang policy); trình sửa preset dùng chunk
layout của 014. `BUDGET_016 = BUDGET_015 + 20 KB`; `LAZY_BUDGETS_016`: drawer field ≤ 80 KB, ma trận ≤ 40 KB, JSON
quyền ≤ 10 KB gzip. Perf test `modules/settings/perf.browser.test.ts` với `machineFactor()` (014) cho bốn phép đo
FR-108; số request đếm bằng `KNOWN_REQUESTS` của `test-utils/fetch.ts`.

**Phương án bỏ**: nạp sẵn store field trong chunk chính (vượt ngân sách).

## R13. Mở rộng component của 013 và 015

**Quyết định**: `BoInput` thêm prop `dbSafe` theo `v-input.vue` (spec FR-007: keydown chỉ `a-z0-9_` và khoảng trắng;
input thay khoảng trắng bằng `_`, bỏ dấu NFD, xóa ký tự ngoài `[a-zA-Z0-9_]`); `BoTabs` thêm `orientation` (R8);
`system-theme` thêm option `appearance` (R4); registry 013 thêm `preview` (R4). Mỗi mở rộng chỉ thêm prop tùy chọn, test
của 013 và 015 giữ xanh.

**Phương án bỏ**: component riêng `BoDbSafeInput` (trùng `BoInput`, khác Directus vốn là prop của `v-input`).

## Kết quả kiểm T002 (2026-10-16, đọc mã nguồn, chưa chạy thử)

| Mục | Kết quả | Sửa ở |
|-----|---------|-------|
| `useItem` với `directus_collections` | `getEndpoint` cho `/collections`; store collections nạp `GET /collections` gồm `directus_*` (`systemCollections`) | không đổi |
| Field hệ thống | store fields nạp `GET /fields` gồm field `meta.system` | không đổi |
| `BoSortableList` lồng | có `nested`, `group`, `indent`/`outdent`; danh sách rỗng có `min-h-3` khi có `group` (vùng thả tối thiểu) | không đổi; browser test ở T031, T040 |
| Registry fixture | 49 interface, 9 `_system` (của 013–015); `list`, `map` đã là `optionsKind: component`; display `translations`, `related-values` là `function` (không có `options.vue`) | spec FR-037, FR-038, FR-104; R4; T053, T060 |
| `app-permissions.ts` | ở `directus/app/src/app-permissions.ts`, chỉ import kiểu `Permission` | R5, T016, contracts |
| Ma trận quyền Directus | thêm `permissions-header.vue`, `add-collection/*`, `detail/components/*` | R8, plan, contracts, T076, T077 |
| `DIRECTUS_APP_SPECS` | biểu thức trong `apps/web-e2e/playwright.config.ts` | T116 |
| i18n | 145 khóa của spec có trong `en-US`; 49 khóa thiếu ở `vi-VN.json` (bản dịch Directus chưa có) và rơi về `en-US` không cảnh báo như Directus | R10 (không overlay) |
| Nhân bản field trùng tên | hộp nhân bản còn mở, hộp lỗi hiện trên (`FieldSelect.vue:173-185`) | FR-024 |
| Helper bật translations | mặc định và quy tắc field đủ điều kiện (`system-collections-translations-dialog.vue`, `utils.ts:16-29`) | FR-028 |
| Field không có / `?type=` lạ | Directus ném lỗi JavaScript không bắt | FR-030, D-97 |
| `autoKey` | `split('-')[1]` + `nanoid(6)` chữ thường (`field-configuration.vue:66-71`) | FR-033 |
| Thứ tự `save()` | tuần tự `for…of`/`await`; khóa theo khai báo state | FR-041 |
| Role 404 | form rỗng, không hộp lỗi, nút xóa khóa | FR-052 |
| Link `module_bar` | không lọc scheme (`module-bar.vue:30-34`) | FR-074 |
| `directus_translations` | không unique (`key`, `language`) | FR-086 |
| `parent` vòng của role | API từ chối (`validateRoleNesting`, Directus và `apps/api`) | Edge Cases |
| `system-field` giá trị cũ | hiện key thô, không notice | Edge Cases |
| `updateFields` | một bộ đếm chung | FR-022, data-model §5 |
| `refreshCurrentLanguage` | `loadTranslations(userStore.language)` rồi `fieldsStore.hydrate()`; lỗi chỉ `console.error`; store translations 012 đã có `loadTranslations` | FR-086, T107 |

Mục release-gate có lời giải đổi theo kết quả này (đã sửa spec cùng lúc nên giữ `[x]`): CHK007, CHK010, CHK014, CHK022,
CHK040, CHK041, CHK075, CHK076, CHK086.
