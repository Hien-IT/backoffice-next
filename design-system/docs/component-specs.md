# Component specifications

Vue 3 + Reka UI + Tailwind CSS 4 with the TailAdmin theme (`tokens/theme.css`). The recipes below are **final**: copy
them as they are. They start from the TailAdmin Vue sources (commit `6d5a365`, MIT, see `../LICENSE-TailAdmin.md`; the
source file is named for each component) with the owner decisions of 2026-10-15 applied (`migration-guide.md`,
Decisions): every text pair reaches 4.5:1, every input boundary and focus indicator reaches 3:1, and every interactive
element has the focus-visible recipe. "Changed" lines say what differs from TailAdmin so reviewers do not "fix" it back.

## Conventions

- Vue 3 SFC with `<script setup lang="ts">`; typed `defineProps` / `defineEmits`.
- Interactive behaviour comes from Reka UI primitives (Select, Checkbox, Switch, DropdownMenu, Dialog, Tooltip, Popover
  ...). TailAdmin's hand-made versions (hidden `sr-only` checkbox + styled div, `v-if` dropdown with click-outside,
  `fixed` div modal) are visual references only. Check exports against the installed `reka-ui` (2.8.2 at the time of
  writing).
- Form components: `modelValue` / `update:modelValue`.
- States, where they apply: default, hover, focus-visible, active/checked, disabled, invalid (error), loading, empty.
- Keyboard: every action works without a mouse; order follows the visual order; Esc closes overlays.
- Labels: every control has a visible `<label for>` (or `aria-labelledby`); hint and error text are linked with
  `aria-describedby`; invalid controls get `aria-invalid="true"`; required fields get `required` / `aria-required` and
  the visible `*` is `aria-hidden`.
- Never convey state by color alone: status, validation and selection also have text or an icon shape.
- Theme classes only (README, Rules). Every recipe includes its `dark:` classes.
- Disabled controls are exempt from contrast (WCAG); they keep the TailAdmin disabled colors.
- TailAdmin writes `dark:bg-dark-900` and `hover:text-dark-900`: not theme colors, no effect. Do not copy them.

### Focus-visible recipe (all interactive elements)

`FOCUS` below means:

```text
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400
```

Error controls use `FOCUS_ERROR`:

```text
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400
```

brand-500 is ≥ 4.63:1 on white and gray-50, brand-400 ≥ 5.12:1 on gray-900, gray-800 and gray-dark. The `menu-item` and
`menu-dropdown-item` utilities in `theme.css` already include `FOCUS`. Text inputs also get `focus:outline-hidden` so
mouse focus shows only the border change.

### Shared form classes

`FIELD` (input, select trigger, textarea):

```text
w-full rounded-lg border border-gray-500 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 FOCUS dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 dark:focus:border-brand-400
```

- `FIELD_INVALID` (replaces the border/focus/FOCUS part):
  `border-error-600 focus:border-error-600 focus:ring-error-500/10 FOCUS_ERROR dark:border-error-400 dark:focus:border-error-400`
- `FIELD_VALID`:
  `border-success-600 focus:border-success-600 focus:ring-success-500/10 dark:border-success-400 dark:focus:border-success-400`
  (+ `FOCUS`)
- `FIELD_DISABLED`:
  `disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder:text-gray-300 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] dark:disabled:placeholder:text-white/15`
- Label: `mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400`; disabled label
  `text-gray-300 dark:text-white/15`
- Required mark: `<span class="text-error-600 dark:text-error-400" aria-hidden="true">*</span>`
- Hint: `mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400`
- Error message: `mt-1.5 text-theme-xs text-error-600 dark:text-error-400`
- Success message: `mt-1.5 text-theme-xs text-success-700 dark:text-success-400`
- Changed from TailAdmin: border gray-300/dark gray-700 → gray-500 (C-2); focus border brand-300/brand-800 →
  brand-500/brand-400; placeholder gray-400 / white/30 → gray-500 / gray-400; error and success text 500 → error-600 /
  success-700 (dark error-400 / success-400); invalid border error-300 → error-600; valid border success-300 →
  success-600.

