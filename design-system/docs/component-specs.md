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
- normal (Directus v-notice `normal`) `border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]`, icon
  `text-gray-500 dark:text-gray-400`; no role (static note). `BoNotice` takes a custom `icon`.
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
- `BoMenu` items: `to` (router link), `href` (new tab, `rel="noopener noreferrer"`), `disabled`, `loading` (spinner in
  place of the text, text kept for screen readers); dark disabled text `dark:data-[disabled]:text-white/15`.
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

## Tier 3 recipes, nháp (013)

**Draft (nháp, 013).** Written for feature 013 (spec Q-1 to Q-12, FR-093) before the code that uses them; the design
owner reviews them before 013 closes (`qa/handoff-checklist.md`); a review only changes recipes and classes. They are
built from the Tier 1 recipes and constants above (`FIELD`, `FIELD_INVALID`, `FIELD_DISABLED`, `FOCUS`, `FOCUS_ERROR`,
Label, Hint, Error message). New color pairs are rows marked "013" in the contrast table of `migration-guide.md`.
Behaviour and logic come from the Directus component named in each recipe; only the markup and classes are ours. Colors
that come from data (choice colors, chip colors, color values, header colors) are applied with `style`, never classes.
Form grid and drawer: `layout-patterns.md` §8.

Shared parts:

- `POPOVER` (panel of popover pickers): Reka `PopoverRoot` / `PopoverTrigger` / `PopoverPortal` / `PopoverContent`
  (`side-offset` 4, `align="start"`, `collision-padding` 8),
  `z-99999 max-h-(--reka-popover-content-available-height) overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark`.
  Focus moves into the content, Esc and outside click close, focus returns to the trigger (Reka). This is the Tier 1
  Popover.
- `ICON_BTN` (icon-only button inside fields, chips, rows, toolbars):
  `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 FOCUS`,
  `type="button"`, `aria-label`, icon 20px `aria-hidden`.
- `SPINNER`: Material Symbols `progress_activity`,
  `animate-spin text-gray-500 motion-reduce:animate-none dark:text-gray-400`, `aria-hidden`; the busy element gets
  `aria-busy="true"` and the text says what loads.
- Motion: every `transition*` gets `motion-reduce:transition-none`, every `animate-*` gets `motion-reduce:animate-none`.

### Radio (`BoRadio`, Reka RadioGroup; Directus `select-radio`)

- Reka `RadioGroupRoot` / `RadioGroupItem` / `RadioGroupIndicator`; the root is labelled by the field label
  (`aria-labelledby`), hint and error by `aria-describedby`, and gets `aria-required` / `aria-invalid`.
- Layout: `grid gap-x-6 gap-y-3` + `grid-cols-1` … `grid-cols-4` from the Directus `gridClass` (longest label).
- Row: Checkbox label row classes; item:
  `flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.25px] border-gray-500 bg-transparent hover:border-brand-500 FOCUS data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500 dark:border-gray-500 dark:hover:border-brand-400`;
  indicator `block h-2 w-2 rounded-full bg-white`. Choice `color` (data) sets checked border and fill with `style`.
- Invalid, disabled: as Checkbox (`border-error-600 dark:border-error-400` + `FOCUS_ERROR`; disabled grays).
- allowOther: last row is a radio plus an inline `h-9 FIELD` input (labelled "Other" by `aria-label`); typing checks it.
- Keyboard (Reka): Tab enters at the checked (or first) item, arrows move and check, Space checks.

### Combobox (`BoCombobox`; Directus `input-autocomplete-api`, `select-dropdown` with search / allowOther)

- Reka `ComboboxRoot` / `ComboboxAnchor` / `ComboboxInput` / `ComboboxTrigger` / `ComboboxPortal` / `ComboboxContent` /
  `ComboboxViewport` / `ComboboxItem` / `ComboboxItemIndicator` / `ComboboxEmpty`; `ignore-filter` when the results come
  from the API (Directus throttle/debounce logic kept).
- Anchor `relative`; input `h-11 FIELD pe-11` (+ `FIELD_INVALID` / `FIELD_DISABLED`); trigger `ICON_BTN` with
  `absolute end-1.5 top-1/2 -translate-y-1/2`, chevron icon.
- Content: Select Content classes with `min-w-(--reka-combobox-trigger-width)` and
  `max-h-(--reka-combobox-content-available-height)`; item: Select Item classes; empty: Select Empty classes with
  `no_results`.
