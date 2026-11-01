# Contract: Web (D-206)

Chỉ trang Content (`/content/<collection>`: bộ lọc page header, bookmark). Không màn mới, không route mới.

## Prop `includeFieldCompare`

| Component | Thay đổi |
|-----------|----------|
| `components/SearchInput.vue` | prop `includeFieldCompare` (mặc định false) → `SystemFilter` |
| `interfaces/_system/system-filter/SystemFilter.vue` | prop → `Nodes` (hai chỗ như `includeJsonPath` :254, :292) |
| `interfaces/_system/system-filter/Nodes.vue` | prop → `InputGroup` (:642) và `Nodes` đệ quy |
| `interfaces/_system/system-filter/InputGroup.vue` | nút chọn field + chip (dưới) |
| `interfaces/_system/system-filter/InputComponent.vue` | `isValueValid`: `$FIELD(...)` hợp lệ ở mọi kiểu |
| `modules/content/routes/CollectionRoute.vue` (:426) | `include-field-compare` |
| `components/drawers/DrawerCollection.vue` (:216) | không (FR-013) |

## `InputGroup.vue` (ô giá trị của một dòng lọc)

Điều kiện hiện (`canCompareField`): `includeFieldCompare` ∧ toán tử ∈ `_eq _neq _gt _gte _lt _lte` ∧
`fieldCompareGroup(fieldInfo.type) != null`.

| Trạng thái | Hiện | Hành vi |
|------------|------|---------|
| giá trị thường hoặc rỗng | `InputComponent` như nay + nút icon `swap_horiz` (`size-6` tròn, `aria-label` `field_compare`, `title`) | bấm/Enter mở BoMenu: `field_compare_value` (giữ nhập giá trị) rồi các field cùng nhóm của collection của field a (tên hiển thị, `(key)` khi trùng tên; `rawFieldNames` → key), trừ field a, trừ alias; chọn → `value = $FIELD(key)` |
| giá trị `$FIELD(b)`, b có trong collection | chip button `font-mono text-brand-500` với tên hiển thị của b, `aria-label` `field_compare_with` | bấm mở cùng BoMenu; `field_compare_value` → `value = null` và focus về ô nhập |
| giá trị `$FIELD(b)`, b không còn | chip `text-error-500`, `aria-invalid`, text key thô, `title` `field_compare_missing` | bấm mở BoMenu để chọn lại |
| gõ tay `$FIELD(b)` vào ô nhập | ô nhận (không `aria-invalid`), emit, chip hiện ở lần render sau | — |

Bàn phím: nút và chip là `button`, Tab tới được, Enter/Space mở menu, mũi tên trong BoMenu, Esc đóng; focus về nút/chip
khi đóng. Không màu mới: `brand-*`, `gray-*`, `error-*` của theme.

## `utils/field-compare.ts` (mới)

```ts
export const FIELD_COMPARE_OPERATORS = ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte'];
export function parseFieldCompare(value: unknown): string | null;   // cùng regex với API
export function formatFieldCompare(field: string): string;          // `$FIELD(${field})`
export function fieldCompareGroup(type: string): FieldCompareGroup | null; // bảng data-model
```

## i18n (`lang/overlay/en-US.ts`, `vi-VN.ts`)

| Key | en-US | vi-VN |
|-----|-------|-------|
| `field_compare` | Compare with a field | So với field khác |
| `field_compare_with` | Compared with {field} | So với {field} |
| `field_compare_value` | Enter a value | Nhập giá trị |
| `field_compare_missing` | Field {field} not found | Không có field {field} |

## Design-system

Recipe Q-7 (`design-system/docs/component-specs.md:1317`) thêm gạch đầu dòng "Field compare (spec 028, D-206)": nút
icon cùng lớp với nút `{{ }}`, chip như chip field của dòng lọc, BoMenu; không component mới. Chủ dự án (design owner)
chốt ở analyze.
