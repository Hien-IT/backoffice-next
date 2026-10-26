# Contract: web (D-187)

## Prop `includeJsonPath` (boolean, mặc định `false`)

| Component | Nhận từ | Truyền tới | Khi `true` |
|-----------|---------|------------|------------|
| `components/FieldList.vue` | SystemFilter, Nodes | — | hàng hàm `json` của field json hiện với nhãn `$t('json_path')` (`JSON path (Transaction Data)`); emit `json(<key>)` (placeholder, không path). Khi `false`: không có hàng `json` (hết `functions.json` gây 400); hàng `count` giữ |
| `interfaces/_system/system-filter/SystemFilter.vue` | SearchInput, options của interface | FieldList (L236), Nodes (L199) | nhận placeholder `json(<key>)` → đổi nội dung popover sang `JsonPathForm`; Apply hợp lệ → `addNode('json(<key>, <path>, <type>)')` với toán tử đầu của kiểu |
| `interfaces/_system/system-filter/Nodes.vue` | SystemFilter | FieldList (L444), node đệ quy (L556) | chip field của hàng json là nút mở `JsonPathForm` điền sẵn; Apply → `replaceNode` key mới (đổi kiểu: toán tử về đầu danh sách, giá trị xóa). Khi `false`: chip hàng json chỉ đọc |
| `components/SearchInput.vue` | CollectionRoute, DrawerCollection | SystemFilter (L225) | — |
| `modules/content/routes/CollectionRoute.vue:417`, `components/drawers/DrawerCollection.vue:203` | — | SearchInput | `:include-json-path="true"` |

Không bật: `ExportSidebarDetail` (bộ lọc export), Files, Users, Activity, Notifications, Presets, Translations,
Insights, Roles, Policies, Data Model, FieldDetail, `PermissionsTab`, `ValidationTab`, `AdvancedValidation`,
`AdvancedConditions`, `PresetItemRoute`, panel Insights, options interface quan hệ/file. Hàng json đã lưu vẫn hiển thị
và giữ được ở mọi chỗ (hiển thị không gate).

## `JsonPathForm.vue` (`interfaces/_system/system-filter/`, mới)

| Prop / emit | Kiểu | Ghi chú |
|-------------|------|---------|
| `field` | string | key field (có thể `author.meta`) để hiện tiêu đề `Field › ...` |
| `path`, `type` | string, `'text' \| 'number' \| 'boolean'` | giá trị ban đầu (`''`, `'text'` khi thêm) |
| `update:path`, `update:type` | — | `modelValue` chuẩn component-specs |
| `apply` | `{ path, type }` | chỉ emit khi `jsonPathError(path) === null` |
| `back` | — | quay lại danh sách field (chỉ khi thêm) |

Bố cục: recipe Input (`BoInput` `label=$t('json_path')`, `error=$t('json_path_invalid')` khi sai, `aria-describedby`,
`role=alert`, `autofocus`) + recipe Select (`BoSelect` `label=$t('type')`, 3 mục `json_path_type_*`) + nút text Apply,
trong popover Q-7 `w-80`. Bàn phím: Tab giữa path, kiểu, Apply; Enter trong ô path = Apply; Esc đóng popover (hành vi
popover hiện có). Chỉ class token theme (`gray-*`, `brand-*`, `error-*`), không hex.

## Hàng điều kiện json (`Nodes.vue`)

| Phần | Nội dung |
|------|----------|
| chip field | `Transaction Data › Amount (Number)`; qua m2o `Order → Transaction Data › Amount (Number)` |
| toán tử | danh sách của `jsonFilterType(type)`: Text như chuỗi, Number như số, Boolean như boolean |
| giá trị | InputGroup với field giả `{ type: 'string' \| 'float' \| 'boolean' }` → ô nhập chuỗi, số (chuỗi, API ép), toggle boolean |
| nhóm, kéo thả, menu, xóa | như hàng khác |

## `apps/web/src/utils/json-path.ts` (mới)

```ts
export type JsonPathType = 'text' | 'number' | 'boolean';
export function parseJsonPathKey(key: string): { field: string; path: string; type: JsonPathType } | null; // null nếu không phải json(...) hoặc là placeholder không có path
export function formatJsonPathKey(field: string, path: string, type: JsonPathType): string; // `json(${field}, ${path}, ${type})`
export function jsonPathError(path: string): string | null;  // rỗng, ngoặc vuông không cân, `[*]` > 1, ký tự `?@$`, depth > 10 → khóa i18n `json_path_invalid`
export function jsonFilterType(type: JsonPathType): 'string' | 'float' | 'boolean';
```

## `system-filter/utils.ts`

`splitFieldPath(key)` tách `.` ngoài ngoặc; `getField`, `getComparator`, `fieldToFilter` và mọi `get`/`set` trong
`SystemFilter.vue`, `Nodes.vue`, `InputGroup.vue` dùng path mảng. Key cũ (`title`, `author.name`, `year(date)`,
`a.count(b)`) cho kết quả như trước.

## i18n (`apps/web/src/lang/overlay/{en-US,vi-VN}.ts`, `// Spec 023 (D-187)`)

| Khóa | en-US | vi-VN |
|------|-------|-------|
| `json_path` | JSON path | Đường dẫn JSON |
| `json_path_type_text` | Text | Chữ |
| `json_path_type_number` | Number | Số |
| `json_path_type_boolean` | Boolean | Đúng/Sai |
| `json_path_invalid` | Invalid JSON path | Đường dẫn JSON không hợp lệ |
| `json_path_apply` | Apply | Áp dụng |

Khóa base `type` ("Type"/"Kiểu") dùng cho nhãn select. Khóa nào base đã có thì không thêm (overlay test cấm trùng).

## design-system

`docs/component-specs.md` mục Q-7 thêm gạch đầu dòng "JSON path form": bước 2 của popover bộ lọc, link quay lại, ô
path có nhãn và lỗi liên kết, select kiểu, nút Apply; dùng recipe Input và Select. Không màu mới → `migration-guide.md`
không đổi.