- Loading: one row `flex items-center gap-2 px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400` with `SPINNER`;
  content `aria-busy="true"`.
- allowOther: when the text matches no choice, a last item with an `add` icon and the typed text; same Item classes.
- Keyboard (Reka): typing filters, arrows open and move, Enter selects, Esc closes and keeps the text, Tab leaves;
  `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`.
- Prepend (slot, else the selected item's `itemIcon` / `itemColor` like Directus v-select): `absolute start-4` in the
  anchor, input `ps-11`; item icons/color dots in the list when allowOther is off. Form linking: `id`,
  `aria-labelledby`, `aria-describedby` (merged with hint/error) and `invalid` reach the input.
- Append (slot, Directus `iconRight`): `absolute end-11` before the trigger, input `pe-20`.

### MultiSelect (`BoMultiSelect`; Directus `select-multiple-dropdown`)

- Reka `SelectRoot multiple` (no search) or `ComboboxRoot multiple` (search or allowOther), Select recipe parts.
- Trigger: `flex min-h-11 flex-wrap items-center gap-1.5 py-1.5 text-start FIELD` (+ invalid/disabled). Selected values
  show as Chips (sm, no delete button: no interactive element inside the trigger); remove a value by unchecking it in
  the list.
- previewThreshold (Directus option): above it the trigger shows `text-sm text-gray-800 dark:text-white/90` with the
  Directus "N items selected" text instead of chips.
- Item: Select Item classes with a Checkbox box at the start (visual, `aria-hidden`; Reka sets `aria-selected`,
  `aria-multiselectable`); Space/Enter toggles and the list stays open; Esc closes.
- Prepend slot: first item inside the trigger, `text-gray-500 dark:text-gray-400`. Form linking: `id`, `aria-labelledby`
  (label then trigger), `aria-describedby`, `invalid` on the trigger. `nonEditable` (Directus): the list still opens,
  even when disabled with a value, its items are disabled and the deselect/add rows are hidden.

### CheckboxGroup (`BoCheckboxGroup`; Directus `select-multiple-checkbox`)

- `role="group"` + `aria-labelledby` (field label) + `aria-describedby` (hint, error); items: Checkbox recipe.
- Layout: `grid gap-x-6 gap-y-3` + `grid-cols-1` … `grid-cols-4` from the Directus `gridClass`.
- Show more (`itemsShown`, Directus default): extra choices hidden; toggle
  `mt-3 inline-flex items-center gap-1 rounded text-theme-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 FOCUS`,
  `aria-expanded` + `aria-controls`, text from `interfaces.select-multiple-checkbox.show_more` / `show_less`; focus
  stays on the toggle.
- allowOther: each "other" row = checkbox + `h-9 FIELD` input + remove `ICON_BTN`; an "add other" button styled as the
  toggle.
- Choice `color` (data): checked box border and fill by `style`. Invalid: every box gets the invalid Checkbox classes.

### CheckboxTree (`BoCheckboxTree`; Directus `v-checkbox-tree`, `select-multiple-checkbox-tree`)

- Value logic (`all` / `branch` / `leaf` combining) ported from Directus. Reka `TreeRoot` / `TreeItem` give roving focus
  and expand/collapse (`role="tree"`, `treeitem`, `aria-expanded`); each treeitem carries `aria-checked` (`true` /
  `false` / `mixed`).
- Row:
  `flex items-center gap-2 rounded-lg py-1.5 pe-2 text-sm text-gray-700 outline-hidden hover:bg-gray-50 FOCUS dark:text-gray-400 dark:hover:bg-white/[0.03]`,
  indent by `style` `padding-inline-start: level × 1.5rem`; expand chevron `ICON_BTN h-6 w-6` (`tabindex="-1"`,
  `rotate-90` when open, `rtl:rotate-180` closed, `transition-transform`); box: Checkbox box classes, `aria-hidden`
  (checked = check, mixed = dash).
- Search (Directus option): `mb-3 h-9 FIELD` input above, sr-only label "Search"; "show selection only" toggle as a
  Toggle.
- Keyboard: Up/Down move, Right opens or enters, Left closes or goes to the parent, Home/End, Space toggles the check.
- Empty: Select Empty classes with `no_results`.

### DatePicker (`BoDatePicker`; Directus `datetime` + `v-date-picker`)

- Trigger: `<button type="button" aria-haspopup="dialog">`
  `flex h-11 items-center justify-between gap-2 text-start FIELD` (+ invalid/disabled), formatted value (or the
  placeholder in `text-gray-500 dark:text-gray-400`), `calendar_today` icon `text-gray-500 dark:text-gray-400`; clear
  `ICON_BTN` as a sibling (`absolute end-10`) when a value is set. Accessible name: field label + value.
- Panel: `POPOVER`, `w-auto`.
- Calendar (types `date`, `dateTime`, `timestamp`): Reka `CalendarRoot` (`locale` = user language, `week-starts-on` from
  the locale as Directus) / `CalendarHeader` `mb-2 flex items-center justify-between` / `CalendarHeading`
  `text-sm font-medium text-gray-800 dark:text-white/90` / `CalendarPrev` + `CalendarNext` (`ICON_BTN`, `aria-label`) /
  `CalendarGrid` `w-full border-collapse` / `CalendarHeadCell`
  `h-8 w-9 text-theme-xs font-medium text-gray-500 dark:text-gray-400` / `CalendarCell` / `CalendarCellTrigger`:
  `flex h-9 w-9 items-center justify-center rounded-lg text-theme-sm text-gray-700 outline-hidden hover:bg-gray-100 FOCUS data-[today]:font-semibold data-[today]:text-brand-600 data-[today]:underline data-[today]:underline-offset-4 data-[selected]:bg-brand-500 data-[selected]:text-white data-[outside-view]:text-gray-500 data-[unavailable]:line-through data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-300 dark:hover:bg-white/5 dark:data-[today]:text-brand-400 dark:data-[selected]:text-white dark:data-[outside-view]:text-gray-400 dark:data-[disabled]:text-white/15`
  (today = weight + underline, selected = solid fill, not color alone).
- Time (types `time`, `dateTime`, `timestamp`): Reka `TimeFieldRoot` (`hour-cycle` 24 or 12 from Directus `use24`,
  `granularity` `second` when `includeSeconds`, else `minute`), root
  `mt-3 flex h-11 items-center gap-0.5 rounded-lg border border-gray-500 px-4 text-sm text-gray-800 shadow-theme-xs focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:focus-within:border-brand-400`;
  `TimeFieldInput` segment
  `rounded px-0.5 tabular-nums outline-hidden focus:bg-brand-50 focus:text-brand-600 data-[placeholder]:text-gray-500 dark:focus:bg-brand-500/15 dark:focus:text-brand-400 dark:data-[placeholder]:text-gray-400`,
  literal segments `text-gray-500 dark:text-gray-400`. Type `time` shows only the TimeField (no calendar).
- Footer `mt-3 flex items-center justify-between gap-2`: Directus actions (set to now, clear) as compact outline
  Buttons.
- Timezone note: `timestamp` values are edited in the browser time zone as in Directus; the footer shows the zone name
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`) in Hint classes so the user knows which zone is edited. Types
  `dateTime`, `date`, `time` have no zone (no note).
- Keyboard (Reka): arrows move days, PageUp/PageDown months, Home/End week, Enter/Space select; segments: arrows change,
  digits type, Tab next; Esc closes, focus returns to the trigger.

### Slider (`BoSlider`; Directus `slider`)

- Reka `SliderRoot` (`min`, `max`, `step` from options) / `SliderTrack` / `SliderRange` / `SliderThumb`; thumb labelled
  by the field label (`aria-labelledby`), `aria-valuetext` = formatted value.
- Root `relative flex h-5 w-full touch-none select-none items-center`; track
  `relative h-1.5 grow overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800`; range
  `absolute h-full rounded-full bg-brand-500 dark:bg-brand-400`; thumb
  `block h-5 w-5 rounded-full border-2 border-brand-500 bg-white shadow-theme-sm hover:bg-brand-50 FOCUS data-[disabled]:border-gray-300 dark:border-brand-400 dark:bg-gray-900 dark:data-[disabled]:border-gray-700`.
- Value label (Directus `alwaysShowValue`, else on hover/focus): bubble above the thumb
  `absolute bottom-full mb-2 -translate-x-1/2 rounded-lg bg-gray-900 px-2 py-1 text-theme-xs font-medium text-white tabular-nums dark:bg-gray-800 dark:text-white/90`
  (Tooltip colors), `aria-hidden` (the value is in `aria-valuetext`).
- Ticks (when (max − min) / step ≤ 20): `mt-1 flex justify-between` of `h-1.5 w-px bg-gray-500`; min and max labels
  `text-theme-xs text-gray-500 dark:text-gray-400`, `aria-hidden`.
- Invalid: thumb `border-error-600 dark:border-error-400` + `FOCUS_ERROR`.
- Keyboard (Reka): arrows ± step, PageUp/PageDown ± 10 steps, Home/End min/max.

### Rating (display only; Directus `rating` display)

- Detailed (Directus `simple` false, the default): stars, `inline-flex items-center gap-0.5`, `role="img"`, `aria-label`
  = value and maximum (e.g. "3.5 / 5").
- Stars: Material Symbols `star` filled (`FILL` 1) `text-warning-600 dark:text-warning-400`, `star_half` the same, empty
  `star` outline (`FILL` 0) `text-gray-500 dark:text-gray-500`; all `aria-hidden`. Filled and empty differ by shape, not
  only color.
- Simple (Directus `simple` true): warning Badge (light, sm) with one filled star icon and the number.

### Chip (`BoChip`; tags, `labels` display, multi-value displays)

- Base:
  `inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-white/5 dark:text-white/80`
  (Badge light), text `truncate`.
- Data color (Directus choice `background` / `foreground`): set by `style`; no choice color → base classes.
- Dot (Directus `showAsDot`): `h-2 w-2 shrink-0 rounded-full` with the data color by `style`, before the text (the text
  carries the meaning).
- Leading slot `#leading` (default: the `icon` prop): the `labels` display puts the choice `color` there (icon colored
  with it, or a color dot when there is no icon), as Directus.