## Tiers

- **Tier 1 (generic controls, this document):** Button, Input, Select, Checkbox, Toggle, Textarea, Badge, Alert,
  Dropdown menu, Modal, Avatar, Table, Card, Breadcrumb, Tooltip. Also Radio, Popover, Pagination (to specify when first
  needed, same rules).
- **Tier 2 (composed patterns):** app shell (`layout-patterns.md`), page header, filter bar, data table with
  sorting/selection/pagination, detail panel, form layout, empty and error pages, file upload.
- **Tier 3 (domain, Directus parity):** interfaces and displays per field type, layouts (table, cards, calendar, map
  ...), revisions and comments, flow editor, insights panels. These follow the Directus behaviour and are open questions
  in their feature spec when TailAdmin has no pattern.

## Tier 1 recipes

### Button (`ui/Button.vue`)

- Base: `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition FOCUS`
- Sizes: `sm` → `px-4 py-3 text-sm`; `md` → `px-5 py-3.5 text-sm`; compact (modal footers) → `px-4 py-2.5 text-sm`
- Primary: `bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300`
- Outline:
  `bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300`
  (the label identifies the button, so its ring is not a required boundary)
- Danger (B-1): `bg-error-600 text-white shadow-theme-xs hover:bg-error-700 disabled:bg-error-300` + `FOCUS_ERROR`
  instead of `FOCUS` (white on error-600 4.83:1, on error-700 6.57:1)
- Status-colored solid buttons, if ever needed: only `bg-success-700`, `bg-warning-700`, `bg-blue-light-700` with white
  text (≥ 5.41:1); never the 500 shades with white text.
- Disabled: native `disabled` + `cursor-not-allowed opacity-50`
- Loading: disabled + `aria-busy="true"` + spinner (`animate-spin`, `aria-hidden`) before the kept label
- Icons: start/end icon in `span.flex.items-center`, `aria-hidden`; icon-only buttons need `aria-label`; default
  `type="button"`.

### Input (`forms/FormElements/DefaultInputs.vue`, `InputState.vue`)

- Input: `h-11 FIELD` (+ `FIELD_DISABLED`); invalid: `h-11` + `FIELD` with `FIELD_INVALID`; valid: with `FIELD_VALID`
- State icon (error/success): `absolute end-3.5 top-1/2 -translate-y-1/2`, `text-error-600 dark:text-error-400` /
  `text-success-600 dark:text-success-400`, `aria-hidden` (the message carries the meaning); input gets `pe-10`
- Trailing button (password eye): input `pe-11`; `<button type="button" aria-label="Show password" aria-pressed>` with
  `absolute end-4 top-1/2 -translate-y-1/2 rounded text-gray-500 dark:text-gray-400 FOCUS`
- Search (header): `h-11 FIELD ps-12 pe-14 xl:w-[430px]` with a `sr-only` label; leading icon
  `text-gray-500 dark:text-gray-400`.

### Select (`forms/FormElements/SelectInput.vue`, example `components/SelectField.vue`)

- Reka `SelectRoot` / `SelectTrigger` / `SelectValue` / `SelectPortal` / `SelectContent` / `SelectViewport` /
  `SelectItem` / `SelectItemText` / `SelectItemIndicator`
- Trigger:
  `flex h-11 items-center justify-between gap-2 text-start FIELD data-[placeholder]:text-gray-500 dark:data-[placeholder]:text-gray-400`
  (+ `FIELD_INVALID` / `FIELD_DISABLED`); chevron 20px `text-gray-500 dark:text-gray-400`, `aria-hidden`
- Content:
  `z-99999 min-w-(--reka-select-trigger-width) max-h-(--reka-select-content-available-height) overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark`,
  `position="popper"`, `side-offset` 4; viewport `custom-scrollbar`