- Removable: delete button
  `-me-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 FOCUS dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-300`,
  `close` icon 14px, `aria-label` "Remove <value>".
- Clickable (link or toggle): real `<a>` / `<button>` with `hover:bg-gray-200 dark:hover:bg-white/10 FOCUS`; toggles add
  `aria-pressed`.

### TagsInput (`BoTagsInput`; Directus `tags`)

- Reka `TagsInputRoot` / `TagsInputInput` / `TagsInputItem` / `TagsInputItemText` / `TagsInputItemDelete`; options
  (`alphabetize`, `lowercase`, `whitespace`, `trim`, `allowCustom`) applied by the Directus logic.
- Input on top as Directus: `h-11 FIELD` (+ invalid/disabled), Enter adds; tags below in `mt-2 flex flex-wrap gap-1.5`;
  each tag = removable Chip, active tag (`data-[state=active]`) `ring-2 ring-brand-500 dark:ring-brand-400`.
- Presets: Chips as toggle buttons: off `bg-transparent ring-1 ring-inset ring-gray-500` with `aria-pressed="false"`, on
  base Chip + `check` icon with `aria-pressed="true"`.
- Keyboard (Reka): Enter adds, Backspace in the empty input selects the last tag, Left/Right move between tags,
  Backspace/Delete remove the active tag.

### Tabs (`BoTabs`)

- Reka `TabsRoot` / `TabsList` / `TabsTrigger` / `TabsContent`; list
  `flex gap-1 overflow-x-auto border-b border-gray-200 no-scrollbar dark:border-gray-800`.
- Trigger:
  `-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-theme-sm font-medium text-gray-500 hover:text-gray-700 FOCUS data-[state=active]:border-brand-500 data-[state=active]:text-brand-600 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:data-[state=active]:border-brand-400 dark:data-[state=active]:text-brand-400 dark:data-[disabled]:text-white/15`
  (active = underline + color).
- Content `pt-5 FOCUS` (Reka makes it focusable).
- Keyboard (Reka): Left/Right move and activate, Home/End.

### Accordion (`BoAccordion`; Directus `group-accordion`)

- Reka `AccordionRoot` (`type="single" collapsible` when Directus `accordionMode`, else `type="multiple"`; open item
  from `start`) / `AccordionItem` `border-b border-gray-200 dark:border-gray-800` / `AccordionHeader` (`h3`) /
  `AccordionTrigger` / `AccordionContent` `pb-5`.
- Trigger:
  `group flex w-full items-center gap-2 py-4 text-start text-sm font-medium text-gray-800 FOCUS dark:text-white/90`;
  edited dot and error icon as in Detail; chevron
  `ms-auto size-5 text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180 dark:text-gray-400`,
  `aria-hidden`. No height animation.