- Item:
  `relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 outline-hidden data-[highlighted]:bg-gray-100 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-600 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-300 dark:data-[highlighted]:bg-white/5 dark:data-[state=checked]:bg-brand-500/15 dark:data-[state=checked]:text-brand-400 dark:data-[disabled]:text-white/15`;
  checked item shows a check icon (`SelectItemIndicator`)
- Empty: `px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400` "No options".

### Checkbox (`forms/FormElements/CheckboxInput.vue`)

- Reka `CheckboxRoot` + `CheckboxIndicator`; label row
  `flex items-center gap-3 text-sm font-medium text-gray-700 cursor-pointer select-none dark:text-gray-400`
- Box:
  `flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.25px] border-gray-500 bg-transparent hover:border-brand-500 FOCUS data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500 data-[state=indeterminate]:border-brand-500 data-[state=indeterminate]:bg-brand-500 dark:border-gray-500 dark:hover:border-brand-400`
- Indicator: white check (14px, stroke 1.94) or a dash for indeterminate, `text-white`
- Invalid: box `border-error-600 dark:border-error-400` + `FOCUS_ERROR`, message linked
- Disabled: label `text-gray-300 dark:text-gray-700`; box
  `data-[disabled]:border-gray-200 data-[disabled]:bg-transparent dark:data-[disabled]:border-gray-800`, check
  `text-gray-200 dark:text-gray-800`
- Changed from TailAdmin: unchecked border gray-300 / gray-700 → gray-500.

### Toggle (`forms/FormElements/ToggleSwitch.vue`)

- Reka `SwitchRoot` (`role="switch"`) + `SwitchThumb`; label row
  `flex cursor-pointer select-none items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-400`
- Track:
  `relative inline-flex h-6 w-11 shrink-0 rounded-full bg-gray-500 data-[state=checked]:bg-brand-500 FOCUS dark:bg-gray-500 dark:data-[state=checked]:bg-brand-500`
- Thumb:
  `block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-theme-sm transition-transform duration-300 ease-linear data-[state=checked]:translate-x-[22px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[22px] motion-reduce:transition-none`
  (top offset via `items-center` on the track)
- Disabled: label `text-gray-400`; track `data-[disabled]:bg-gray-100 dark:data-[disabled]:bg-gray-800` (checked keeps
  `bg-brand-500` with `opacity-50`), thumb `data-[disabled]:bg-gray-50`
- Changed from TailAdmin: off track gray-200 / white/10 → gray-500 (3:1 boundary; white thumb on it 4.97:1). The
  gray-700 "neutral" variant is not used.

### Textarea (`forms/FormElements/TextArea.vue`)

- `FIELD` without `h-11`, `rows="6"`, plus `FIELD_INVALID` / `FIELD_DISABLED`, same label/hint/error lines.

### Badge (`ui/Badge.vue`, `tables/basic-tables/BasicTableOne.vue`)

- Base: `inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 font-medium`; sizes `sm` →
  `text-theme-xs`, `md` → `text-sm` (TailAdmin `capitalize` dropped: labels come translated)

| Color   | Light                                                                                     | Solid                                                       |
| ------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| primary | `bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400`                     | `bg-brand-500 text-white`                                   |
| success | `bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400`             | `bg-success-700 text-white`                                 |
| error   | `bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400`                     | `bg-error-600 text-white`                                   |
| warning | `bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400`             | `bg-warning-700 text-white`                                 |
| info    | `bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-400` | `bg-blue-light-700 text-white`                              |
| light   | `bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80`                            | `bg-gray-500 text-white dark:bg-white/5 dark:text-white/80` |
| dark    | `bg-gray-500 text-white dark:bg-white/5 dark:text-white`                                  | `bg-gray-700 text-white`                                    |

- Status badges add an icon shape per status and keep a visible text label (example `components/StatusBadge.vue`); not a
  live region.
- Changed from TailAdmin: light text -500/-600 → -700 (brand → 600), dark text → -400 (warning was orange-400), solid
  success/warning/info 500 → 700, solid error 500 → 600, solid light gray-400 → gray-500.