- Keyboard (Reka): Enter/Space toggle, Up/Down between headers, Home/End.

### Detail (`BoDetail`; Directus `group-detail`)

- Reka `CollapsibleRoot` (`default-open` from Directus `start`) / `CollapsibleTrigger` / `CollapsibleContent` `pt-5`
  (holds a nested form grid, layout §8).
- Trigger:
  `group flex w-full items-center gap-2 border-b border-gray-200 py-2 text-start text-sm font-medium text-gray-800 FOCUS dark:border-gray-800 dark:text-white/90`;
  header icon (Directus `headerIcon`) `text-gray-500 dark:text-gray-400`, `aria-hidden`; Directus `headerColor` (data)
  sets icon and title color by `style`.
- Edited dot (a child field is edited): the field label row dot + sr-only "Edited" (`edited`).
- Error (a child field is invalid): `error` icon `text-error-600 dark:text-error-400` + sr-only text with the count.
- Chevron as Accordion; `aria-expanded` / `aria-controls` from Reka.

### Divider with title and icon (`BoDivider`; Directus `presentation-divider`, `v-divider`)

- Line: Reka `Separator` (`decorative` when no title), `h-px w-full bg-gray-200 dark:bg-gray-800`; vertical
  (`orientation="vertical"`) `w-px self-stretch bg-gray-200 dark:bg-gray-800`.
- With title: `flex items-center gap-3`; icon `text-gray-500 dark:text-gray-400` (`aria-hidden`; Directus `color` by
  `style`); title `h3.text-sm.font-semibold.text-gray-800 dark:text-white/90`; line `h-px flex-1` after the title
  (Directus `inlineTitle`), else the title above and the line `mt-2` full width.

### ColorPicker (`BoColorPicker`; Directus `select-color`)

- Field: `relative`; input `h-11 FIELD ps-12 pe-11` with the hex/rgb/hsl text (+ invalid/disabled); swatch button
  `absolute start-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md FOCUS`, color by `style`, `aria-label` "Pick color",
  opens the popover. No value: `bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400` with `colorize` icon.
  Clear `ICON_BTN` at the end.
- Low contrast (Directus rule: contrast < 1.1 with the field background, presets: with the popover background): the
  swatch gets `ring-1 ring-inset ring-gray-500` so it stays visible (Directus draws a border).
- Popover: `POPOVER w-72 space-y-3`:
  - Mode: Select recipe (`h-9`) RGB / HSL (Directus); one Slider per channel (+ alpha when `opacity`), each with a
    `text-theme-xs text-gray-500 dark:text-gray-400` label and a `h-9 w-16 FIELD px-2` number input.
  - Hex: `h-9 FIELD` input with a visible label.
  - Native picker: compact outline Button with `colorize` icon that opens an
    `<input type="color" class="sr-only" tabindex="-1">`.
  - Presets (Directus `presets`): `grid grid-cols-8 gap-2`; button `h-6 w-6 rounded-md FOCUS`, color by `style`,
    `aria-label` = preset name or value, `aria-pressed`; selected adds
    `ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-brand-400 dark:ring-offset-gray-dark`.
- Invalid value: `FIELD_INVALID` + error message.

### IconPicker (`BoIconPicker`; Directus `select-icon`)

- Trigger: `<button>` `flex h-11 items-center gap-3 text-start FIELD` (+ invalid/disabled) with the selected icon
  (`text-gray-800 dark:text-white/90`, `aria-hidden`) and its name, or the placeholder; clear `ICON_BTN` sibling.
- Popover: `POPOVER w-[min(28rem,calc(100vw-2rem))] p-0`; search `m-3 h-9 FIELD` (sr-only label "Search").
- Scroll area `max-h-80 overflow-y-auto custom-scrollbar`, virtual rows (`useVirtualList` of `@vueuse/core`, rows of 8
  icons, 44px); group heading `px-3 pt-3 pb-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400`; grid
  `grid grid-cols-8 gap-1 px-3`.
- Icon button:
  `flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 FOCUS aria-pressed:bg-brand-50 aria-pressed:text-brand-600 aria-pressed:ring-1 aria-pressed:ring-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:aria-pressed:bg-brand-500/15 dark:aria-pressed:text-brand-400 dark:aria-pressed:ring-brand-400`,
  `aria-label` = icon name, Tooltip with the name.
- Keyboard: one Tab stop for the grid (roving `tabindex`), arrows move by cell and row (the virtual list scrolls the
  focused row into view), Enter selects and closes, Esc closes.
- Empty: `px-3 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400` with `no_results`.

### EditorFrame (`BoEditorFrame`; code, rich text, markdown, block editor)

- Frame (the `FIELD` border on a container):
  `overflow-hidden rounded-lg border border-gray-500 bg-transparent shadow-theme-xs focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:focus-within:border-brand-400`;
  invalid `border-error-600 focus-within:border-error-600 focus-within:ring-error-500/10 dark:border-error-400`;
  disabled `border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]`.
- Toolbar row: Reka `ToolbarRoot` (`aria-label`, `aria-controls` = editor)
  `flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.03]`;
  `ToolbarButton` / `ToolbarToggleItem` = `ICON_BTN` +
  `data-[state=on]:bg-brand-50 data-[state=on]:text-brand-600 dark:data-[state=on]:bg-brand-500/15 dark:data-[state=on]:text-brand-400`,
  Tooltip with the name and shortcut; `ToolbarSeparator` `mx-1 h-5 w-px bg-gray-200 dark:bg-gray-800`; overflow =
  Dropdown menu. One Tab stop, Left/Right move (Reka). Markdown edit/preview: Tabs triggers in the toolbar row.
- Editor area `min-h-[200px] px-4 py-3 text-sm text-gray-800 dark:text-white/90`.
- Third-party skins: TinyMCE `skin: 'oxide'` / `'oxide-dark'` with CSS overrides to theme variables [Unverified how far
  the skin can be overridden, research R6]; CodeMirror theme via `EditorView.theme` with `var(--color-*)`; Editor.js
  popovers recolored with theme variables. Library a11y kept; label linked by `aria-labelledby` where the library allows
  (FR-094).
- Soft-length counter (Directus `softLength`, also `input`): `mt-1.5 flex justify-end text-theme-xs tabular-nums`, the
  remaining count `text-gray-500 dark:text-gray-400`; below 10 % remaining `text-warning-700 dark:text-warning-400`,
  below 5 % `text-error-600 dark:text-error-400` (Directus thresholds; the number itself shows the state); linked by
  `aria-describedby`, no live region.
- Loading (library chunk): frame `aria-busy="true"`, area `h-[200px] animate-pulse bg-gray-100 dark:bg-white/5`.

### Map frame (`BoMapFrame`; Directus `map` interface and layout)

- Frame `relative overflow-hidden rounded-lg border border-gray-500 dark:border-gray-500`, height as Directus; MapLibre
  canvas gets the focus ring
  (`[&_.maplibregl-canvas:focus-visible]:outline-2 [&_.maplibregl-canvas:focus-visible]:-outline-offset-2 [&_.maplibregl-canvas:focus-visible]:outline-brand-500 dark:[&_.maplibregl-canvas:focus-visible]:outline-brand-400`).
- Controls (zoom, geolocate, fit, draw modes, delete) as buttons in `absolute end-3 top-3 flex flex-col gap-2`:
  `flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-theme-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 FOCUS dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-dark`
  (Outline button colors) + `aria-label`; active draw mode `aria-pressed="true"` +
  `bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400`.
- Errors (wrong geometry type, parse error): Alert error below the map. Loading: `aria-busy` + `SPINNER` centered.
- Reduced motion: `jumpTo` instead of `flyTo` (FR-094).

### Table, simple (`BoTable`; Directus `v-table` in relational lists)

- Tier 1 Table frame, scroller, caption, text classes and empty row.
- Sticky header: `thead` `sticky top-0 z-1 bg-white dark:bg-gray-900`.
- Row height (Directus `spacing`): compact `h-[29px]`, cozy `h-[43px]` (default), comfortable `h-[58px]`; cells
  `px-3 py-0 truncate`.
- Select column `w-11`: Checkbox recipe; header box = select all (indeterminate when some), row box `aria-label` "Select
  row"; selected row `aria-selected="true"` + `bg-gray-50 dark:bg-white/[0.03]` (the box shows the state; brand-50 is
  not used: gray-500 on brand-50 is 4.46:1).