### Alert (`ui/Alert.vue`)

- Container: `rounded-xl border p-4`; layout `flex items-start gap-3`; icon wrapper `-mt-0.5`, `aria-hidden`
- success `border-success-500 bg-success-50 dark:border-success-500/30 dark:bg-success-500/15`, icon
  `text-success-600 dark:text-success-500`
- error `border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15`, icon
  `text-error-600 dark:text-error-500`
- warning `border-warning-500 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/15`, icon
  `text-warning-600 dark:text-warning-500`
- info `border-blue-light-500 bg-blue-light-50 dark:border-blue-light-500/30 dark:bg-blue-light-500/15`, icon
  `text-blue-light-600 dark:text-blue-light-500`
- Title `mb-1 text-sm font-semibold text-gray-800 dark:text-white/90`; message
  `text-sm text-gray-500 dark:text-gray-400`; link
  `mt-3 inline-block rounded text-sm font-medium text-gray-700 underline dark:text-gray-300 FOCUS`
- Each variant has its own icon shape. `role="alert"` for errors raised by an action, `role="status"` for confirmations,
  nothing for static notes; optional dismiss button (icon-only, `aria-label`, `FOCUS`).
- Changed from TailAdmin: light icons 500 → 600 (3:1 on the tint), link gray-500 → gray-700.

### Dropdown menu (`common/DropdownMenu.vue`, `layout/header/UserMenu.vue`)

- Reka `DropdownMenuRoot` / `Trigger` / `Portal` / `Content` / `Item` / `Separator` / `Label`
- Icon trigger: `rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 FOCUS` +
  `aria-label`
- Content:
  `z-99999 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark`
  (user menu: `w-[260px] p-3`)
- Item:
  `flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300`;
  item icon `text-gray-500 dark:text-gray-400`, `aria-hidden`
- Separator: `my-1 border-t border-gray-200 dark:border-gray-800`; label:
  `px-3 py-1 text-theme-xs text-gray-500 dark:text-gray-400`
- Changed from TailAdmin: `shadow-lg` → `shadow-theme-lg`; item text gray-500 `text-theme-xs` → gray-700 `text-theme-sm`
  (user menu recipe); keyboard highlight via `data-[highlighted]`.

### Modal (`ui/Modal.vue`, `profile/PersonalInfoCard.vue`)

- Reka `DialogRoot` / `DialogPortal` / `DialogOverlay` / `DialogContent` / `DialogTitle` / `DialogDescription` /
  `DialogClose`
- Overlay: `fixed inset-0 z-99999 bg-gray-400/50 backdrop-blur-[32px]`
- Content:
  `fixed left-1/2 top-1/2 z-99999 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[700px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-4 no-scrollbar lg:p-11 dark:bg-gray-900`
- Close:
  `absolute end-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-white/[0.05] dark:text-gray-400 dark:hover:bg-white/[0.07] dark:hover:text-gray-300 FOCUS` +
  `aria-label="Close"`
- Title `mb-2 pe-14 text-2xl font-semibold text-gray-800 dark:text-white/90`; description
  `mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400`; body `custom-scrollbar overflow-y-auto p-2`; footer
  `mt-6 flex items-center gap-3 px-2 lg:justify-end` with an outline and a primary (or danger) compact button
- Focus trap, Esc, focus return and scroll lock come from Reka.
- Changed from TailAdmin: close icon gray-400 → gray-500.

### Avatar (`ui/Avatar.vue`)

- `relative shrink-0 rounded-full`; sizes xsmall `h-6 w-6`, small `h-8 w-8`, medium `h-10 w-10`, large `h-12 w-12`,
  xlarge `h-14 w-14`, xxlarge `h-16 w-16`; image `h-full w-full object-cover rounded-full`
- Fallback (B-2, no image or load error):
  `flex items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400` with the
  Material Symbols `account_circle` icon (`aria-hidden`, font size about 80 % of the avatar)