- Sort: `th` `aria-sort` (`ascending` / `descending` / `none`); header button as Tier 1 with `arrow_upward` /
  `arrow_downward` `text-gray-500 dark:text-gray-400` (`aria-hidden`) on the sorted column, shown on hover/focus
  otherwise; toggling as Directus.
- Resize handle (`th` `relative`):
  `absolute -end-1 top-0 z-1 h-full w-2 cursor-col-resize after:absolute after:inset-y-2 after:start-1/2 after:w-px after:bg-gray-200 hover:after:bg-brand-500 dark:after:bg-gray-800 dark:hover:after:bg-brand-400`.
  Open question for the owner: keyboard resize is not in Directus; the draft proposes `role="separator"`
  `aria-orientation="vertical"` `tabindex="0"` + `FOCUS` with Left/Right ± 10px (needs a D-xx if kept).
- Reorder: handle column with `drag_handle` `cursor-grab text-gray-500 dark:text-gray-400` (`aria-hidden`, mouse) and
  the row menu (SortableList row menu).
- Loading: table `aria-busy="true"`, `BoProgressLinear` under the header; empty: Tier 1 empty row with the Directus
  text.

### Upload (`BoUpload`; Directus `v-upload`)

- Dropzone:
  `flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-500 bg-gray-50 px-6 py-8 text-center dark:border-gray-500 dark:bg-white/[0.03]`;
  text `text-sm text-gray-700 dark:text-gray-400`, hint `text-theme-xs text-gray-500 dark:text-gray-400`.
- Drag over (`data-dragging`): `border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/[0.12]`, hint turns
  `text-gray-700` and the text changes to the Directus "drop" text (not color alone).
- Actions: compact outline Button "Choose from device" (opens `<input type="file" class="sr-only">`) and a menu
  `ICON_BTN` `more_vert` (Dropdown menu recipe): from device, `choose_from_library`, `import_from_url` (Modal recipe
  with an Input and a primary button), as Directus `fromLibrary` / `fromUrl` allow.
- Progress: `BoProgressLinear` (`role="progressbar"`, `aria-valuenow`), track `bg-gray-200 dark:bg-gray-800`, bar
  `bg-brand-500 dark:bg-brand-400`; text `text-theme-sm text-gray-700 dark:text-gray-400` with count and percent; an
  `aria-live="polite"` region announces start and end only.
- Invalid: zone `border-error-600 dark:border-error-400` + error message; disabled: `cursor-not-allowed opacity-50`,
  drops ignored. Drop is mouse-only; the buttons give the keyboard path.

### Image preview and Lightbox (`BoImagePreview`, `FileLightbox`; Directus `image`, `file-preview`, `file-lightbox`)

- Preview:
  `relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5`; image
  `h-full w-full object-contain` (`object-cover` when Directus `crop`), `alt` from the file title (or `alt=""` when the
  title is shown next to it).
- Not an image: file-type icon `text-gray-500 dark:text-gray-400` + extension
  `text-theme-xs font-medium uppercase text-gray-700 dark:text-gray-400`. Loading: `animate-pulse`. Error:
  `broken_image` icon + text.
- Actions (open, download, edit, remove): `ICON_BTN` row
  `flex justify-end gap-1 border-t border-gray-200 px-2 py-1 dark:border-gray-800`, always visible (Directus shows them
  on hover; hover-only would hide them from keyboard and touch).
- Lightbox: Reka `Dialog`; content `fixed inset-0 z-99999 flex flex-col bg-gray-900/95 text-white` (same in both modes);
  header `flex items-center justify-between gap-3 px-4 py-3` with `DialogTitle`
  `truncate text-sm font-medium text-white`; buttons
  `flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 FOCUS` +
  `aria-label` (download, close); media `m-auto max-h-full max-w-full object-contain` in `min-h-0 flex-1 p-4`;
  video/audio with native controls. Focus trap, Esc, focus return (Reka).

### ValueNull (`ValueNull`; Directus `value-null`)

- `<span class="text-gray-500 dark:text-gray-400"><span aria-hidden="true">--</span><span class="sr-only">…</span></span>`;
  the sr-only text is an empty-value word (Backoffice overlay string, since "--" reads as "dash dash").

### UserPopover (`UserPopover`; Directus `user-popover`)