- `alt` = user name, or `alt=""` when the name is shown next to it
- Status dot: `absolute bottom-0 end-0 rounded-full border-[1.5px] border-white dark:border-gray-900`, sizes
  `h-1.5`…`h-4`; online `bg-success-500`, offline `bg-error-400`, busy `bg-warning-500`, with a `sr-only` text
  ("Online") next to it.

### Table (`tables/basic-tables/BasicTableOne.vue`)

- Frame: `overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`;
  scroller `max-w-full overflow-x-auto custom-scrollbar`; `table.min-w-full` + `<caption class="sr-only">`
- Header row: `border-b border-gray-200 dark:border-gray-700`;
  `<th scope="col" class="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 sm:px-6 dark:text-gray-400">`;
  sortable header content is a `<button class="inline-flex items-center gap-1 rounded FOCUS">` with `aria-sort` on the
  `th`
- Body: `divide-y divide-gray-200 dark:divide-gray-700`; row
  `border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]` (B-1 row hover); cell
  `px-5 py-4 sm:px-6`
- Text: primary `block text-theme-sm font-medium text-gray-800 dark:text-white/90`, secondary
  `block text-theme-xs text-gray-500 dark:text-gray-400`, other cells `text-theme-sm text-gray-500 dark:text-gray-400`
- Clickable rows: the row action is a real link or button in the first cell (with `FOCUS`), not a click handler on `tr`
  only
- Empty: one row, `td colspan` all, `px-5 py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400`; loading:
  `aria-busy="true"` on the table.

### Card (`common/ComponentCard.vue`)

- Container: `rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`
- Header: `px-6 py-5`; title `text-base font-medium text-gray-800 dark:text-white/90`; description
  `mt-1 text-sm text-gray-500 dark:text-gray-400`
- Body: `border-t border-gray-100 p-4 sm:p-6 dark:border-gray-800`, content `space-y-5`
- Blank/empty page card (`views/Pages/BlankPage.vue`):
  `rounded-2xl border border-gray-200 bg-white px-5 py-7 xl:px-10 xl:py-12 dark:border-gray-800 dark:bg-white/[0.03]`.

### Breadcrumb (`common/PageBreadcrumb.vue`)

- Wrapper `mb-6 flex flex-wrap items-center justify-between gap-3`; page title
  `h1.text-xl.font-semibold.text-gray-800 dark:text-white/90` (TailAdmin uses `h2`)
- `<nav aria-label="Breadcrumb"><ol class="flex items-center gap-1.5">`; link
  `inline-flex items-center gap-1.5 rounded text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 FOCUS`;
  separator chevron `aria-hidden`; current item `text-sm text-gray-800 dark:text-white/90` with `aria-current="page"`.

### Tooltip (not in TailAdmin)

TailAdmin Vue has no tooltip component; the theme only defines `--shadow-tooltip`.

- Reka `TooltipProvider` (once in the app) / `TooltipRoot` / `TooltipTrigger` / `TooltipPortal` / `TooltipContent` /
  `TooltipArrow`
- Content:
  `z-99999 max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-theme-xs font-medium text-white shadow-tooltip dark:bg-gray-800 dark:text-white/90`
  (17.75:1 / 12.16:1)
- Arrow: `fill-gray-900 dark:fill-gray-800`
- Opens on hover and keyboard focus, Esc closes; never the only place for essential information or interactive content.

## Acceptance criteria

- Recipes above copied as they are; only theme classes; `dark:` classes present.
- Reka primitive used where one exists; exports checked against the installed version.
- `FOCUS` (or `FOCUS_ERROR`) on every interactive element; keyboard works; labels, hints and errors linked; state not by
  color alone.
- Default, hover, focus-visible, disabled, invalid, loading and empty states covered where relevant.
- Any new color pair is added to the contrast table in `migration-guide.md` and passes (4.5:1 text, 3:1 boundaries and
  focus).