- Trigger: the user display (Avatar small + name) as
  `<button type="button" class="inline-flex max-w-full items-center gap-2 rounded-lg text-start FOCUS">`; opens on click
  / Enter, and on hover after a delay like Directus.
- Content: `POPOVER w-[280px]`, `flex items-center gap-3`: Avatar large, name
  `text-sm font-medium text-gray-800 dark:text-white/90`, email and role
  `text-theme-xs text-gray-500 dark:text-gray-400`, status Badge; link to the user
  `text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 FOCUS`.
- Loading: `SPINNER` + `aria-busy`; unknown user: Hint text.

### "N items" menu (relational displays; Directus `related-values` and similar)

- Trigger:
  `inline-flex items-center gap-1 rounded text-theme-sm text-gray-700 underline decoration-dotted underline-offset-4 hover:text-gray-800 FOCUS dark:text-gray-400 dark:hover:text-gray-300`,
  text `item_count`; opens on click / Enter, and on hover like Directus.
- Content: `POPOVER min-w-48 p-2`; `ul.space-y-1` rows `px-3 py-2 text-theme-sm text-gray-700 dark:text-gray-400` with
  the rendered display template (read-only list, so a Popover, not a menu).

### SortableList row menu (D-60; `list`, `files`, `list-o2m`, `list-m2m`, `list-m2a`, tree view)

- Row (Directus `list-interface` mixin):
  `flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]`;
  drag handle `drag_handle` `cursor-grab text-gray-500 dark:text-gray-400` (`aria-hidden`, mouse only); row content as a
  button or link with `FOCUS`; dragged row `opacity-50`, ghost `shadow-theme-lg`.
- Menu: `ICON_BTN` `more_vert` (`aria-label` with the row name) + Dropdown menu recipe: the Directus row actions, a
  separator, then "Move up" (`arrow_upward`), "Move down" (`arrow_downward`); tree view adds "Indent"
  (`format_indent_increase`) and "Outdent" (`format_indent_decrease`). Move up is `disabled` on the first row, Move down
  on the last, Indent without a previous sibling, Outdent at the root; strings in the overlay (D-60).
- After a move, focus returns to the moved row's menu trigger and an `aria-live="polite"` region says the new position
  (overlay string).

### Field label row (Q-1; Directus `form-field-label`, `form-field-menu`)

- Row: `group mb-1.5 flex min-h-6 items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-400`; the name
  is the `<label for>` (or the `id` used by `aria-labelledby` for groups); batch-edit Checkbox before it (Directus batch
  mode).
- Required: the Tier 1 required mark. Edited dot: `h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-400`, Tooltip and
  sr-only `edited` (Directus uses the subdued text color; research R6's `bg-warning-500` is not used).
- Hidden: light Badge (sm) with `visibility_off` icon and text. Raw value toggle: `ICON_BTN h-6 w-6` with `aria-pressed`
  (Directus raw editor).
- Menu chevron: `ICON_BTN h-6 w-6` `expand_more` (`aria-label` with the field name) + Dropdown menu recipe with the
  Directus field options; shown on hover and focus as Directus
  (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100`).
- Note (Directus `note`, markdown via `marked` + `dompurify`): Hint classes under the control, in `aria-describedby`;
  per-field validation text: Error message classes.

### ValidationErrors notice (Directus `validation-errors`)

- Alert error recipe; `role="alert"` when it appears after a save; title `validation_errors_notice`.
- List `mt-2 space-y-1 text-sm`; each entry: field name as
  `<button type="button" class="rounded font-medium text-gray-800 underline underline-offset-2 hover:text-gray-700 FOCUS dark:text-white/90">`
  (scrolls to the field and focuses it, as the Directus link) + the message `text-gray-500 dark:text-gray-400` (custom
  validation messages as written).

## Acceptance criteria

- Recipes above copied as they are; only theme classes; `dark:` classes present.
- Reka primitive used where one exists; exports checked against the installed version.
- `FOCUS` (or `FOCUS_ERROR`) on every interactive element; keyboard works; labels, hints and errors linked; state not by
  color alone.
- Default, hover, focus-visible, disabled, invalid, loading and empty states covered where relevant.
- Any new color pair is added to the contrast table in `migration-guide.md` and passes (4.5:1 text, 3:1 boundaries and
  focus).
