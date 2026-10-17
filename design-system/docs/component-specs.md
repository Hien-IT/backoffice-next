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
- Overlay: `fixed inset-0 z-99999 bg-gray-900/40 backdrop-blur-[2px] dark:bg-gray-950/60` (016: the TailAdmin
  `bg-gray-400/50 backdrop-blur-[32px]` hid the page too much; the dark panel gets `dark:border dark:border-gray-800`)
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
- Not shown in the page header since 016 D-101 (owner, 2026-10-17): the title row (back button, icon, h1) stays; the
  recipe is kept for when the breadcrumb comes back.

### Tooltip (not in TailAdmin)

TailAdmin Vue has no tooltip component; the theme only defines `--shadow-tooltip`.

- Reka `TooltipProvider` (once in the app) / `TooltipRoot` / `TooltipTrigger` / `TooltipPortal` / `TooltipContent` /
  `TooltipArrow`
- Content:
  `z-99999 max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-theme-xs font-medium text-white shadow-tooltip dark:bg-gray-800 dark:text-white/90`
  (17.75:1 / 12.16:1)
- Arrow: `fill-gray-900 dark:fill-gray-800`
- Opens on hover and keyboard focus, Esc closes; never the only place for essential information or interactive content.

## Tier 3 recipes, 013, duyệt 2026-10-15

**Draft (nháp, 013).** Written for feature 013 (spec Q-1 to Q-12, FR-093) before the code, then updated to the code as
built (T098): each recipe states the classes, states, ARIA and keyboard of the component it names
(`apps/web/src/components/`, `interfaces/`, `displays/`). "Deviation" lines say where the code differs from the first
draft, with the reason; "Open" lines are questions for the design owner. The design owner reviews them before 013 closes
(`qa/handoff-checklist.md`; review checklist `specs/013-interfaces-displays/design-review/README.md`); a review only
changes recipes and classes. They are built from the Tier 1 recipes and constants above (`FIELD`, `FIELD_INVALID`,
`FIELD_DISABLED`, `FOCUS`, `FOCUS_ERROR`, Label, Hint, Error message). New color pairs are rows marked "013" in the
contrast table of `migration-guide.md`. Behaviour and logic come from the Directus component named in each recipe; only
the markup and classes are ours. Colors that come from data (choice colors, chip colors, color values, header colors)
are applied with `style`, never classes; axe `color-contrast` findings on such elements are the accepted Q-C exception
of `apps/web/src/components/form/a11y.browser.test.ts`. Form grid and drawer: `layout-patterns.md` §8.

Shared parts (each component declares the constants it uses locally; there is no shared class module):

- `POPOVER` (panel of popover pickers): Reka `PopoverRoot` / `PopoverTrigger` / `PopoverPortal` / `PopoverContent`
  (`side-offset` 4, `align="start"`, `collision-padding` 8),
  `z-99999 max-h-(--reka-popover-content-available-height) overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark`.
  Focus moves into the content, Esc and outside click close, focus returns to the trigger (Reka). Where Reka's auto
  focus lands on the popper wrapper (no `tabindex`), the component focuses the `[role="dialog"]` content itself
  (ItemsMenu, UserPopover). Used by Datetime, ColorPicker, IconPicker, UserPopover, ItemsMenu and the markdown table
  popover. This is the Tier 1 Popover.
- `ICON_BTN` (icon-only button inside fields, chips, rows, toolbars):
  `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 FOCUS`,
  `type="button"`, `aria-label`, icon `sm` (20px) `aria-hidden`. Variants: destructive hover
  `hover:text-error-600 dark:hover:text-error-400` (BoRemove, clear of a tags variable); `h-6 w-6` in the field label
  row.
- `SPINNER`: Material Symbols `progress_activity`,
  `animate-spin text-gray-500 motion-reduce:animate-none dark:text-gray-400`, `aria-hidden`; the busy element gets
  `aria-busy="true"` and the text says what loads (Combobox, MultiSelect, UserPopover).
- `PROGRESS` (`BoProgressLinear`): `role="progressbar"`, `aria-valuemin` 0, `aria-valuemax` 100, `aria-valuenow` (none
  when indeterminate), `aria-label`; track `relative h-1 w-full overflow-hidden bg-gray-100 dark:bg-white/5`, bar
  `h-full bg-brand-500 dark:bg-brand-400` with the width by `style`; indeterminate = a 40 % bar sliding (keyframes).
  `BoProgressCircular` (indeterminate, `aria-label`) for the map.
- `ERROR_MSG` (error line of a Tier 3 control used on its own with an `error` prop):
  `mt-1.5 flex items-center gap-1 text-theme-xs text-error-600 dark:text-error-400`, `role="alert"`, `error` icon (sm)
  before the text. Inside a form the control only gets `invalid` and the ids; the error line is FormField's (Field label
  row).
- Motion: every `transition*` gets `motion-reduce:transition-none`, every `animate-*` gets `motion-reduce:animate-none`;
  `styles/base.css` also sets transition and animation durations to 0 under `prefers-reduced-motion: reduce`.

### Radio (`BoRadio`, Reka RadioGroup; Directus `select-radio`)

- Built: `components/BoRadio.vue`; allowOther row in `interfaces/select-radio/SelectRadio.vue`.
- Reka `RadioGroupRoot` / `RadioGroupItem` / `RadioGroupIndicator`; the root is labelled by the field label
  (`aria-labelledby`), hint and error by `aria-describedby`, and gets `aria-required` / `aria-invalid`; each item text
  is a `<label for>` of its item.
- Layout: `grid gap-x-6 gap-y-3` + `grid-cols-1`, or `grid-cols-1 sm:grid-cols-2` / `-3` / `-4` from the Directus
  `getMinimalGridClass` (longest label).
- Row: `flex items-center gap-3 text-sm font-medium select-none text-gray-700 dark:text-gray-400` (disabled
  `text-gray-300 dark:text-gray-700`); item:
  `flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.25px] bg-transparent border-gray-500 hover:border-brand-500 FOCUS data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500 data-[disabled]:cursor-not-allowed data-[disabled]:border-gray-200 dark:border-gray-500 dark:hover:border-brand-400 dark:data-[disabled]:border-gray-800`;
  indicator `block h-2 w-2 rounded-full bg-white`.
- Custom icons (Directus `iconOn` / `iconOff` other than the radio defaults): the item is the icon only,
  `inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 data-[state=checked]:text-brand-500 dark:text-gray-400 dark:data-[state=checked]:text-brand-400 FOCUS`
  (checked and unchecked differ by icon shape).
- Data color: the field `color` option (one color per field, as Directus) sets the checked border and fill (or the icon
  color) by `style`.
- Invalid: item `border-error-600 dark:border-error-400` + `FOCUS_ERROR`; `ERROR_MSG`.
- allowOther (Directus markup, in SelectRadio): a row under the grid
  `flex h-11 w-full items-center gap-2 rounded-lg border px-2 focus-within:ring-3 focus-within:ring-brand-500/10`: empty
  `border-dashed border-gray-500 dark:border-gray-500`; text typed but not selected
  `border-transparent bg-gray-100 dark:bg-white/5`; selected
  `border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15` (data color on the border); a round icon
  button (`add`, else `iconOn` / `iconOff`; `aria-label` "Other", `aria-pressed`; `text-brand-500 dark:text-brand-400`
  when selected, else gray-500 / gray-400; `FOCUS`) selects the typed value; the borderless input (`aria-label` and
  placeholder "Other",
  `text-sm text-gray-800 placeholder:text-gray-500 dark:text-white/90 dark:placeholder:text-gray-400`) sets it on
  change.
- Deviation: the "other" row is a toggle button plus an input, not a Reka radio item (Directus markup; a Reka radio item
  cannot hold an input), so arrows do not reach it; Tab does.
- Empty choices: Notice info `no_options_available`; wrong choices option: Notice warning.
- Keyboard (Reka): Tab enters at the checked (or first) item, arrows move and check, Space checks.

### Combobox (`BoCombobox`; Directus `input-autocomplete-api`, `select-dropdown` with search / allowOther)

- Built: `components/BoCombobox.vue`; used by `select-dropdown` and `input-autocomplete-api`.
- Reka `ComboboxRoot` / `ComboboxAnchor` / `ComboboxInput` / `ComboboxTrigger` / `ComboboxPortal` / `ComboboxContent` /
  `ComboboxViewport` / `ComboboxItem` / `ComboboxItemIndicator` / `ComboboxEmpty`; `ignore-filter` when the results come
  from the API (Directus throttle/debounce logic kept); the typed text is emitted as `update:search`.
- Anchor `relative`; input `h-11 FIELD ps-4 pe-11` (+ `FIELD_INVALID` / `FIELD_DISABLED`).
- Chevron: `ComboboxTrigger` with the `ICON_BTN` classes without `FOCUS`, `absolute end-1.5 top-1/2 -translate-y-1/2`,
  `expand_more`, `aria-hidden="true"`. Deviation: not a Tab stop (Reka gives it `tabindex="-1"`; the input is the
  combobox and opens with the arrows), so it is hidden from assistive technology.
- Content: Select Content classes with `min-w-(--reka-combobox-trigger-width)` and
  `max-h-(--reka-combobox-content-available-height)`, `position="popper"`, `side-offset` 4, viewport `custom-scrollbar`;
  item: Select Item classes with a `check` `ComboboxItemIndicator`.
- Note rows (empty, loading): `flex items-center gap-2 px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400`; empty
  = `no_results`; loading = `SPINNER` + `loading`, content `aria-busy="true"`.
- allowOther: when the text matches no choice, a last item with an `add` icon and the typed text; same Item classes.
- Prepend (slot, else the selected item's `itemIcon` / `itemColor` like Directus v-select):
  `pointer-events-none absolute start-4` `text-gray-500 dark:text-gray-400`, input `ps-11`; color dot
  `h-3 w-3 shrink-0 rounded-full` with the color by `style`; item icons / dots in the list when allowOther is off.
- Append (slot, Directus `iconRight`): `pointer-events-none absolute end-11`, input `pe-20`.
- Form linking: own `<label for>` when `label` is set, else `id`, `aria-labelledby`, `aria-describedby` (merged with
  hint / error) and `aria-invalid` on the input; `ERROR_MSG`.
- Keyboard (Reka): typing filters, arrows open and move, Enter selects, Esc closes and keeps the text, Tab leaves;
  `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` come from Reka.

### MultiSelect (`BoMultiSelect`; Directus `select-multiple-dropdown`)

- Built: `components/BoMultiSelect.vue`; used by `select-multiple-dropdown`.
- Deviation: always Reka `ComboboxRoot multiple` with a search input inside the panel (the draft used `SelectRoot`
  without search): one component covers search, allowOther, allowNone and nonEditable.
- Trigger: the `ComboboxTrigger` is the focusable field (`tabindex="0"`, Down opens):
  `flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-4 py-1.5 pe-10 text-start text-sm text-gray-800 shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90`
  - the `FIELD` border/focus part (or `FIELD_INVALID`) + the `FIELD_DISABLED` colors; chevron `expand_more`
    `absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400`; placeholder
    `py-1 text-gray-500 dark:text-gray-400`.
- Values: below `previewThreshold` (default 3) selected values show as Chips (sm, no delete button: no interactive
  element inside the trigger); from the threshold the Directus text `item_count` ("N items") or `all_items` when all are
  selected. A value is removed by unchecking it in the list.
- Panel: Select Content classes; search `mb-2 h-9 FIELD px-3` (`aria-label` "Search", placeholder "Other" when
  allowOther).
- Item: Select Item classes + `group gap-3` with a Checkbox box at the start
  (`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.25px] border-gray-500 text-white group-data-[state=checked]:border-brand-500 group-data-[state=checked]:bg-brand-500 dark:border-gray-500`,
  `check` icon, `aria-hidden`; Reka sets `aria-selected`, `aria-multiselectable`); Space/Enter toggles and the list
  stays open; Esc closes.
- allowNone: a first item "Deselect all" (`close` icon), disabled while nothing is selected. allowOther: an `add` item
  with the typed text; selected values that are not choices stay listed so they can be unchecked. Empty:
  `no_options_available` (no choices) or `no_results` (search); loading as Combobox.
- Prepend slot: first item inside the trigger, `text-gray-500 dark:text-gray-400`. Form linking: `id`, `aria-labelledby`
  (label then trigger, so the value is read), `aria-describedby`, `aria-invalid` on the trigger; `ERROR_MSG`.
  `nonEditable` (Directus): the list still opens, even when disabled with a value; its items are disabled and the
  deselect / add rows are hidden.

### CheckboxGroup (`BoCheckboxGroup`; Directus `select-multiple-checkbox`)

- Built: `components/BoCheckboxGroup.vue`; used by `select-multiple-checkbox`.
- `role="group"` + `aria-labelledby` (field label, with the required mark) + `aria-describedby` (hint, error); rows and
  grid as Radio.
- Box: Checkbox recipe box + `cursor-pointer text-white` and a `check` indicator; custom `iconOn` / `iconOff`: the icon
  only (defaults `check_box` / `check_box_outline_blank`),
  `text-gray-500 data-[state=checked]:text-brand-500 dark:text-gray-400 dark:data-[state=checked]:text-brand-400`.
- Show more (`itemsShown`, Directus default 8): extra choices hidden; toggle
  `mt-3 inline-flex items-center gap-1 rounded text-theme-sm font-medium text-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400 FOCUS`
  with `expand_more` / `expand_less`, `aria-expanded` + `aria-controls` (the grid), text
  `interfaces.select-multiple-checkbox.show_more` (with the hidden count) / `show_less`; focus stays on the toggle.
- allowOther: each "other" row = checkbox (`aria-label` = its value or "Other") + `h-9 FIELD px-3` input (`aria-label`
  "Other") + remove `ICON_BTN` `delete` (`remove_item`); an "Other" button (`add` icon) styled as the show-more toggle
  adds a row and focuses its input.
- Choice `color` (data, one per field): checked box border and fill (or icon color) by `style`. Invalid: every box gets
  the invalid Checkbox classes; `ERROR_MSG`. No choices: `text-theme-sm text-gray-500 dark:text-gray-400`
  `no_options_available`.

### CheckboxTree (`BoCheckboxTree`; Directus `v-checkbox-tree`, `select-multiple-checkbox-tree`)

- Built: `components/BoCheckboxTree.vue` (+ `checkbox-tree/value-combining.ts`); used by
  `select-multiple-checkbox-tree`.
- Value logic (`all` / `branch` / `leaf` / `indeterminate` / `exclusive` combining) ported from Directus. One flat Reka
  `TreeRoot` / `TreeItem` list gives roving focus and expand/collapse (`role="tree"`, `treeitem`, `aria-expanded`); the
  root gets `aria-multiselectable`, `aria-labelledby`, `aria-describedby`, `aria-invalid`; each treeitem carries
  `aria-checked` (`true` / `false` / `mixed`) and `aria-disabled`.
- Frame: `rounded-lg border p-2 border-gray-200 dark:border-gray-800` (invalid
  `border-error-600 dark:border-error-400`).
- Row:
  `flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pe-2 text-sm text-gray-700 outline-hidden hover:bg-gray-50 FOCUS aria-disabled:cursor-not-allowed aria-disabled:text-gray-300 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:aria-disabled:text-gray-700`,
  indent by `style` `padding-inline-start: (level − 1) × 1.5rem`; text `truncate`.
- Chevron (rows with children): `span` `aria-hidden`, mouse only,
  `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-transform hover:bg-gray-100 hover:text-gray-700 motion-reduce:transition-none dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300`,
  `chevron_right`, `rotate-90` when open, `rtl:rotate-180` when closed; leaves get a `w-6` spacer.
- Box (`aria-hidden`): `flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.25px] text-white`;
  checked and mixed `border-brand-500 bg-brand-500` with `check` / `remove` (dash) icons; unchecked
  `border-gray-500 dark:border-gray-500`; disabled `border-gray-200 dark:border-gray-800`.
- Search: only with more than 10 choices (Directus), `mb-3 h-9 FIELD px-3` `type="search"`, sr-only label "Search", 250
  ms debounce; matching branches open. "Show selected only": Toggle (`BoSwitch`, `mt-3`,
  `interfaces.select-multiple-checkbox-tree.show_selected`), disabled while nothing is selected.
- Keyboard (Reka Tree): Up/Down move, Right opens or enters, Left closes or goes to the parent, Home/End, Enter/Space
  toggle the check (a click on the chevron only expands).
- Empty: note `px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400` with `no_options_available` (no choices) or
  `no_results` (search).
- Deviation: the Directus search highlight, `nonEditable`, `openGroups` and group toggle are not ported (code header).

### DatePicker (`BoDatePicker`; Directus `datetime` + `v-date-picker`)

- Built: trigger and popover in `interfaces/datetime/Datetime.vue`, panel in `components/BoDatePicker.vue`.
- Trigger: `PopoverTrigger as-child` on a `<button type="button">` that keeps the form input id (Reka adds
  `aria-haspopup="dialog"`, `aria-expanded`):
  `flex h-11 w-full items-center gap-2 rounded-lg border bg-transparent px-4 pe-20 text-start text-sm text-gray-800 shadow-theme-xs focus:outline-hidden focus:ring-3 FOCUS dark:bg-gray-900 dark:text-white/90`
  - the `FIELD` border/focus part (open state
    `data-[state=open]:border-brand-500 data-[state=open]:ring-3 data-[state=open]:ring-brand-500/10 dark:data-[state=open]:border-brand-400`)
    or `FIELD_INVALID`, + the `FIELD_DISABLED` colors; value `min-w-0 truncate`. Accessible name: field label + value
    (`aria-labelledby`).
- End actions `absolute end-1.5 top-1/2 flex -translate-y-1/2 items-center`: time zone icon `schedule` with a Tooltip of
  the zone (when `tz` is set, `h-8 w-8 text-gray-500 dark:text-gray-400`); clear `ICON_BTN` `close` (`clear_value`) when
  a value is set, else a decorative `today` icon (`text-gray-500 dark:text-gray-400`, disabled
  `text-gray-300 dark:text-white/15`). Hidden when nonEditable.
- Deviation: the calendar icon sits at the end and becomes the clear button once a value is set (Directus); no
  `calendar_today` inside the value.
- Panel: `POPOVER w-auto`.
- Calendar (types `date`, `dateTime`, `timestamp`): Reka `CalendarRoot` (`locale` = user language, `fixed-weeks`,
  `weekday-format="short"`, `initial-focus`: focus on the selected day, else today, when the panel opens; `dir` from the
  user) / `CalendarHeader` `mb-2 flex items-center justify-between gap-2` / `CalendarPrev` + `CalendarNext` (`ICON_BTN`,
  `aria-label` `previous` / `next`) / `CalendarHeading`
  `flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white/90` holding a month Select (Tier 1 Select,
  `w-36`, sr-only label `month`) and a year number Input (`w-24`, `aria-label` `year`) as the Directus v-date-picker /
  `CalendarGrid` `w-full border-collapse select-none`, rows `grid grid-cols-7` / `CalendarHeadCell`
  `h-8 w-9 text-theme-xs font-medium text-gray-500 dark:text-gray-400` / `CalendarCellTrigger`:
  `flex h-9 w-9 items-center justify-center rounded-lg text-theme-sm text-gray-700 outline-hidden hover:bg-gray-100 FOCUS data-[today]:font-semibold data-[today]:text-brand-600 data-[today]:underline data-[today]:underline-offset-4 data-[selected]:bg-brand-500 data-[selected]:text-white data-[outside-view]:text-gray-500 data-[unavailable]:line-through data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-300 dark:hover:bg-white/5 dark:data-[today]:text-brand-400 dark:data-[selected]:text-white dark:data-[outside-view]:text-gray-400 dark:data-[disabled]:text-white/15`
  (today = weight + underline, selected = solid fill, not color alone). Type `date` closes on select.
- Time (types `time`, `dateTime`, `timestamp`): Reka `TimeFieldRoot` (`hour-cycle` 24 when Directus `use24`, else the
  locale's; `granularity` `second` when `includeSeconds`, else `minute`; default 12:00), root
  `mt-3 flex h-11 items-center gap-0.5 rounded-lg border border-gray-500 px-4 text-sm text-gray-800 shadow-theme-xs focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:focus-within:border-brand-400`;
  segment
  `rounded px-0.5 tabular-nums outline-hidden focus:bg-brand-50 focus:text-brand-600 data-[placeholder]:text-gray-500 dark:focus:bg-brand-500/15 dark:focus:text-brand-400 dark:data-[placeholder]:text-gray-400`,
  literal segments `text-gray-500 dark:text-gray-400`. Type `time` shows only the TimeField.
- Footer `mt-3 flex items-center justify-between gap-2`: "Set to now" (`set_to_now`, secondary Button, closes the
  panel); for `timestamp` the zone name (the field's `tz`, else `Intl.DateTimeFormat().resolvedOptions().timeZone`) in
  `text-theme-xs text-gray-500 dark:text-gray-400`. Types `dateTime`, `date`, `time` show no zone. Deviation: no clear
  button in the footer (clear is on the trigger, as Directus).
- Keyboard (Reka): arrows move days, PageUp/PageDown months, Home/End week, Enter/Space select; segments: arrows change,
  digits type, Tab next; Esc closes, focus returns to the trigger.

### Slider (`BoSlider`; Directus `slider`)

- Built: `components/BoSlider.vue` (`slider`); the same track / range / thumb classes in the ColorPicker channels.
- Reka `SliderRoot` (`min`, `max`, `step` from options) / `SliderTrack` / `SliderRange` / `SliderThumb`; thumb labelled
  by the field label (`aria-labelledby`), `aria-valuetext` = the value, `aria-describedby`, `aria-invalid`.
- Wrapper `pt-8` (room for the value bubble). Root `relative flex h-5 w-full touch-none select-none items-center`; track
  `relative h-1.5 grow overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800`; range
  `absolute h-full rounded-full bg-brand-500 dark:bg-brand-400`; thumb
  `group relative block h-5 w-5 cursor-pointer rounded-full border-2 border-brand-500 bg-white shadow-theme-sm hover:bg-brand-50 FOCUS data-[disabled]:cursor-not-allowed data-[disabled]:border-gray-300 dark:border-brand-400 dark:bg-gray-900 dark:data-[disabled]:border-gray-700`.
- Value bubble inside the thumb (Directus `alwaysShowValue`, else `hidden group-hover:block group-focus:block`):
  `pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg bg-gray-900 px-2 py-1 text-theme-xs font-medium text-white tabular-nums dark:bg-gray-800 dark:text-white/90`
  (Tooltip colors), `aria-hidden`.
- Ticks (when (max − min) / step ≤ 20): `mt-1 flex justify-between px-2.5` of `h-1.5 w-px bg-gray-500`; min and max
  labels always shown, `mt-1 flex justify-between text-theme-xs text-gray-500 dark:text-gray-400`; both `aria-hidden`.
- Invalid: thumb `border-error-600 dark:border-error-400` + `FOCUS_ERROR`; `ERROR_MSG`.
- Keyboard (Reka): arrows ± step, PageUp/PageDown ± 10 steps, Home/End min/max.

### Rating (display only; Directus `rating` display)

- Built: `displays/rating/DisplayRating.vue`.
- Detailed (Directus `simple` false, the default): `relative inline-flex w-min`, `role="img"`, `aria-label` = value and
  maximum (e.g. "3.5 / 5"), with a Tooltip of the value. Two layers of `star` icons (sm): filled stars (`FILL` 1)
  `relative z-2 inline-flex overflow-hidden text-warning-600 dark:text-warning-400` clipped to the rating percentage by
  `style`, over outline stars (`FILL` 0) `absolute start-0 top-0 z-1 inline-flex text-gray-500` (no dark variant:
  gray-500 is 3.57:1 on gray-900). Filled and empty differ by shape, not only color.
- Deviation: half values are a clipped filled star (Directus markup), not `star_half`.
- Simple (Directus `simple` true): warning light Badge with `font-semibold`
  (`inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-theme-xs font-semibold text-warning-700 dark:bg-warning-500/15 dark:text-warning-400`),
  one filled star and the number.

### Translation progress (Q-4; Directus `translations` interface language select and display)

- Built: `interfaces/translations/LanguageSelect.vue`, `displays/translations/DisplayTranslations.vue`, both with
  `PROGRESS`.
- Language bar (interface): `flex h-11 w-full items-center gap-1 rounded-lg ps-2 pe-1`; first language
  `bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400`, second language (split view)
  `bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-400`, danger
  `bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400`, disabled
  `cursor-not-allowed bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400`. Inside, a Reka
  `DropdownMenuTrigger`
  (`flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-start text-sm font-medium FOCUS`, value
  `truncate`, `expand_more` flipped when open) and a controls slot.
- Menu: Dropdown menu recipe (`max-h` available height, `min-w` trigger width); item = edited marker
  `me-1.5 h-1 w-1 rounded-sm bg-gray-500` + sr-only "(edited)", language name, and a `w-24` `PROGRESS` (`rounded-full`)
  with `aria-label` "language: N%" and the same `title`.
- Display: an icon trigger (`info`, "N items" menu icon variant) opens a list `w-[16.875rem] space-y-1`; each entry
  `px-3 py-1` (from the second, `border-t border-gray-100 pt-2 dark:border-gray-800`): header
  `flex items-center justify-between gap-4 text-theme-xs text-gray-500 dark:text-gray-400` with `translate` icon and the
  language (`font-semibold`), a `max-w-[5.625rem]` `PROGRESS` with a Tooltip of the percent; then the item rendered
  `text-theme-sm text-gray-700 dark:text-gray-400`.
- Progress colors of the display (Directus `colorful`): bar `bg-error-500` up to 33 %, `bg-warning-500` up to 66 %, else
  `bg-success-500`, no dark variant.
- Open: in light mode the warning-500 (2.13:1) and success-500 (2.38:1) bars on the gray-100 track are below 3:1
  (migration-guide, rows marked "fail"); the value is also in `aria-valuenow` and in the hover Tooltip, not in visible
  text. Owner question: keep the Directus colors, or darker shades (-700) / a visible percent.

### Chip (`BoChip`; tags, `labels` display, multi-value displays)

- Built: `components/BoChip.vue`; used by `labels`, MultiSelect values, group badges, UserPopover role.
- Base:
  `inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-700 dark:bg-white/5 dark:text-white/80`
  (Badge light) with the Badge sizes `sm` → `text-theme-xs` (default), `md` → `text-sm`; text `truncate`.
- Data color (Directus choice `foreground` / `background`): `color` / `background` props set by `style`; the base color
  classes are dropped then.
- Leading slot `#leading` (default: the `icon` prop, sm): the `labels` display puts the choice icon there colored by
  `style`, or a Color dot when the choice has a color and no icon.
- Removable: delete button
  `-me-1 inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 FOCUS disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-300`,
  `close` icon at 14px (`font-size: var(--text-theme-sm)`), `aria-label` "Remove <text>" (`remove`).
- Deviation: BoChip has no dot or clickable / toggle variant. `labels` with Directus `showAsDot` renders Color dots,
  each with a Tooltip of its text, plus one sr-only list of the texts; toggle chips are the TagsInput presets.
- Color dot (`displays/color/DisplayColor.vue`): `inline-block size-2.25 shrink-0 rounded-full`, color by `style`;
  `border border-gray-500` when the color's contrast with the page background (white, dark gray-900) is below 1.1
  (Directus rule); default `#B0BEC5` (Directus data constant); no value and no default → ValueNull.

### TagsInput (`BoTagsInput`; Directus `tags`)

- Built: `components/BoTagsInput.vue`, `interfaces/tags/Tags.vue`.
- Reka `TagsInputRoot` (`delimiter=","`, `add-on-blur`, `add-on-paste`) / `TagsInputInput` / `TagsInputItem` /
  `TagsInputItemText` / `TagsInputItemDelete`; options (`alphabetize`, `lowercase`, `whitespace`, `trim`, `allowCustom`)
  applied by the Directus logic.
- Input on top as Directus: `h-11 FIELD` (+ invalid / disabled), placeholder `interfaces.tags.add_tags`, Enter adds;
  tags below in `mt-2 flex flex-wrap gap-1.5`; each tag = Chip base, active tag (`data-[state=active]`)
  `ring-2 ring-brand-500 dark:ring-brand-400`; delete = Chip delete button (`aria-label` "Remove <tag>").
- Presets (`mt-2 flex flex-wrap gap-1.5`): toggle buttons; off
  `inline-flex items-center gap-1 rounded-full bg-transparent px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 ring-1 ring-gray-500 ring-inset hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/5 FOCUS`
  with `aria-pressed="false"`; on Chip base + `hover:bg-gray-200 dark:hover:bg-white/10 FOCUS` + `check` icon (14px)
  with `aria-pressed="true"`; disabled `opacity-50`. Without allowCustom only the presets render, as a `role="group"`
  labelled by the field label.
- Tags interface: `iconLeft` / `iconRight`
  `pointer-events-none absolute top-0 flex h-11 items-center text-gray-500 dark:text-gray-400` (input `ps-11` /
  `pe-11`); a variable value (`{{ … }}`) shows a disabled input and a clear `ICON_BTN` with the destructive hover.
- Keyboard (Reka): Enter adds, Backspace in the empty input selects the last tag, Left/Right move between tags,
  Backspace/Delete remove the active tag.

### Tabs (`BoTabs`; Directus `group-tabs`)

- Built: `components/BoTabs.vue`, `interfaces/group-tabs/GroupTabs.vue`.
- Reka `TabsRoot` (`dir`) / `TabsList` (`aria-label` = group name)
  `no-scrollbar flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800` / `TabsTrigger` /
  `TabsContent`.
- Trigger:
  `-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-theme-sm font-medium text-gray-500 hover:text-gray-700 FOCUS data-[state=active]:border-brand-500 data-[state=active]:text-brand-600 data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:data-[state=active]:border-brand-400 dark:data-[state=active]:text-brand-400 dark:data-[disabled]:text-white/15`
  (active = underline + color); `flex-1 justify-center` with Directus `fillWidth`. Group tabs put in the trigger: the
  edited dot (Field label row), the name, the badge Chip, and an `error` icon `text-error-600 dark:text-error-400` with
  a Tooltip and sr-only text of the section's validation messages.
- Content `pt-5 FOCUS` (Reka makes it focusable), holding a nested form grid.
- Keyboard (Reka): Left/Right move and activate, Home/End.

### Accordion (`BoAccordion`; Directus `group-accordion`)

- Built: `components/BoAccordion.vue`, `interfaces/group-accordion/GroupAccordion.vue`.
- Reka `AccordionRoot` (`type="single" collapsible` when Directus `accordionMode`, else `type="multiple"`; open item
  from `start`) / `AccordionItem` `border-b border-gray-200 dark:border-gray-800` / `AccordionHeader` (`h3`) /
  `AccordionTrigger` / `AccordionContent` `pb-5`.
- Trigger:
  `group flex w-full items-center gap-2 py-4 text-start text-sm font-medium text-gray-800 FOCUS dark:text-white/90`;
  content: edited dot, name `truncate`, required mark + sr-only "required", badge Chip, and, while the section is
  closed, the `error` icon with a Tooltip and sr-only text of the validation message; chevron `expand_more`
  `ms-auto text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none dark:text-gray-400`,
  `aria-hidden`. No height animation.
- Keyboard (Reka): Enter/Space toggle, Up/Down between headers, Home/End.

### Detail (`BoDetail`; Directus `group-detail`)

- Built: `components/BoDetail.vue`, `interfaces/group-detail/GroupDetail.vue`.
- Reka `CollapsibleRoot` (`default-open` from Directus `start`) / `CollapsibleTrigger` / `CollapsibleContent` `pt-5`
  (holds a nested form grid, layout §8).
- Trigger:
  `group flex w-full items-center gap-2 border-b border-gray-200 py-2 text-start text-sm font-medium FOCUS disabled:cursor-not-allowed dark:border-gray-800`,
  title `min-w-0 truncate` `text-gray-800 dark:text-white/90`; header icon (Directus `headerIcon`)
  `text-gray-500 dark:text-gray-400`; Directus `headerColor` (data) sets the title and icon color by `style`.
- Edited dot while closed (a child field is edited): the Field label row dot with Tooltip and sr-only "Edited".
- Error while closed: `error` icon `text-error-600 dark:text-error-400` with a Tooltip and sr-only text listing the
  messages. Deviation: the messages, not a count.
- Chevron as Accordion; `aria-expanded` / `aria-controls` from Reka.

### Divider with title and icon (`BoDivider`; Directus `presentation-divider`, `v-divider`)

- Built: `components/BoDivider.vue`, `interfaces/presentation-divider/PresentationDivider.vue`.
- Line: Reka `Separator` (`decorative` when no title), `h-px w-full bg-gray-200 dark:bg-gray-800`; vertical
  (`orientation="vertical"`, decorative) `w-px self-stretch bg-gray-200 dark:bg-gray-800`.
- With title: `flex min-w-0 items-center gap-3` `text-gray-800 dark:text-white/90` (Directus `color` by `style`); icon
  `text-gray-500 dark:text-gray-400` (takes the data color when set); title `h3.truncate.text-sm.font-semibold`; line
  `flex-1` after the title (Directus `inlineTitle`, wrapper `flex items-center gap-3`), else the title above and the
  line `mt-2 w-full`.

### ColorPicker (`BoColorPicker`; Directus `select-color`)

- Built: `components/BoColorPicker.vue`, `interfaces/select-color/SelectColor.vue`.
- Field (`PopoverAnchor`, `relative`): input `h-11 FIELD px-4 ps-12 pe-11` with the hex/rgb/hsl text (+ invalid /
  disabled; nonEditable = `readonly` with `read-only:bg-gray-50 dark:read-only:bg-white/[0.03]`), placeholder
  `interfaces.select-color.placeholder`.
- Swatch = `PopoverTrigger`
  `absolute start-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md FOCUS`, color by
  `style`, `aria-label` "Pick color"; no valid value: `bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400`
  with `colorize`; a value the swatch cannot draw: `question_mark`. Low contrast (Directus rule: contrast < 1.1 with the
  field background): `ring-1 ring-gray-500 ring-inset`.
- End (`absolute end-1.5`): clear `ICON_BTN` `close` (`clear_value`) when the value is valid, else a `palette`
  `ICON_BTN` that toggles the popover (`aria-haspopup="dialog"`, `aria-expanded`). Hidden when nonEditable.
- Popover `POPOVER w-72 space-y-3`:
  - Mode: Tier 1 Select (`h-11`, sr-only label `interfaces.select-color.color`) RGB / HSL (Directus).
  - One row per channel (+ alpha with `opacity`) `flex items-center gap-3`: label
    `w-5 shrink-0 truncate text-theme-xs text-gray-500 dark:text-gray-400` (full name in `title`), a Slider (Slider
    track / range / thumb classes, thumb labelled by the label) and a `h-9 w-16 shrink-0 FIELD px-2` number input.
  - Hex: visible label "HEX" (Label classes) and a `h-9 FIELD px-3` input (`maxlength` 7, 9 with opacity), next to a
    secondary Button `colorize` "Browser color picker" (`browser_color_picker`) that opens a hidden
    `<input type="color" class="sr-only" tabindex="-1" aria-hidden="true">`.
  - Presets (Directus `presets`): `grid grid-cols-8 gap-2`; button `h-6 w-6 rounded-md FOCUS`, color by `style`, Tooltip
    and `aria-label` = preset name or value, `aria-pressed`; selected adds
    `ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-brand-400 dark:ring-offset-gray-dark`, low contrast
    with the popover adds `ring-1 ring-gray-500 ring-inset`.
- Deviation: the mode Select is the Tier 1 `h-11` size (the draft said `h-9`); the native picker button has a text
  label.
- Invalid value: `FIELD_INVALID` (error line from the form).

### IconPicker (`BoIconPicker`; Directus `select-icon`)

- Built: `components/BoIconPicker.vue`, `interfaces/select-icon/SelectIcon.vue`.
- Trigger: `PopoverTrigger as-child` on a `<button>` that keeps the form input id,
  `flex h-11 items-center gap-3 px-4 py-2.5 pe-12 text-start FIELD` (+ invalid / disabled; also disabled when
  nonEditable), selected icon (sm, `text-gray-800 dark:text-white/90`) and its title-cased name, or the placeholder
  `interfaces.select-icon.search_for_icon` in `text-gray-500 dark:text-gray-400`; `aria-labelledby` = label + value.
- End: clear `ICON_BTN` (`clear_value`) when a value is set, else a decorative chevron flipped while open.
- Popover: `POPOVER w-[min(28rem,calc(100vw-2rem))] p-0`; search wrapper `m-3`, input `h-9 FIELD px-4` `type="search"`,
  sr-only label "Search".
- Scroll area: `vue-virtual-scroller` `DynamicScroller` (`h-80 overflow-y-auto pb-3 custom-scrollbar`, rows rendered
  only while active). Deviation: the draft said `useVirtualList`; the Directus scroller is kept (release-gate decision)
  and the number of icons per row comes from the panel width (40px buttons, 4px gap), not a fixed 8.
- Group heading `px-3 pt-3 pb-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400`; grid `grid gap-1 px-3 pb-1`
  with `grid-template-columns: repeat(n, 2.5rem)` by `style`.
- Icon button:
  `flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 FOCUS aria-pressed:bg-brand-50 aria-pressed:text-brand-600 aria-pressed:ring-1 aria-pressed:ring-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:aria-pressed:bg-brand-500/15 dark:aria-pressed:text-brand-400 dark:aria-pressed:ring-brand-400`,
  icon `md`, `aria-label` = icon name, `aria-pressed`. Deviation: no Tooltip per icon (the name is the `aria-label`).
- Keyboard: one Tab stop for the grid (roving `tabindex`), Left/Right move by icon and wrap rows (swapped in RTL),
  Up/Down by row, Home/End in the row, Enter/Space selects and closes, Esc closes. Known limit (code `shortcut:`
  comment): the Tab stop resets to the first icon after a search or opening; once it scrolled out of the virtual window
  the arrows work again only after scrolling back.
- Empty: `flex items-center justify-center gap-2 px-3 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400`
  with `search_off` and `no_results`.

### EditorFrame (`BoEditorFrame`; code, rich text, markdown, block editor)

- Built: `components/BoEditorFrame.vue` (markdown, block editor with `bordered`); the same frame classes inline in
  `interfaces/input-code/InputCode.vue`; CodeMirror theme `styles/codemirror-theme.css`; Editor.js theme
  `interfaces/input-block-editor/editorjs-overrides.css`.
- Frame: `overflow-hidden rounded-lg border shadow-theme-xs` +
  `border-gray-500 bg-transparent focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:focus-within:border-brand-400`;
  invalid
  `border-error-600 bg-transparent focus-within:border-error-600 focus-within:ring-3 focus-within:ring-error-500/10 dark:border-error-400 dark:bg-gray-900`;
  disabled `border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]`.
- Toolbar row: Reka `ToolbarRoot` (`aria-label`, `aria-controls` = editor)
  `flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.03]`;
  buttons use the exported `EDITOR_TOOLBAR_BUTTON` = `ICON_BTN` +
  `data-[state=on]:bg-brand-50 data-[state=on]:text-brand-600 dark:data-[state=on]:bg-brand-500/15 dark:data-[state=on]:text-brand-400`,
  each with a Tooltip and `aria-label` "<name> - <shortcut>". Markdown toolbar: heading menu (Dropdown menu, items with
  their shortcut), bold, italic, strikethrough, lists, quote, code, link, table (Popover with rows / columns Inputs and
  a primary "Create" Button), image (upload dialog), custom syntax buttons; Ctrl/Cmd shortcuts as Directus (B, I, K,
  Alt+D/Q/C/1–6). One Tab stop, Left/Right move (Reka). No `ToolbarSeparator` and no overflow menu (the row wraps).
- Markdown edit / preview. Deviation: a Reka `ToolbarToggleGroup` (segmented control at the end of the toolbar, inside
  its arrow-key navigation) instead of Tabs: group `flex gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5`, item
  `rounded-md px-2.5 py-1 text-theme-xs font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-white data-[state=on]:text-gray-800 data-[state=on]:shadow-theme-xs dark:text-gray-400 dark:hover:text-gray-300 dark:data-[state=on]:bg-gray-800 dark:data-[state=on]:text-white/90 FOCUS`.
- Preview `min-h-[200px] px-4 py-3 text-sm text-gray-800 dark:text-white/90` + prose classes (links
  `text-brand-500 dark:text-brand-400` underlined on hover, `code` / `pre` `bg-gray-100 dark:bg-white/5`, blockquote
  `border-s-[3px] border-brand-500 ps-3 italic`, table cells `border-gray-200 dark:border-gray-800`); HTML sanitized by
  DOMPurify (FR-065).
- Code (CodeMirror 5, as Directus 11.17.4). Deviation: no `EditorView.theme` (that is CodeMirror 6); the theme is CSS on
  `.bo-codemirror` with the theme variables: text gray-800 / dark white 90 %, monospace 13px; gutters gray-50 with a
  gray-200 end border (dark white 3 %, gray-800); line numbers and placeholder gray-500 / gray-400; active line gray-50
  / white 3 %; selection brand-100 / gray-700; syntax keyword brand-600 / brand-400, atom / def / builtin / link
  blue-light-700 / blue-light-400, number / type / tag / matching bracket success-700 / success-400, comment warning-700
  / warning-400, string / error error-700 / error-400, property orange-700 / orange-400, bracket gray-500 / gray-400;
  lint: dashed underline + gutter icon (the shape carries the meaning) warning-600 / error-600 (dark -400); lint tooltip
  in Tooltip colors. The hidden textarea CodeMirror types into gets the form input id, `aria-labelledby`,
  `aria-describedby`, `aria-invalid` (FR-094).
- input-code: frame classes on the wrapper (`dir="ltr"`); "fill template" button `absolute end-2 top-2 z-4`, `ICON_BTN`
  variant
  `bg-white text-brand-500 hover:bg-gray-100 hover:text-brand-600 dark:bg-gray-900 dark:text-brand-400 dark:hover:bg-white/5 dark:hover:text-brand-300`
  with a Tooltip `fill_template`.
- Open: CodeMirror keeps Tab for indentation like Directus (`extraKeys` only maps Ctrl to autocomplete), so Tab does not
  leave the code editor (WCAG 2.1.2 risk). Owner question: keep Directus behaviour or add an escape key (for example Esc
  then Tab).
- Block editor (Editor.js): `editorjs-overrides.css` maps the Directus theme variables to local `--bo-ej-*` variables on
  the theme tokens, light and dark (background gray-100 / gray-800, text gray-800 / white 90 %, subdued gray-500 /
  gray-400, border gray-300 / gray-700, primary brand-500 / brand-400, danger error-600 / error-400, tooltips gray-900 /
  gray-800 with white); `bordered` → BoEditorFrame, else a plain block; content
  `rounded-lg px-[1.8125rem] py-3 text-sm text-gray-800 dark:text-white/90`, `role="group"` labelled by the field label.
  Image upload: a Drawer with a preview and the Upload, library through DrawerFiles.
- Rich text HTML (TinyMCE 6.8.6, 013, duyệt 2026-10-15): the editor sits in BoEditorFrame (the frame draws the FIELD
  border and focus ring; TinyMCE's own border and inner ring are removed); skin `oxide` with `tinymce-overrides.css`
  mapping its colors to tokens through `--bo-tx-*` variables (light and `html.dark`, transparent toolbar), icons
  Material Symbols; content iframe CSS from `get-editor-styles.ts` on tokens via `cssVar()` (read at init, a theme
  switch applies on remount, as in Directus). Link: BoDialog form (Enter saves); source code, image and media: BoDrawer
  (media tabs with BoTabs); uploads with BoUpload and DrawerFiles. TinyMCE popups use z-index 100000, fullscreen 99999.
- Soft-length counter (Directus `softLength`), markdown (BoEditorFrame `data-remaining`):
  `mt-1.5 flex justify-end text-theme-xs tabular-nums`, `text-gray-500 dark:text-gray-400`; below 10 % remaining
  `text-warning-700 dark:text-warning-400`, below 5 % `text-error-600 dark:text-error-400` (Directus thresholds; the
  number itself shows the state); linked by `aria-describedby`, no live region. The `input` and `input-multiline`
  counters sit inside the field (input: append slot, shown on focus, `font-semibold`; multiline:
  `pointer-events-none absolute end-2.5 bottom-1.5 text-sm font-semibold tabular-nums`) and use
  `text-warning-600 dark:text-warning-500` below 10 %. Open: warning-600 text is 3.49:1 on white (below 4.5:1,
  migration-guide row marked "fail"); the recipe value is warning-700 (code to align).
- Loading: the markdown and block editors are async components and show no pulse area while their chunk loads (Deviation
  from the draft); the map frame sets `aria-busy` while MapLibre starts.

### Map frame (`BoMapFrame`; Directus `map` interface and layout)

- Built: `interfaces/map/InterfaceMap.vue` (MapLibre GL 6.14.0 + Mapbox Draw; no separate BoMapFrame component).
- Frame `relative overflow-hidden rounded-lg border border-gray-500 dark:border-gray-500`, `role="group"` labelled by
  the field label, `aria-describedby`, `aria-invalid`, `aria-busy` while loading; map area `relative h-112.5 w-full`
  (450px, Directus), `opacity-25` while loading or on error; the MapLibre canvas is labelled by the field label and gets
  the focus ring
  (`[&_.maplibregl-canvas:focus-visible]:outline-2 [&_.maplibregl-canvas:focus-visible]:-outline-offset-2 [&_.maplibregl-canvas:focus-visible]:outline-brand-500 dark:[&_.maplibregl-canvas:focus-visible]:outline-brand-400`).
- Controls `absolute end-3 top-3 flex flex-col gap-2`: zoom in, zoom out (also for nonEditable), geolocate, fit to data,
  one button per allowed draw type, delete (when something is selected):
  `flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-theme-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 FOCUS dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-dark`
  (Outline button colors), icon sm, `aria-label`; active draw mode `aria-pressed="true"` +
  `aria-pressed:bg-brand-50 aria-pressed:text-brand-600 dark:aria-pressed:bg-brand-500/15 dark:aria-pressed:text-brand-400`.
  The library's own control groups are hidden (`[&_.maplibregl-ctrl-group]:hidden`); the buttons drive their APIs.
- Basemap: Tier 1 Select (sr-only label `layouts.map.basemap`) in
  `absolute bottom-8 end-3 w-48 rounded-lg bg-white dark:bg-gray-900`; the choice is local to the field (D-45).
- Draw hint: `role="tooltip"` at the pointer,
  `pointer-events-none absolute rounded-lg bg-gray-900 px-3 py-2 text-theme-xs text-white shadow-theme-lg dark:bg-gray-800`.
- Loading: `BoProgressCircular` indeterminate, `text-brand-500 dark:text-brand-400`, centered, `aria-label` "Loading".
- Errors. Deviation: Notices under the map (`mt-3`), not an Alert only: invalid options = danger Notice; invalid
  geometry = warning Notice with "Continue" (secondary) and "Reset" (danger) Buttons, as Directus.
- Geocoder (only with a Mapbox key) and attribution are MapLibre DOM; the attribution links without underline are an
  accepted axe exception (`link-in-text-block`).
- Reduced motion. Deviation: no explicit `jumpTo`; MapLibre already makes `flyTo` / `easeTo` instant under
  `prefers-reduced-motion` (FR-094).

### Table, simple (`BoTable`; Directus `v-table` in relational lists)

- Built: `components/BoTable.vue`; used by DrawerCollection and the table layout of `list-o2m` and `list-m2m`.
- Tier 1 Table frame and scroller; `table.w-full.table-fixed` with `min-width` = sum of the column widths, a `colgroup`
  with the widths (default 130px, Directus), a filler column, and the sr-only caption.
- Sticky header: `thead` `sticky top-0 z-1 bg-white dark:bg-gray-900`; header row
  `border-b border-gray-200 dark:border-gray-700`; `th`
  `group relative truncate px-3 py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400` + `text-start` /
  `text-center` / `text-end`.
- Row height (Directus `spacing`): compact `h-[29px]`, cozy `h-[43px]` (default), comfortable `h-[58px]`; row
  `border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]`; cells
  `truncate px-3 py-0 text-theme-sm text-gray-500 dark:text-gray-400` (displays render inside).
- Select column (44px, `px-3`): Checkbox (BoCheckbox); header box = select all (multiple only, indeterminate when some,
  `aria-label` `select_all`), row box `aria-label` `select_item`; single selection also uses a checkbox and keeps the
  last one; selected row `aria-selected="true"` + `bg-gray-50 dark:bg-white/[0.03]` (the box shows the state; brand-50
  is not used: gray-500 on brand-50 is 4.46:1).
- Sort: `th` `aria-sort` (`ascending` / `descending` / `none`); header button
  `inline-flex max-w-full items-center gap-1 rounded FOCUS` with `arrow_upward` / `arrow_downward`
  `text-gray-500 dark:text-gray-400` (`aria-hidden`), visible on the sorted column, else on hover / focus
  (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`,
  `transition-opacity motion-reduce:transition-none`); toggling as Directus (asc → desc → none, or asc ↔ desc with
  `mustSort`).
- Manual sort (Directus `showManualSort`, new): first column (40px) with a header toggle
  `inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5 FOCUS`,
  `sort` icon, `aria-pressed`, `aria-label` and `title` `toggle_manual_sorting`; on
  `text-brand-500 dark:text-brand-400`, off `text-gray-500 dark:text-gray-400`. Row cell: `drag_handle`
  `cursor-grab text-gray-500 dark:text-gray-400` while sorted manually, else
  `cursor-not-allowed text-gray-300 dark:text-gray-600`. Dragging is mouse only, as Directus; the keyboard path is the
  row menu of the caller (SortableList row menu items).
- Resize handle (`th` `relative`, Directus `showResize`):
  `absolute -end-1 top-0 z-1 h-full w-2 cursor-col-resize after:absolute after:inset-y-2 after:start-1/2 after:w-px after:bg-gray-200 hover:after:bg-brand-500 dark:after:bg-gray-800 dark:hover:after:bg-brand-400`,
  `aria-hidden`, pointer only (minimum 32px, RTL aware).
- Open: keyboard resize is not built (Directus has none). The draft proposal (`role="separator"`
  `aria-orientation="vertical"` `tabindex="0"` + `FOCUS`, Left/Right ± 10px) needs an owner decision and a D-xx if
  wanted.
- Clickable rows (`click:row`). Deviation from the Tier 1 Table rule: the `tr` itself is focusable (`tabindex="0"`,
  `cursor-pointer FOCUS focus-visible:-outline-offset-2`) and Enter/Space activate it, as the Directus table-row; cell
  controls (checkbox, handle, actions) stop the row click.
- Item append column (`item-append` / `header-append`, `px-2`): row actions (open link, row menu, Remove).
- Loading: table `aria-busy="true"`, a header row with an indeterminate `PROGRESS`; without rows a
  `px-5 py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400` row with the loading text; empty: the same row
  with `no_items` (or the `empty` slot).

### Upload (`BoUpload`; Directus `v-upload`)

- Built: `components/files/BoUpload.vue`; used by `file`, `files`, `file-image`, markdown and block editor images.
- Dropzone:
  `flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-500 bg-gray-50 px-6 py-8 text-center transition-colors motion-reduce:transition-none dark:border-gray-500 dark:bg-white/[0.03]`,
  `aria-busy` while uploading.
- Idle: actions `flex items-center gap-2`: secondary Button `file_upload` "upload_from_device" (opens
  `<input type="file" class="sr-only" tabindex="-1" aria-hidden="true">`) and an `ICON_BTN` `more_vert` menu
  (`aria-label` `options`, Dropdown menu recipe) with `choose_from_library` and `import_from_url` as Directus
  `fromLibrary` / `fromUrl` allow; then the text `drag_file_here` (`choose_from_library` without device upload)
  `text-sm text-gray-700 dark:text-gray-400`. Deviation: no separate hint line.
- Drag over (`data-dragging`): `border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/[0.12]`, a
  `file_upload` icon (lg) and the Directus `drop_to_upload` text, both `text-gray-700 dark:text-gray-400` (not color
  alone).
- Uploading: percent and `upload_files_indeterminate` (done / total) or `upload_file_indeterminate`,
  `text-theme-sm text-gray-700 dark:text-gray-400`, then a `rounded-full` `PROGRESS`; progress moves per finished file
  (multipart `POST /files` through the SDK, no byte progress); an `aria-live="polite"` region announces start and end.
- Errors: zone `border-error-600 dark:border-error-400` + a `role="alert"` list
  `mt-1.5 text-theme-xs text-error-600 dark:text-error-400`, one line per file. Disabled:
  `cursor-not-allowed opacity-50`, drops ignored. Drop is pointer-only; the buttons give the keyboard path.
- Import from URL: Modal (BoDialog) `import_from_url` with a form: Input `type="url"` (label `url`, autofocus), then
  Cancel (secondary) and Import (primary submit, loading, disabled until the URL is valid).
- Upload dialogs of the callers: markdown image = Modal `upload_from_device` with the Upload and Cancel; block editor
  image = Drawer `upload_from_device` with a preview (`rounded-lg bg-gray-100 dark:bg-white/5`) and the Upload; "choose
  from library" opens DrawerFiles.

### Image preview and Lightbox (`FilePreview`, `FileLightbox`; Directus `image`, `file-preview`, `file-lightbox`)

- Built: `components/files/FilePreview.vue`, `components/files/FileLightbox.vue`, `interfaces/file-image/FileImage.vue`,
  `interfaces/file/File.vue`.
- FilePreview: outside a modal the preview is a `<button>` (`block w-full cursor-zoom-in rounded-xl FOCUS`) that opens
  the lightbox; image box
  `overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5` (`p-14` for SVG
  and small images), image `mx-auto block max-w-full object-contain`, `alt` = file title, `loading="lazy"`; loading
  `animate-pulse`; error `broken_image` (lg) + `image_load_error` `text-gray-500 dark:text-gray-400`. Not an image:
  `flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5`
  with `insert_drive_file` `text-gray-500 dark:text-gray-400` and the type
  `text-theme-xs font-medium uppercase text-gray-700 dark:text-gray-400`; video / audio with native controls.
- file-image card:
  `overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`; image area
  `relative flex w-full items-center justify-center overflow-hidden bg-gray-100 dark:bg-white/5`, `h-[200px]`
  (`max-h-[360px]` for full / fill widths), `object-contain` (`object-cover` when Directus `crop`, `p-7` letterbox),
  `alt=""` (the title is shown below); error: icon + message `text-gray-500 dark:text-gray-400`; footer
  `flex items-center gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-800` with title
  `truncate text-sm font-medium text-gray-800 dark:text-white/90`, meta
  `truncate text-theme-xs text-gray-500 dark:text-gray-400` and the actions (zoom, download link, edit, Remove) as
  `ICON_BTN`, always visible (Directus shows them on hover; hover-only would hide them from keyboard and touch).
  nonEditable: the image is a button that opens the details. Loading
  `h-[200px] animate-pulse rounded-xl bg-gray-100 dark:bg-white/5`.
- Lightbox: Reka `Dialog`; transparent overlay; content `fixed inset-0 z-99999 flex flex-col bg-gray-900/95 text-white`
  (same in both modes); header `flex items-center justify-between gap-3 px-4 py-3` with `DialogTitle`
  `m-0 min-w-0 truncate text-sm font-medium text-white` (file title); buttons
  `flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 FOCUS`: a
  download link (`aria-label` `download`) and `DialogClose` (`aria-label` `close`); media in `min-h-0 flex-1 p-4`, a
  click on it closes (Directus). Focus trap, Esc, focus return (Reka).

### ValueNull (`ValueNull`; Directus `value-null`)

- Built: `components/render/ValueNull.vue`.
- `<span class="text-gray-500 dark:text-gray-400"><span aria-hidden="true">--</span><span class="sr-only">…</span></span>`;
  the sr-only text is the Directus key `no_value`. Deviation: the draft planned a Backoffice overlay string; the
  Directus key exists in both languages.

### UserPopover (`UserPopover`; Directus `user-popover`)

- Built: `components/render/UserPopover.vue`; used by the `user` display.
- Trigger: `PopoverTrigger` wrapping the user display (Avatar small + name)
  `inline-flex max-w-full items-center gap-2 rounded-lg text-start FOCUS`; opens on click / Enter, and on hover after
  300 ms (closes 300 ms after leaving trigger and content; touch pointers ignored) like Directus; opening by hover does
  not move the focus.
- Content: `POPOVER w-[280px]`, `side="top"`; `flex items-center gap-3`: Avatar large (48px), then `min-w-0 space-y-1`:
  name `truncate text-sm font-medium text-gray-800 dark:text-white/90`; a row with the status light Badge (active
  success, invited primary, suspended warning, archived error, other light) and the role Chip; email
  `truncate text-theme-xs text-gray-500 dark:text-gray-400`; a router link `open`
  `text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 FOCUS` to the user.
- Loading: `progress_activity` spinning + `loading` `text-theme-sm text-gray-500 dark:text-gray-400`, `aria-busy`;
  error: `text-theme-sm text-error-700 dark:text-error-400`, `role="alert"`.

### "N items" menu (relational displays; Directus `related-values` and similar)

- Built: `components/render/ItemsMenu.vue`; used by `related-values`, `translations`, `formatted-json-value`.
- Trigger:
  `inline-flex items-center gap-1 rounded text-theme-sm text-gray-700 underline decoration-dotted underline-offset-4 hover:text-gray-800 FOCUS disabled:pointer-events-none disabled:text-gray-500 disabled:no-underline dark:text-gray-400 dark:hover:text-gray-300`;
  text = the Directus "N <unit>" (`+` from 100); opens on click / Enter; the click does not reach the table row.
  Deviation: no hover opening (the Directus related-values menu opens on click).
- Icon variant (`triggerClass`, translations display):
  `flex shrink-0 rounded text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100 FOCUS motion-reduce:transition-none dark:text-gray-400`
  with an `aria-label`.
- Content: `POPOVER min-w-48 p-2` + `PopoverArrow` `fill-white dark:fill-gray-dark`; focus moves into the content.
  related-values rows `flex items-center gap-2 px-3 py-2 text-theme-sm text-gray-700 dark:text-gray-400` with the
  rendered template and an icon link `launch` (`aria-label` `open`,
  `rounded text-gray-500 hover:text-brand-500 FOCUS dark:text-gray-400 dark:hover:text-brand-400`) to the item
  (read-only list, so a Popover, not a menu).

### SortableList row menu (D-60; `list`, `files`, `list-o2m`, `list-m2m`, `list-m2a`, tree view)

- Built: `components/BoSortableList.vue`; used by `list`, `files`, `list-o2m`, `list-m2m`, `list-m2a`,
  `collection-item-multiple-dropdown`, `list-o2m-tree-view` (NestedDraggable, `tree`).
- List `ul.space-y-2` (vuedraggable, `force-fallback`, handle `.drag-handle`, only `.draggable` rows move); row
  (Directus `list-interface` mixin):
  `flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]`;
  drag handle `drag_handle` (sm) `cursor-grab text-gray-500 dark:text-gray-400` (mouse only); chosen row `opacity-50`,
  ghost `shadow-theme-lg`. Rows that cannot move (deleted, disabled field, sorting off) have no handle and no move
  items.
- Row content of the interfaces: a button that opens the item
  `min-w-0 flex-1 rounded text-start text-sm text-gray-800 FOCUS dark:text-white/90`; deleted rows
  `text-error-600 line-through dark:text-error-400`; link `ICON_BTN` `launch` (`navigate_to_item`); Remove.
- Menu: `ICON_BTN` `more_vert` (class `row-menu`, `aria-label` `item_options` with the row name) + Dropdown menu recipe
  (`align="end"`): the row actions of the interface, then "Move up" (`arrow_upward`), "Move down" (`arrow_downward`);
  the tree view adds "Indent" (`format_indent_increase`) and "Outdent" (`format_indent_decrease`). Move up is `disabled`
  on the first row, Move down on the last, Indent on the first row (no previous sibling), Outdent at the root; strings
  in the overlay (D-60). The menu is hidden when a row has no item. Deviation: no separator between the row actions and
  the move items (BoMenu has no separator item).
- After a move, focus returns to the moved row's menu trigger and a `sr-only` `aria-live="polite"` `aria-atomic` region
  says the new position (`moved_to_position`, overlay string).

### Remove button (`BoRemove`; Directus `v-remove`)

- Built: `components/BoRemove.vue` (+ `getRemoveAction` for row-menu items).
- `ICON_BTN` with the destructive hover (`hover:text-error-600 dark:hover:text-error-400`), icon (sm) by the Directus
  rule: `delete` "Remove item" (`remove_item`), `close` "Deselect" (`deselect`, local or deselectable items),
  `settings_backup_restore` "Undo removed item" (`undo_removed_item`, deleted rows); `aria-label` = that text, `title`
  when enabled; the caller's classes (e.g. a round button on an image) come through `$attrs`.
- Items with unsaved edits (or `confirm`) ask first: Modal (BoDialog) `batch_delete_confirm` with Cancel (secondary) and
  Delete (danger, `delete_label`).

### Field label row (Q-1; Directus `form-field-label`, `form-field-menu`)

- Built: `components/form/FormFieldLabel.vue`, `FormFieldMenu.vue`, `FormField.vue`, `FormFieldRawEditor.vue`.
- Row: `group mb-1.5 flex min-h-6 items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-400`; the name
  is the `<label for>` (`min-w-0 truncate`, full name in `title`; its `id` is used by `aria-labelledby` for groups);
  batch-edit Checkbox (labelled by the label) before it (Directus batch mode). Disabled field:
  `text-gray-500 dark:text-gray-400`. Deviation: Tier 1 disabled labels are gray-300; the form keeps disabled labels
  readable (4.97:1).
- Required: the Tier 1 required mark + sr-only "required". Edited dot:
  `h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-400`, Tooltip and sr-only `edited` (Directus uses the subdued text
  color; research R6's `bg-warning-500` is not used); hidden in batch mode, on error and while loading.
- Hidden: light Badge (sm) with `visibility_off` icon and `hidden`; group `badge`: light Badge. Raw value toggle:
  `ICON_BTN h-6 w-6` (`data_object`, Tooltip `toggle_raw_editor`, `aria-pressed`; on
  `bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400`).
- Menu: Reka `DropdownMenuTrigger` `ICON_BTN h-6 w-6` `expand_more` (`aria-label` "<field>: Options"), shown on hover,
  focus and while open
  (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100`);
  Dropdown menu recipe items with icons: edit / view raw value, copy, paste, separator, reset to default, undo changes,
  clear value (Directus rules for hidden and disabled items).
- Raw value: Modal (BoDialog) "Edit raw value" / "View raw value" with the code editor (JSON) or the system raw editor,
  Cancel and Done.
- Note (Directus `note`, markdown via `marked` + `dompurify`):
  `mt-1.5 block max-w-[29.25rem] text-theme-xs text-gray-500 dark:text-gray-400`, links
  `text-brand-500 underline hover:text-brand-600 dark:text-brand-400`, in `aria-describedby`.
- Validation text: `mt-1.5 flex items-center gap-1 text-theme-xs text-error-600 dark:text-error-400` (Directus prefix +
  message); with a custom `validation_message`, that text and a `help` icon button (`FOCUS_ERROR`, `aria-label` and
  Tooltip = the default message). Linked by `aria-describedby`.
- Hidden label (e.g. a section header shows the name): sr-only `<label>`; half widths keep a `mb-1.5 h-6` spacer.

### ValidationErrors notice (Directus `validation-errors`)

- Built: `components/form/ValidationErrors.vue`, `ValidationNestedGroups.vue`, `ValidationNestedGroupsList.vue`.
- Alert error recipe (BoNotice `danger`, `role="alert"`), `col-span-full`; title
  `mb-1 text-sm font-semibold text-gray-800 dark:text-white/90` `validation_errors_notice`.
- List `mt-2 list-disc space-y-1 ps-5 text-sm`; each entry: field name as
  `<button type="button" class="rounded font-medium text-gray-800 underline underline-offset-2 hover:text-gray-700 FOCUS dark:text-white/90">`
  (scrolls to the field and focuses it, as the Directus link; "(hidden)" / "hidden in group" suffixes as Directus) + the
  message `text-gray-500 dark:text-gray-400` (custom validation messages as written).
- Nested validation (Directus validation structure): a toggle `expand_circle_down` (`aria-label` `toggle`,
  `aria-expanded`, rotated when collapsed) and nested lists (`list-disc` for "and", `list-[square]` for "or", uppercase
  group labels, field names in `strong`).

### Flow dialogs (`FlowDialogs`; Directus `flow-dialogs`)

- Built: `interfaces/presentation-header/FlowDialogs.vue`; used by `presentation-header`, `presentation-links` and
  DrawerItem.
- Modal recipe (BoDialog): unsaved changes (`unsaved_changes`, `run_flow_on_current_edited_confirm`) with Cancel
  (secondary) and the confirm button; custom confirmation (the flow's description as title) with the flow's fields as a
  form grid (autofocus), Cancel and the confirm button (disabled until the required fields are filled). Enter does not
  confirm (Directus `@apply`), the button does.
- Result: a Notice (success / danger, `role="status"` / `"alert"`) under the dialogs (`mt-3`), because there is no
  snackbar before feature 018 (D-45).
- Open: BoDialog (all 013 dialogs) has no close button in the corner; Esc, the outside click and Cancel close it. The
  Tier 1 Modal recipe has one. `persistent` (Directus `v-dialog persistent`, e.g. the 016 create role and create policy
  dialogs) ignores the outside click; Esc and Cancel still close.

## Tier 3 recipes, nháp (014)

**Draft (nháp, 014)** for the open questions Q-2 to Q-12 of `specs/014-content-module/spec.md`, written before the code
(FR-110), then updated to the code as built (T098) like the 013 recipes: each recipe names the files it describes
(`apps/web/src/components/`, `layouts/`, `modules/content/`, `interfaces/_system/system-filter/`). "Deviation" lines say
where the code differs from the first draft, with the reason; "Open" lines are questions for the design owner. The
design owner reviews them before 014 closes (SC-009; review checklist
`specs/014-content-module/design-review/README.md`). Behaviour is the Directus one (screens of `modules/content`,
`layouts/*`, `views/private/components/*`); classes reuse the Tier 1 recipes and the 013 Tier 3 recipes (`FOCUS`,
`ICON_BTN`, `POPOVER`, `PROGRESS`). Every color pair is already in the contrast table of `migration-guide.md` (no new
pair in 014).

Shared menu classes (Reka `DropdownMenu`, declared locally in each component): panel
`z-99999 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark`;
item
`flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 data-[disabled]:text-gray-300 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300`
with a `sm` icon `text-gray-500 dark:text-gray-400`; checked radio item `menu-dropdown-item-active`; danger item
`text-error-600 data-[highlighted]:bg-error-50 dark:text-error-400 dark:data-[highlighted]:bg-error-500/15`; separator
`my-1 border-t border-gray-200 dark:border-gray-800`. Simple menus use `BoMenu` (same classes, items as data).

### Data table and pagination (Q-2; `BoTable` extended, `BoPagination`; Directus `v-table`, `v-pagination`)

Built: `components/BoTable.vue`, `components/BoPagination.vue`,
`layouts/tabular/{Tabular,TabularActions,TabularOptions}.vue`.

- `BoTable` (013 recipe "Table, simple") gains optional props only: `fixedHeader` (the table sits in its own
  `min-h-0 flex-1 overflow-auto` scroller of the layout height, the header stays sticky), column `width`, `align`
  (`text-start` / `text-center` / `text-end` on `th` and cells), `description` (header `title` plus an sr-only
  "(description)"), `sortable`, `rowHeight` (Directus spacing), `allowHeaderReorder`, the `manual-sort` event
  (`{ item, to }`) and a `header-context-menu` slot.
- Header button: the label, then `arrow_upward` / `arrow_downward` on the sorted column, else `arrow_drop_down` (`sm`,
  gray-500), `FOCUS`; it opens a Reka Dropdown menu (shared menu classes): radio group `sort_asc` / `sort_desc`
  (disabled when the column cannot sort), separator, radio group `left_align` / `center_align` / `right_align`,
  separator, `move_left` / `move_right` (D-69, disabled at the ends), a width row (`field_width` text and a number input
  `h-8 w-24`, min 32, Enter applies), separator, `hide_field`. `aria-sort` stays on `th`.
- Column reorder: the header content is draggable (`cursor-grab`), the target `th` shows `border-s-2 border-brand-500`;
  keyboard path = Move left / Move right, announced in a polite live region. Deviation: native HTML drag and drop on the
  header instead of vuedraggable on the header row, so the rows keep the only Draggable.
- Add column: the `header-append` cell holds an `ICON_BTN` `add` (`aria-label` and `title` `add_field`) opening a
  `POPOVER` (`w-80`, `align="end"`) with `FieldList` (fields already shown are disabled).
- Manual sort: the 013 row drag handle; while the table is sorted manually each row also has a row menu (`ICON_BTN`
  `h-7 w-7` `more_vert`, `aria-label` `item_options`) with `move_up` / `move_down` (D-69).
- Pagination (`BoPagination`): `nav aria-label` (collection name) `flex items-center gap-1`, hidden with one page or
  none; buttons
  `inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-theme-sm FOCUS disabled:cursor-not-allowed disabled:opacity-50`,
  idle `text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5`, current
  `bg-brand-500 text-white aria-current="page"`, gaps `…` (`text-gray-500`, `aria-hidden`), previous/next icon buttons
  `chevron_left` / `chevron_right` with `aria-label` `previous` / `next`; `totalVisible` 7 plus the first and last page
  (`showFirstLast`, Directus tabular values). Compact variant (revisions): `totalVisible` 3, no first/last.
- Footer row:
  `flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-800`:
  pagination at the start, `per_page` BoSelect at the end with its label inline
  (`flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400`, trigger `w-24`), shown when a page has 25
  rows or more or the limit is below 25 (Directus). Deviation: the Select is the Tier 1 `h-11` BoSelect, not `h-9` (one
  Select size in the app). Deviation: no skeleton while the count loads; the pagination shows once the count is there.
- Count line (layout actions, `TabularActions`):
  `sr-only whitespace-nowrap text-theme-sm text-gray-500 sm:not-sr-only dark:text-gray-400`, `role="status"`
  `aria-live="polite"`, always in the DOM (FR-115b), the sort change in sr-only text. Deviation: below `sm` it is
  screen-reader only, not `display: none` (Directus), so the page change is still announced.
- Ctrl/Cmd + A on the table box selects all (Directus `useShortcut('meta+a')`).

### Cards grid (Q-3; Directus `layouts/cards`)

Built: `layouts/cards/{Cards,CardsActions,CardsOptions}.vue`, `layouts/cards/components/{Card,CardsHeader}.vue`.

- Grid `grid gap-6` with `grid-template-columns: repeat(auto-fill, minmax(<size × 40>px, 1fr))` (inline style from the
  `size` option). Deviation: `size × 40` px instead of the Directus `size × 2.25rem` (40 px is the width its
  `isSingleRow` already uses).
- Card:
  `group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-white/[0.03]`;
  the body is a link (`href` from the router, `flex flex-col gap-2 rounded-xl FOCUS`; Enter opens, Space and click
  toggle the selection in select mode as Directus); image box
  `relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800` with
  `object-cover` (crop) or `object-contain` (SVG `h-3/4 w-3/4 object-contain`); fallback icon
  `lg text-gray-500 dark:text-gray-400` (collection icon, or `insert_drive_file` plus the extension
  `text-theme-xs font-medium uppercase` for files); title
  `truncate text-theme-sm font-medium text-gray-800 dark:text-white/90`, subtitle
  `truncate text-theme-xs text-gray-500 dark:text-gray-400`.
- Selection: a BoCheckbox outside the link (no interactive element inside a link),
  `absolute start-3 top-3 rounded-md bg-white dark:bg-gray-900`,
  `opacity-0 group-hover:opacity-100 focus-within:opacity-100` (always visible in select mode or when any card is
  selected), `aria-label` `select_item_key`; selected card `ring-2 ring-brand-500`.
- Header bar above the grid (`CardsHeader`):
  `mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-gray-200 px-2 py-2 dark:border-gray-800`:
  select-all BoCheckbox (indeterminate while items are selected, a click clears them), then card size `ICON_BTN`
  (`h-9 w-9`, `grid_view`, `aria-label` `card_size`), sort field BoSelect (`w-44`, sr-only label, sortable fields only),
  direction `ICON_BTN` `sort` (`aria-pressed`, flipped when descending) and the `per_page` BoSelect (tabular rule).
  Deviation: `grid_view` for every size (Material Symbols has no `grid_<n>`); unsortable fields are left out of the
  Select (Directus shows them disabled); the bar is not sticky.
- Footer: BoPagination (`pt-9`), no skeleton while the count loads (as tabular).
- Loading: 12 skeleton cards (image
  `aspect-square animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 motion-reduce:animate-none` and a `h-4 w-2/3`
  line), the grid `aria-busy`. Count line as tabular.

### Calendar layout (Q-4; FullCalendar 6 as Directus `layouts/calendar`)

Built: `layouts/calendar/{Calendar,CalendarActions,CalendarOptions}.vue`, `layouts/calendar/calendar.css`.

- FullCalendar keeps its DOM; `calendar.css` sets its variables on `.bo-calendar .fc` (they win over the `:root`
  defaults FullCalendar injects) from the theme, light and `.dark`: `--fc-border-color` gray-200 (dark gray-800),
  `--fc-page-bg-color` white (dark gray-900), `--fc-neutral-bg-color` gray-50 (dark white 3 %), `--fc-today-bg-color` /
  `--fc-highlight-color` brand-50 (dark brand-500 12 %), `--fc-event-bg-color` and `--fc-event-border-color` brand-500,
  `--fc-event-text-color` white, `--fc-now-indicator-color` error-500, buttons: text gray-700, background white, border
  gray-300, hover gray-50, active brand-50 (dark: gray-400 on gray-800, border gray-700).
- Toolbar (`flex-wrap`, gap 0.75rem): buttons are the Tier 1 outline Button look through `.fc .fc-button` (`h-9`,
  `rounded-lg`, `text-theme-sm font-medium`, active `text-brand-600` / dark `brand-400`, disabled 50 %), focus = `FOCUS`
  outline (the FullCalendar box shadow is removed); title `text-lg font-semibold text-gray-800 dark:text-white/90`. The
  toolbar icons FullCalendar renders as unnamed `role="img"` get `aria-hidden` (the button `title` names it). Deviation:
  outline buttons instead of the Directus text buttons; the toolbar is not sticky.
- Day cells, headers and list: `text-theme-sm`, numbers `font-medium`, text gray-700 (dark gray-400); "more" links and
  dot events brand-600 (dark brand-400); selected events `box-shadow 0 0 0 2px brand-300`; select mode puts a Material
  Symbols check box (radio for single select) before the title, as Directus.
- Notice above when the dataset is cut (`dataset_too_large_currently_showing_n_items`): BoNotice warning (Tier 1 Alert).
- `prefers-reduced-motion`: the global rule of `styles/base.css` plus `dragRevertDuration: 0`.
- Keyboard path of the event drag (D-69): the dates are edited in the item form; no extra UI. Count line as tabular.

### Kanban board (Q-5; Directus `layouts/kanban`)

Built: `layouts/kanban/{Kanban,KanbanActions,KanbanOptions}.vue`.

- Board `flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4 custom-scrollbar` (the board scrolls, the page does not,
  FR-116); column `section` (`aria-label` = group title)
  `flex w-72 shrink-0 flex-col rounded-2xl bg-gray-50 dark:bg-white/[0.03]` (`cursor-move` when columns can be
  reordered); column header `flex items-center gap-2 px-3 py-2`: `h3` title
  `truncate text-theme-sm font-medium text-gray-800 dark:text-white/90`, count Badge light, column menu (`ICON_BTN`
  `h-7 w-7` `more_horiz`, `aria-label` `item_options`): `layouts.kanban.edit_group`, delete (danger), separator,
  `move_left` / `move_right` (D-69). The menu shows for relational groups, and for `choices` groups when they can be
  reordered. Deleting a group asks first in a BoDialog (`delete_are_you_sure`, Cancel first, danger Delete, D-74:
  Directus deletes at once).
- Cards list `flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3`. Card
  `relative cursor-pointer rounded-xl border border-gray-200 bg-white p-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 FOCUS`,
  `tabindex="0"` (Enter / Space opens it, as a table row), selected `ring-2 ring-brand-500 dark:ring-brand-400`; content
  in the Directus order: title `mb-1 pe-8 text-theme-sm font-medium text-gray-800 dark:text-white/90`, image
  `mt-1 w-full rounded-lg` (`aspect-[5/3] object-cover` when cropped, else `max-h-64 object-contain`), text
  `mt-1 line-clamp-3 text-theme-xs text-gray-500 dark:text-gray-400`, tags (labels display, 013 Chips), footer row date
  (`text-theme-xs text-gray-500`) and up to 3 avatars `-space-x-2`
  (`h-7 w-7 rounded-full border-2 border-white dark:border-gray-900`, `person` fallback) plus `+N`. Deviation: the title
  is above the image (Directus order), and the avatars are inline `h-7` circles, not the Avatar component.
- Card menu (`ICON_BTN` `h-7 w-7` `more_vert`, `absolute end-2 top-2`, `opacity-0`, visible on card hover, focus within
  or while open): `move_to_group` sub menu (the other columns), `move_up` / `move_down` when the group has a sort field
  (D-69); moves are announced in a polite live region.
- Add group (relational groups, create permission): a column
  `flex w-72 shrink-0 items-start justify-center rounded-2xl border-2 border-dashed border-gray-200 p-3 dark:border-gray-800`
  with a secondary Button `add` (`layouts.kanban.add_group`) opening the add dialog (BoDialog with one Input).
  Deviation: Directus has the dialog but no button for it.
- Drag: `ghost-class` `opacity-50`. Deviation: no drop zone highlight (`bg-brand-50`): vuedraggable gives none and the
  ghost already shows the target place.
- Dataset cut: BoNotice warning above the board, as calendar.

### Map layout (Q-6; `BoMapFrame` of 013; Directus `layouts/map`)

Built: `layouts/map/{MapLayout,MapActions,MapOptions}.vue`, `layouts/map/components/MapView.vue`,
`layouts/map/style.ts`.

- Frame
  `relative h-[calc(100vh-12rem)] min-h-120 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`,
  `aria-busy` while loading; the map dims (`opacity-90` loading, `opacity-40` on error or without a geometry field).
- Controls: the library control groups are hidden; a column of theme buttons
  `absolute start-3 top-3 flex flex-col gap-2`, each
  `flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-theme-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 FOCUS dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700`,
  pressed `bg-brand-50 text-brand-600` (dark `brand-500/15`, `brand-400`): zoom in `add`, zoom out `remove`, geolocate
  `my_location`, fit data `fit_screen`, box select `highlight_alt` (`aria-pressed`; Shift + drag still box-selects). The
  canvas gets the `FOCUS` outline (inset). The Mapbox geocoder and its CSS load only with a Mapbox key.
- Item popup on hover:
  `pointer-events-none fixed z-99999 max-w-[80%] rounded-lg bg-white px-3 py-2 text-theme-sm font-medium text-gray-800 shadow-theme-lg dark:bg-gray-dark dark:text-white/90`,
  the rendered template.
- Feature colors (`style.ts`, read once from the theme): brand-500 for features, orange-500 for hovered and selected
  ones, clusters in brand-300 / orange-200 / error-300 steps. Deviation: selected features are orange-500 (Directus
  `--theme--secondary`), not brand-500 as the draft said.
- Keyboard list (D-69, `MapActions` in the layout actions): a round `h-11 w-11` button `list` (`aria-label`
  `map_items_in_view`) opening a Popover `max-h-80 w-80 overflow-auto rounded-2xl ... p-2` with a heading and up to 100
  items of the map as buttons (open the item; in select mode `aria-pressed` and a check box icon, select).
- Footer (over the map, `absolute end-0 bottom-0 flex gap-3 p-3`): BoPagination (`totalVisible` 7, first/last) and the
  `limit` BoSelect, each on a `rounded-lg bg-white shadow-theme-sm dark:bg-gray-dark` plate.
- Errors over the map (`absolute inset-0 flex items-center justify-center p-6`): the layout error slot on a white plate;
  a geometry error = BoNotice danger `role="alert"` (`layouts.map.invalid_geometry` and the message); loading =
  BoProgressCircular brand-500; no geometry field = BoInfo `layouts.map.no_compatible_fields` (`wrong_location`).
  Deviation: BoNotice danger instead of an Alert error (same Tier 1 Alert classes, BoNotice is the app component).
- Layout options (`MapOptions`): basemap Select (`layouts.map.basemap`, kept in the app store like Directus), geometry
  field Select, display template text Input, cluster Checkbox.

### Search and advanced filter (Q-7; `SearchInput`, `SystemFilter`; Directus `search-input`, `system-filter`)

Built: `components/SearchInput.vue`, `components/FieldList.vue`,
`interfaces/_system/system-filter/{SystemFilter,Nodes,InputGroup,InputComponent}.vue`.

- `SearchInput` (page header actions; also the item select drawer): `role="search"` pill
  `relative flex h-11 items-center rounded-full border border-gray-200 bg-white px-1 transition-[width] duration-200 motion-reduce:transition-none dark:border-gray-800 dark:bg-gray-900`,
  `w-11` idle (`w-20` when the filter button shows), `w-72 max-w-[calc(100vw-2rem)]` when active or filled; `ICON_BTN`
  buttons `search`, clear (`close`, `clear_value`) and filter (`filter_list`, `aria-label` `filter`) with a count badge
  `absolute -end-0.5 -bottom-0.5 min-w-4 rounded-full bg-brand-500 px-1 text-theme-xs font-medium text-white` when
  filters are active; input without border (`aria-label` = placeholder or `search_items`). Esc collapses the pill and
  blurs the input (Directus `disable`). Deviation: buttons instead of clickable icons (FR-027); the filter opens in a
  Reka Popover anchored to the pill instead of the inline expand.
- Filter panel: Popover
  `z-99999 w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-700 dark:bg-gray-800`,
  `SystemFilter` inside (016 Q-28: the dark surface is lifted above the table card; nested filter popovers match).
  Inside a drawer the drawer body is the collision boundary and the width is capped by
  `--reka-popover-content-available-width`, so the panel stays within the drawer.
- `SystemFilter`: the rule list in a box
  `mb-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900` (no box when `inline`),
  empty = `interfaces.filter.no_rules` in `font-mono text-theme-sm text-gray-500`; rule row = the Directus `.header`
  pill (016 Q-28)
  `flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-gray-200 bg-white py-0.5 ps-1.5 pe-1 text-theme-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90`:
  drag handle (`cursor-grab`), field button (chip button `rounded-md px-1.5 py-0.5 hover:bg-gray-100`, opens `FieldList`
  in a `POPOVER` `w-80`), operator button (same chip, `font-semibold`, BoMenu of `operators.*`), value control, then at
  the end the row menu (`size-7` `more_vert`) and remove (`hover:text-error-500`). Group rows: a logic chip button
  (`and` `bg-brand-50 text-brand-500`, `or` `bg-orange-50 text-orange-500`, dark `/15`, `text-theme-xs font-semibold`)
  that toggles `_and` / `_or`, children indented `ms-4 border-s border-gray-200 ps-6 dark:border-gray-800`. Deviation:
  the logic chip is brand / orange like the Directus primary / secondary, not a light Badge.
- Value controls (`InputComponent`): a text input that grows with its text (`size`), Directus patterns and dynamic
  variables (`$NOW(-7 days)`, `$CURRENT_USER`); choices = BoMenu; dates = BoDatePicker in a Popover; json, text, hash,
  geometry = the 013 interface of the same id in a Popover. Deviation: no `allow-other` on choices.
- Add filter: a text Button
  `inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-theme-sm font-medium text-brand-500 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/15 FOCUS`
  (`interfaces.filter.add_filter` and an `expand_more` that flips when open) opening a `POPOVER` `w-80`: "And / Or
  group" first, a separator, then `FieldList`. Rule menu: `move_up` / `move_down` (D-69, announced, focus back on the
  menu). Deviation: no "wrap in group" item (no Directus equivalent); delete stays the row's remove button.
- Field list (`FieldList`): a search Input on top, one flat `ul role="tree"` (`aria-label` fields,
  `max-h-80 overflow-auto`) of `treeitem` rows (`aria-level`, roving tabindex, Up/Down/Left/Right/Home/End, Enter/Space,
  the §9 rules of layout-patterns); relational fields have a `chevron_right` toggle (`size-6`, turns 90°, lazy
  children); functions listed under date fields (`auto_awesome`, brand text); no match = `role="status"` text.
  Deviation: no search highlight (BoTextOverflow has none) and no `$version` field yet.

### Page header controls (Q-8; bookmark, version menu, save split button, notices)

Built: `modules/content/routes/{CollectionRoute,ItemRoute}.vue`,
`modules/content/components/{BookmarkAdd,VersionMenu}.vue`, `components/SaveOptions.vue`, `components/NoticeStack.vue`,
`layout/PageHeader.vue` (slots `title-append`, `headline-append`).

- Bookmark controls in `title-append` (`flex items-center gap-1`), each
  `inline-flex size-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 FOCUS` with a `sm`
  icon: `bookmark` gray-500 (create, opens the dialog), `bookmark` filled `text-brand-500 dark:text-brand-400` (saved),
  `bookmark_save` `text-warning-600 dark:text-warning-400` (unsaved changes of my bookmark, saves), and a reset button
  `settings_backup_restore` gray-500 next to it while my bookmark has unsaved changes; names by `aria-label` and `title`
  (`create_bookmark`, `update_bookmark`, `reset_bookmark`). Deviation: the saved state is a plain icon (not a button; it
  has no action, as Directus) and the hints are `title` attributes, not BoTooltip. A share session gets no bookmark
  controls (it writes no presets, FR-084).
- Bookmark dialog (`BookmarkAdd`): BoDialog (Tier 1 Modal) `create_bookmark`, form `grid grid-cols-2 gap-4`: name
  (`system-input-translated-string`, full width, autofocus), icon picker and color picker (half each); Cancel / Save
  (disabled without a name); Enter submits, Esc or outside click cancels.
- Version menu (`VersionMenu`, `headline-append` = the breadcrumb line, after a `•`): button
  `inline-flex h-8 min-w-0 items-center gap-1 rounded-lg px-2 text-theme-sm text-gray-700 hover:bg-gray-100 FOCUS dark:text-gray-400 dark:hover:bg-white/5`
  with `published_with_changes`, the version name (truncated) and `arrow_drop_down`, `aria-label` "Version: <name>";
  menu (`max-w-64`): radio items main, the global draft and the local versions (checked `bg-brand-50 text-brand-600`,
  dark `brand-500/12` and `brand-400`; a `size-1.5` brand dot plus sr-only `content_edited` marks a version with edits),
  separator, `create_version`, separator, `promote_version` (opens the comparison modal), `rename_version`,
  `delete_version` (danger; `discard_changes` with `undo` for the global draft). Dialogs are BoDialogs (Enter submits
  create/rename; a reserved key shows `reserved_version_key` as the key field error). Deviation: no separate "compare"
  item: promote opens the comparison (Directus). Deviation: the menu is not modal (`:modal="false"`, as v-menu): a modal
  Reka menu sets `aria-hidden` on the page while its controls stay tabbable (axe `aria-hidden-focus`).
- Save split button: primary icon Button `check` (`aria-label` `save`, `rounded-e-none` when the menu follows) and
  `SaveOptions`: secondary icon Button `more_vert` (`rounded-s-none`, `aria-label` `more_save_options`) opening a
  Dropdown with `save_and_stay`, `save_and_create_new` (each with its shortcut hint
  `ms-auto ps-4 text-theme-xs text-gray-500`), `save_as_copy`, `discard_all_changes`. On a version: primary `beenhere`
  (`save_version`) and a BoMenu with `save_and_return_to_main`, `save_and_quit` (shortcut in the text, BoMenu has no
  hint column), `discard_all_changes`.
- Item actions before save: live preview toggle (secondary icon Button `visibility`, primary while the preview is on,
  `aria-pressed`, `live_preview.enable` / `live_preview.disable`), secondary icon Buttons `delete` and `archive` /
  `unarchive`; `not_allowed` as name and title when disabled. Collection page with a selection: `delete` (secondary,
  `hover:bg-error-600 hover:text-white`), `archive`, `edit` (batch), then the primary `add` (`create_item`). The item
  page `delete` has the same danger hover (design owner, 2026-10-15).
- Title skeleton (item page with a display template):
  `inline-block h-6 w-48 animate-pulse rounded-lg bg-gray-100 align-middle motion-reduce:animate-none dark:bg-gray-800`
  with `aria-label` `loading`. Deviation: `h-6 w-48 bg-gray-100` like the drawer title skeleton of §8 (the draft said
  `h-7 w-64 bg-gray-200`).
- Notices (D-66, `NoticeStack` in PrivateView): under the page header, `flex flex-col gap-2` `role="status"`
  `aria-live="polite"`, one BoNotice per notice (title `font-medium`, text) with a ghost `close` Button (`dismiss`);
  notices that are not `persist` go after 3 s (Directus notifications store); unexpected errors open a BoDialog with the
  title, text and `[code] message` in a `pre` (`rounded-lg bg-gray-100 p-3 text-theme-xs`), Dismiss. The live region is
  always in the page (empty without notices, `mb-4` only with notices) so the first notice is announced too (design
  owner, 2026-10-15).

### Detail panel sections (Q-9; `SidebarDetail`; Directus `sidebar-detail`)

Built:
`components/sidebar/{SidebarDetail,LayoutSidebarDetail,ArchiveSidebarDetail,RefreshSidebarDetail,ExportSidebarDetail,FlowSidebarDetail}.vue`.

- L-4 section block (layout-patterns §7): each section is its own Reka `AccordionRoot` (single, collapsible) bound to
  `sidebarStore.activeAccordionItem`, so one section is open at a time; item
  `border-b border-gray-200 dark:border-gray-800`; trigger
  `group flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-start FOCUS` with the icon (gray-500), title
  `min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800 dark:text-white/90`, the badge, and `expand_more`
  turning 180° when open (`motion-reduce:transition-none`); content
  `px-5 pb-5 text-theme-sm text-gray-500 dark:text-gray-400`. Deviation: the badge is a light BoChip with a value, or a
  `size-2` brand dot when it is only "on" (archive, refresh); one AccordionRoot per section because DetailPanel has no
  shared root.
- Layout section (`layers`, `layout_options`): layout BoSelect with item icons, then the layout options stacked
  (`flex flex-col gap-4.5`, BoSelect / BoInput / BoCheckbox with their labels).
- Archive (`archive`) and Refresh (`sync` / `sync_disabled`): one BoSelect each. Deviation: Reka Select items cannot
  have an empty value, so "not archived" and "do not refresh" are the `active` / `none` items.
- Flows (`bolt`): one secondary Button per manual flow (`full-width justify-start`, `flex flex-col gap-3.5`), the flow
  icon with the flow color as a data color (`style`), loading while running, disabled with the reason in a BoTooltip on
  a wrapper (a disabled button gets no pointer events). Deviation: the color is on the icon, not the button background.
- Import / export (`import_export`): recipe Q-12.

### Revisions and comparison (Q-10)

Built: `components/sidebar/{RevisionsSidebarDetail,RevisionsDateGroup,RevisionItem}.vue`,
`components/comparison/{ComparisonModal,ComparisonHeader,ComparisonToggle}.vue`, `components/form/BoForm.vue`
(comparison classes).

- Revisions section (`change_history`, badge = count): loading `PROGRESS` indeterminate, empty `no_revisions` (italic);
  date group heading `h3` `mb-1 px-2 text-theme-xs font-medium uppercase text-gray-500 dark:text-gray-400`, then rows
  (button) `flex w-full gap-3 rounded-lg px-2 py-2 text-start hover:bg-gray-50 FOCUS dark:hover:bg-white/5`: action dot
  `mt-1.5 size-2 rounded-full` (create success-500, update brand-500, delete error-500, version save and others
  warning-500), the action written (`text-theme-sm font-medium`), then time and user
  `truncate text-theme-xs text-gray-500`; `revision_delta_created_externally` on the last page; BoPagination compact,
  centered. Deviation: the dot colors are the recipe ones (Directus: primary for create, update and version save, danger
  for delete); the user name is plain text (Directus nests a user popover button inside the row button, invalid HTML).
- Comparison modal: a Reka Dialog with the Tier 1 Modal overlay (`bg-gray-900/40 backdrop-blur-[2px] dark:bg-gray-950/60`) and panel
  `max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl rounded-3xl bg-white dark:bg-gray-900`, sr-only title
  (`promote_version` / `item_revision`); body two columns `grid grid-cols-1 md:grid-cols-2` (the second with
  `md:border-l`), each with a `ComparisonHeader` (`text-lg font-semibold` title, date and `edited_by` user; the incoming
  side of a revision has a BoMenu picker of revisions) over a read-only BoForm (skeleton rows while loading). Differing
  fields: `rounded-sm bg-warning-50 ring-8 ring-warning-50 dark:bg-warning-500/15 dark:ring-warning-500/15` and a
  Checkbox in the label row on the incoming side. `outdated` (version mode): BoNotice warning `main_updated_notice` on
  top. Footer `flex flex-col gap-4 border-t px-6 py-4 lg:flex-row lg:justify-between`: `differences_count`
  (`role="status"`), in revision mode `comparing_to` with `ComparisonToggle` (chip button: "previous" solid brand,
  "latest" light), then the `show_differences_only` Switch, `select_all_differences` Checkbox (n/total), in version mode
  the `delete_version_after_promote` Checkbox, the hint when Apply is disabled (text, `aria-describedby`), Cancel
  (secondary, `close`) and `apply` (primary). Focus returns to the element that opened the modal. Deviation: no shared
  "base / incoming" header row (each column has its header); the panel is a Reka Dialog because BoDialog is fixed at 700
  px; the delete-version choice is a footer Checkbox instead of the Directus keep/delete dialog; no `collab` mode
  (D-68).

### Comments and shares (Q-11)

Built:
`components/sidebar/{CommentsSidebarDetail,CommentInput,CommentItem,CommentItemHeader,SharesSidebarDetail,ShareItem}.vue`.

- Comments section (`chat_bubble_outline`): input first, then date groups with a sticky heading
  (`sticky top-0 z-1 bg-white py-1 text-theme-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400`);
  loading `PROGRESS`, empty `no_comments`, load error BoNotice danger.
- Comment input: BoTextarea `min-h-20` (`aria-label` `leave_comment`); typing `@` opens a listbox under the field
  (`absolute inset-x-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900`,
  options avatar `size-6`, name, email `text-theme-xs text-gray-500`) driven by Up/Down/Enter/Esc with
  `aria-activedescendant`; actions `mt-2 flex justify-end gap-2`: Cancel (secondary, while editing or not empty) and the
  primary icon Button `send` (`aria-label` `submit`, BoTooltip `comment_submit_shortcut`); Ctrl/Cmd + Enter posts.
  Deviation: a mention shows as `@<uuid>` while typing (BoTextarea, not v-template-input); no emoji picker and no
  mention button.
- Comment item: header avatar xs, name `text-theme-sm font-medium`, time, BoMenu (edit, delete; delete confirms in a
  BoDialog with Cancel first); text `whitespace-pre-wrap` plain text; mentions `<mark>` as
  `rounded bg-brand-50 px-1 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400` with the HTML-escaped name.
  Deviation: the menu stays visible (Directus swaps the time for it on hover); the text is plain text through DOMPurify,
  not markdown.
- Shares section (`share`, hidden without share permission, FR-083): items, then a full-width primary Button `add`
  `new_share` opening DrawerItem of `directus_shares`. Share item `article`
  `flex flex-col gap-1 rounded-lg border border-gray-200 p-3 dark:border-gray-800`: name
  `truncate text-theme-sm font-medium`, time `text-theme-xs`, menu (`size-7` `more_horiz`): `share_copy_link`,
  `share_send_link`, `edit`, `delete_label` (by permission); a line `text-theme-xs text-gray-500` with uses left
  (error-600 at 0), `lock` with the label `password` when protected, and the status `font-semibold uppercase` (expired
  error-600, upcoming success-600). Deviation: the role is not shown (the Directus `/shares` request has no role name);
  copy uses the clipboard with an in-place notice (D-66).
- Send dialog: BoDialog `share_send_link`: read-only Input of the share link with a secondary icon Button
  `content_copy`, a Textarea of emails (4 rows, comma or new line); Cancel / Send (the API only logs, D-36).

### Export, import and batch dialogs (Q-12)

Built: `components/sidebar/{ExportSidebarDetail,ImportErrorDialog}.vue`, `modules/content/routes/CollectionRoute.vue`
(batch dialogs), `components/drawers/DrawerBatch.vue` (§8 drawer).

- Export dialog: BoDialog (Tier 1 Modal, `max-w-[700px]`) `export_items`, fields in
  `grid grid-cols-1 gap-4 sm:grid-cols-2`: format Select, limit Input (`unlimited` placeholder), location BoRadio
  (`download_file` / `file_library`, disabled when locked to files), folder Select (files) or a normal BoNotice
  `not_available_for_local_downloads`, the count BoNotice full width (`aria-live="polite"`, normal, warning when locked
  to files), Divider, sort field Select, sort direction Select, full-text search Input, filter (`SystemFilter`, labelled
  group), fields (labelled group: removable BoChips plus a brand text button opening `FieldList` in a `POPOVER`); footer
  Cancel / Export (disabled with no field, FR-091). Deviation: the Modal is the 700 px BoDialog, not `max-w-2xl`; the
  count is a BoNotice (Directus v-notice), not a text line; no drag reorder of the chosen fields.
- Import / export section (Q-9): `label_import`, a file picker row
  `flex items-center gap-2 rounded-lg border border-gray-300 p-1.5 focus-within:border-brand-500 dark:border-gray-700`
  (a button with a `size-9` box showing the extension or `folder_open`, the file name, then BoRemove or `attach_file`),
  the `import_background` Checkbox, a full-width primary Import Button (loading); while uploading or importing a
  `rounded-lg bg-brand-500 px-4 py-2.5 text-white` box with the step text and a `PROGRESS` bar; Divider; full-width
  primary `export_items`; a text button `download_page_as_csv` (`text-theme-sm text-gray-500 hover:text-brand-500`) with
  a BoTooltip, disabled when the layout cannot download. Deviation: a file picker row like the Directus one, not the 013
  Upload drop zone.
- Import error dialog: BoDialog `import_data_errors` with a BoNotice danger (summary, then a
  `max-h-80 overflow-auto list-disc` list of `import_data_error_row` lines; a custom message has a focusable `help` icon
  with the raw message in a BoTooltip), Dismiss.
- Batch confirm dialogs (collection page): BoDialog titled with the count (`batch_delete_confirm`,
  `archive_confirm_count`), Cancel first (secondary, focused on open, FR-115d) then danger Delete or primary Archive
  (loading); a failed delete opens `something_went_wrong` with the translated error. Batch edit is `DrawerBatch` (§8).
  Deviation: the 700 px BoDialog, not a small Modal (one dialog size in the app).

## Tier 3 recipes (015)

Recipes for the questions Q-14 to Q-16, Q-18 and Q-19 of `specs/015-files-users-modules/spec.md`, written before the
code (T006, T007, FR-110) and compared with the code at the end of the feature; approved by the design owner on
2026-10-16 (Q-14 with the checkbox name change below). Q-13 and Q-17 are in
`layout-patterns.md` §11. Tokens and the `FOCUS`, `ICON_BTN` helpers as in the 014 recipes.

### Folder cards and drop zone (Q-14; Directus `modules/files/routes/collection.vue`, `folder-section.vue`)

- Folder cards come first in the cards grid through the layout `prepend` slot (`hasPrependContent`), only on the cards
  layout and only without search, filter and special view (Directus). A folder card is the 014 Card with
  `icon="folder"`, no image request, the folder name as title and no subtitle; the body is a link to
  `/files/folders/<id>`; the selection BoCheckbox sits outside the link, named "Select <card title>".
  Selected folders and files share the header count (`selection + extraSelection`) and select-all.
- Drop zone over the whole library page while files are dragged from the OS: four fixed bars around the `<main>`
  box (`pointer-events-none fixed z-99999 bg-brand-500`, 2px thick, `aria-hidden`); not shown over a `BoUpload`
  dropzone (`data-dropzone`).
- Notices in the page header notice area (D-66, `BoNotice` info, `aria-live="polite"`): `drop_to_upload`
  (`cloud_upload`) while dragging; `upload_files_indeterminate` with done/total and a BoProgressLinear while uploading;
  removed when done.
- Empty states: the 014 blank state with `folder` icon, `file_count` 0, `no_files_copy` and a primary Button
  `add_file` (disabled with tooltip `not_allowed` without create).
- Built: `modules/files/components/FolderSection.vue` (the 014 `layouts/cards/Card.vue` per folder, `icon="folder"`),
  `layouts/cards/Cards.vue` + `CardsHeader.vue` (`prepend` slot, `hasPrependContent`, `extraSelection`, `select-all`),
  drop zone and notices in `modules/files/routes/FilesCollectionRoute.vue`; folder delete in
  `modules/files/components/DeleteFolderDialog.vue`.
- Owner change (2026-10-16): every card checkbox (folders and files, the shared 014 Card) is named by
  `aria-labelledby` = an sr-only "Select" (`select_item_key` without the item) and the card title, so "Select bo-files";
  a card without a title keeps `select_item_key` with the item key.

### File page and file details (Q-15; Directus `modules/files/routes/item.vue`, `file-info-sidebar-detail.vue`)

- Preview block above the form, same width as the form (`max-w-5xl`, D-82): FilePreview (013) in
  `overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]`, max height
  `max-h-[60vh]` with `object-contain`; under it a secondary small Button `replace_file` (`swap_horiz`), hidden without
  update; the replace dialog is a BoDialog with BoUpload (`fileId`, from URL).
- Header actions (page header L-5, right): delete (danger ghost icon, D-76 dialog), move to folder (`folder_move`,
  dialog with the folder picker), download (`download`, a link), edit image (`tune`, images with update, opens the image
  editor), save split button (014 SaveOptions).
- Folder picker in dialogs: the §11 tree rows without menus, single select (`aria-selected`), the current folder's
  parents open, `disabledFolders` rows `opacity-50` and `aria-disabled`.
- File details section of the detail panel (014 SidebarDetail): a `dl` with rows
  `grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-theme-sm`, `dt` `text-gray-500 dark:text-gray-400`, `dd`
  `text-gray-800 dark:text-white/90 break-words`; dates show the short form with the long form in a BoTooltip; owner
  and editor are links with UserPopover; "open in new window" link with `open_in_new` and sr-only "opens in a new tab";
  copy id is an `ICON_BTN` `content_copy` with `aria-label` `copy_id`; EXIF rows (camera, exposure, shutter, focal
  length, ISO) after a divider.
- Built: `modules/files/routes/FileItemRoute.vue`, `components/files/FilePreviewReplace.vue`,
  `components/files/FolderPicker.vue`, `modules/files/components/FileInfoSidebarDetail.vue`.
- Deviation: the preview has no `max-h-[60vh]` (FilePreview of 013 sizes the media); delete and move are secondary icon
  Buttons (delete turns `error-600` on hover) as the 014 item page, not a danger ghost; the "open in new window" link
  text already says it opens a new window, so no extra sr-only text; the edit image button is a secondary icon Button
  named `edit` (Directus tooltip).

### Image editor (Q-16; Directus `views/private/components/image-editor.vue`)

- BoDrawer (013) full width (`w-full` at every breakpoint), title `editing_image`, subtitle
  `changes_are_permanent` in `text-warning-600 dark:text-warning-500`; header actions: primary save icon Button
  (`check`, disabled without edits) with a menu button (`more_vert`) holding `save_as_new_file` when create is allowed.
- Canvas area `flex-1 bg-gray-900` holding the Cropper.js view; Cropper colors set from the theme (crop box and
  handles `brand-500`, modal backdrop `bg-gray-900/60`) in the editor's CSS, no raw hex.
- Toolbar below the canvas: `flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-4 py-3
  dark:border-gray-800 dark:bg-gray-900`; a segmented group of three `ICON_BTN` (`pan_tool` move, `crop` crop,
  `location_searching` focal point) with `aria-pressed`; then rotate (`rotate_90_degrees_ccw`), flip horizontal, flip
  vertical, aspect ratio menu button (icon by ratio, BoMenu with custom ratios, a divider, 16:9, 3:2, 5:4, 7:5, square,
  free, original; the active item has a check); a spacer; reset (`restart_alt`); the dimensions text
  `text-theme-sm tabular-nums text-gray-500 dark:text-gray-400`; a secondary small Button `cancel_crop` /
  `cancel_selection` while cropping. Every button has a name and a BoTooltip.
- Exception (FR-111, owner 2026-10-15): dragging the crop box and the focal point is mouse only, as Directus.
- Built: `components/files/ImageEditor.vue` (BoDrawer `flush`: full width, body without padding), wired in
  `FileItemRoute.vue` and `interfaces/file-image/FileImage.vue`; BoMenu items gained `active` (`menuitemradio` with a
  check) and `divider` for the aspect ratio menu.
- Deviation: the pressed tool is a raised white segment (`bg-white text-gray-800 shadow-theme-xs`,
  `dark:bg-gray-700 dark:text-white`), the TailAdmin segmented control: `brand-500` on `brand-50` failed axe contrast;
  flip horizontal / vertical use the Material `flip` icon (rotated for horizontal) as Material Symbols has no
  `flip_horizontal`; Cropper colors use `--color-brand-500` and `--color-gray-900` at 0.6 opacity.; the subtitle is
  `text-warning-700` in light mode (`warning-600` is 3.49:1 on white, axe failed in CI).

### User box (Q-18; Directus `modules/users/routes/item.vue`)

- Above the form, same width (`max-w-5xl`): `flex items-center gap-5 rounded-2xl border border-gray-200 p-5
  dark:border-gray-800`; avatar `size-20 rounded-full object-cover` (`system-medium-cover`), fallback BoIcon
  `account_circle` `size-20 text-gray-400`; skeleton circle and three lines while loading.
- Text: name `text-lg font-semibold text-gray-800 dark:text-white/90` with `, <title>` in
  `font-normal text-gray-500 dark:text-gray-400`; email and location rows `text-theme-sm text-gray-500 dark:text-gray-400`
  with `alternate_email` / `place` icons (`aria-hidden`).
- Role chip: Badge (Tier 1) light variant by status: active `success`, invited `warning`, draft `light` (gray),
  suspended `error`, archived `light`; the status is also in the text for screen readers (sr-only "(<status>)").
- Built: the user box in `modules/users/routes/UserItemRoute.vue`; information panel
  `modules/users/components/UserInfoSidebarDetail.vue`.
- Deviation: the fallback icon is `text-gray-500 dark:text-gray-400` (`gray-400` on white failed axe contrast); the
  badge uses the Badge light pairs of BoInfo (`success-50`/`success-700`, `warning-50`/`warning-700`,
  `error-50`/`error-700`, `gray-100`/`gray-700`); the sr-only status text is the Directus status label
  (`fields.directus_users.status_<status>`).

### Invite, TFA, token and theme controls (Q-19)

- Invite dialog: BoDialog `invite_users`; BoTextarea `emails` (label linked, placeholder
  `admin@example.com, user@example.com...`), BoSelect `role` (hidden when the route has a role); duplicate emails in
  an error BoNotice inside the dialog; Cancel then primary `invite` (disabled when empty, loading while sending). After
  closing, the page header shows `contact_admin_for_link` (D-83).
- TFA field (`system-mfa-setup`): a block checkbox row (BoCheckbox in a bordered `h-11` box like inputs) with
  `enabled` / `disabled` and a `launch` icon; dialogs: password step (BoInput password, `next`), QR step (the canvas
  with `aria-label` from `tfa_scan_code`, the secret in a `font-mono select-all` output, an OTP BoInput, `done` enabled
  at 6 digits), disable (OTP for oneself; admin text for another user; danger button), cancel SSO setup. Errors inline
  (`BoNotice` error).
- Token field (`system-token`): a read-only BoInput (`password` until a new token is shown) with end icon buttons copy,
  generate / regenerate (`add` / `refresh`) and remove (`clear`), each named; notices under it; regenerate and remove
  confirm in danger BoDialogs.
- Theme picker (`system-theme`): a radio group (Reka RadioGroup) of cards `grid grid-cols-2 gap-4 sm:grid-cols-3`, each
  `rounded-xl border p-2` (selected `border-brand-500 ring-2 ring-brand-500/20`) with the 200×140 Directus theme preview
  SVG (colors inline from the theme data) and the radio label; under it a hint `theme_applies_in_directus`
  (`text-theme-xs text-gray-500`).
- Theme overrides (`system-theme-overrides`): groups as disclosure buttons (`aria-expanded`, `font-mono text-theme-sm`,
  a dot when a value is set), rules as rows `grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.5rem] items-center gap-2`
  (`rule:` label, text input with the default as placeholder, a swatch `size-5 rounded border` with the value as inline
  background when it parses as a color); the whole block `lang="en-US" dir="ltr"`.
- Built: `modules/users/components/UsersInvite.vue`; `interfaces/_system/system-mfa-setup`, `system-token`,
  `system-theme` (+ `ThemePreview.vue`, data `theme/theme-presets.json`), `system-theme-overrides` (+ group and rule
  components), `system-language`, `system-input-password`.
- Deviation: an email of a known user is not an error (Directus `UsersService.inviteUser` skips it); only a
  `RECORD_NOT_UNIQUE` answer shows in the dialog. The QR code is an `<img>` of the data URL (`alt` from
  `tfa_scan_code`), not a canvas. The token field is built on the form `InputField` (the VInput port), not BoInput. The
  `theme_applies_in_directus` hint reads "The theme is saved to your profile. The Backoffice look does not change."
  (owner, 2026-10-16: no other app named, D-88). In the
  overrides each rule input is named by its full path (`navigation.background`), and the root rules sit in a collapsed
  `globals` group, as Directus.

## Tier 3 recipes, nháp (016)

Drafts for the questions Q-21, Q-22, Q-23, Q-25, Q-26 and Q-27 of `specs/016-settings-module/spec.md`, written before
the code (T006, T007, FR-107); approved by the owner on 2026-10-17. Q-20 and Q-24 are in
`layout-patterns.md` §12. Tokens and the `FOCUS`, `ICON_BTN` helpers as in the 014 recipes.

### Field grid (Q-21; Directus `routes/data-model/fields/components/fields-management.vue`, `FieldSelect.vue`)

- Heading `fields_and_layout` (`text-theme-sm font-medium text-gray-800 dark:text-white/90`) with a Badge
  `saves_automatically` (light gray). Below, a two-column grid (`grid grid-cols-2 gap-3`, one column below 600px);
  `half` takes one column, `full` and `fill` take both (fill only differs on the item form).
- Field row: a read-only box like Input (`h-11 rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700
  dark:bg-gray-900`) holding the drag handle (`drag_indicator`, mouse only), the key in `font-mono`, a required star
  (`text-error-500`, sr-only "required"), the interface name in `text-gray-500`, then status icons with tooltips
  (`vpn_key` primary key, `report_problem` in `text-warning-500` for no meta, `visibility_off`, `open_in_new` link to
  the related collection) and the row menu (`more_vert`). The box is a link to the field drawer.
- Locked system fields come first: same box, `bg-gray-50 text-gray-500 dark:bg-white/[0.03]`, a `lock` icon with the
  tooltip `system_fields_locked`, no handle, no menu.
- Group field: a container spanning its width with a header row (handle, name, star, `visibility_off`, menu) and its
  own grid inside (`rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-700`); an empty group shows a
  `min-h-11` drop area.
- Row menu (BoMenu): `edit_field`, `duplicate_field`, hide/show, divider, `half_width` / `full_width` / `fill_width`
  (current one disabled), divider, `delete_field` (`text-error-600`), divider, then the D-96 move items of the
  SortableList row (Move up, Move down, Into the group above (only below a group), Out of the group), as the collection
  tree.
- Under the grid: a full-width secondary Button `create_field` (`add`) and a dashed Button
  `create_in_advanced_field_creation_mode` opening a BoMenu of the ten types with dividers as Directus.
- Duplicate dialog (BoDialog `duplicate_where_to`): collection select (`system-collection`) and key (BoInput
  `dbSafe`, default `<field>_copy`); Cancel first. Delete dialog: `delete_field_are_you_sure`, danger Button.

### Field drawer (Q-22; Directus `field-detail/field-detail.vue`, `field-detail-simple/*`, `field-detail-advanced/*`)

- BoDrawer, full width up to `max-w-5xl`, title `creating_new_field` / `field_in_collection`.
- Simple mode: header search (SearchInput `search_field`, autofocus). Body: one section per interface group
  (`interface_group_*` heading `text-theme-xs uppercase tracking-wide text-gray-500`), then a grid of interface cards
  (`grid gap-3`, 1/2/3/4 columns from the window widths 0/400/600/840 like Directus). A card is a `radio` of a
  `radiogroup` (arrow keys move, Enter/Space choose): `rounded-xl border border-gray-200 p-3`, the `preview` SVG in a
  `h-20 rounded-lg bg-gray-50 dark:bg-white/[0.03]` box (`text-gray-500`, `currentColor`) or the interface icon, then
  the name `text-theme-sm`. Chosen: `border-brand-500 ring-2 ring-brand-500/20`; the others `opacity-50`.
- The configuration panel opens in the grid right after the chosen card's row (`col-span-full`,
  `rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]`): key (`dbSafe`, `font-mono`, focused on open), type select, default
  value, required checkbox, the relationship block, the standard options form; at the end Save (primary, disabled until
  ready) and the link-styled Button `continue_in_advanced_field_creation_mode`.
- Advanced mode: the drawer body is two columns: a vertical BoTabs list (`w-56`, rows `menu-dropdown-item`, a
  `size-1.5 rounded-full bg-brand-500` dot when the tab holds a value; the active row `bg-brand-50 text-brand-600`,
  `text-brand-500` on `brand-50` failing axe color-contrast, T114) and the tab content. Header: Save icon Button
  (`check`, `aria-label` `save`). Below 1024px the tab list becomes a horizontal scrolling BoTabs on top.
- Relationship tab: a `new_data_alert` BoNotice (warning) listing the collections and fields that will be created.
  Related collection / field selects: a `font-mono` BoInput with a trailing `list_alt` icon Button (`aria-label`
  `select_existing`) opening a BoMenu (managed collections, divider, `system` group); a value that matches an existing
  collection shows `text-success-700` and a `check` icon.

### Permissions matrix (Q-23; Directus `interfaces/_system/system-permissions/*`)

- A Table (`BoTable` look) with a sr-only caption: first column `collection` (key in `font-mono`, tooltip the display
  name, two text Buttons `all` / `none`), then five action columns (create, read, update, delete, share) and a remove
  icon Button (`close`, `aria-label` `remove`). A divider row `system_collections` (`bg-gray-50 text-theme-xs
  uppercase`) separates system collections. The row header is a `th scope="row"`; cells keep `px-1` around the chips
  (`ps-3 pe-2` for the collection cell) so the six columns fit the 706px form at 1109px without horizontal scroll.
- Action chip: a `button` with `aria-haspopup="menu"`, `rounded-full px-2.5 py-0.5 text-theme-xs font-medium`, the
  action name always shown and the level in an sr-only text: all = `bg-success-50 text-success-700 dark:bg-success-500/15
  dark:text-success-500` + `check` icon; none = `border border-gray-300 text-gray-500 dark:border-gray-700` + `block`
  icon; custom = `bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400` + `rule` icon. App-minimal
  chips are static (`cursor-default`, a `lock` icon, tooltip `required_for_app_access`). Menu: `all_access`,
  `no_access`, divider, `use_custom`.
- Footer (with `app_access`): `reset_system_permissions_to` followed by two link Buttons `app_access_minimum` and
  `recommended_defaults`; confirmation BoDialog with Cancel first. Add collection: a secondary Button
  `permission_add_collection` opening a BoMenu (managed collections, divider, system ones; existing rows disabled).
- `admin_access`: a BoNotice info `admins_have_all_permissions` instead of the table.
- Detail drawer: BoDrawer `<policy> → <collection> → <action>`, vertical BoTabs as Q-22 with the dot; notices
  (`permissions_for_policy`…) as BoNotice info on top of each tab; the field tab is a BoCheckboxTree with `all` / `none`
  text Buttons; the app-minimal values sit read-only under a BoNotice warning
  `the_following_are_minimum_permissions`.

### Settings system controls (Q-25)

- `system-modules`: a BoSortableList; a module row is `flex h-11 items-center gap-3` with handle, icon, name and a
  BoSwitch `enabled` (a `lock` icon instead for `locked`); a link row adds a `clear` icon Button and opens the
  `custom_link` BoDrawer (name, icon, url, all required) on click; a secondary Button `add_link` below. The Directus
  documentation link is not listed (D-100), only kept in the value.
- `system-fields`: a BoSortableList of field paths (`font-mono`, ` → ` between levels, `functions.<fn>` for
  functions), a remove icon Button per row, and a secondary Button `add_field` opening the FieldList menu.
- `system-folder`: a read-only Input with the folder path (root `interfaces.system-folder.root_name`, a
  `folder_special` / `folder_open` icon inside) and a trailing `folder` icon Button opening a Popover with the 015
  FolderPicker tree (its root row named `interfaces.system-folder.root_name`).
- `system-scope`: a Select with the current user or role first (its name), then `all_users`, `user: select…`,
  `role: select…`; the two last open DrawerCollection.
- `system-owner`: a read-only row with the owner email and an `edit` icon Button (tooltip
  `interfaces.system-owner.edit`) opening a BoDrawer with the 012 SetupForm fields; Save disabled until changed.

### Preset editor (Q-26; Directus `routes/presets/item.vue`)

- The form (BoForm, `max-w-5xl`) with name, icon, color (the 014 BookmarkAdd interfaces), collection, scope, layout,
  search and filter, then a BoDivider `layout_preview`. Below, the chosen layout in a bordered box (`rounded-2xl border
  border-gray-200 p-4 dark:border-gray-800`, read-only, `min-h-96`); without collection or layout, a BoNotice info
  `no_layout_collection_selected_yet`. The layout options and layout sidebar go to the detail panel.
- The preset and translation lists use the 014 table (Q-2) and blank states.

### Data model dialogs (Q-27)

- New collection: BoDrawer `creating_new_collection` with horizontal BoTabs over the form (`collection_setup`,
  `optional_system_fields`, the second disabled until a name is set; two steps, and a vertical list leaves the 640px
  drawer too narrow); header icon Button `arrow_forward` (`next`) then
  `check` (`finish_setup`). Step 1: BoNotice info, name (`font-mono`, `dbSafe`, required star, note
  `collection_names_are_case_sensitive`), singleton checkbox, divider, primary key name and type select. Step 2:
  BoNotice info and six rows `flex items-center gap-3`: a BoCheckbox, the field label, a `font-mono` name input, the
  field icon; focusing the input checks the box.
- New role: BoDialog `create_role` with one Input (`role_name`), Cancel first, Save disabled when empty. New policy:
  the same with two BoCheckbox rows (`app_access`, `admin_access`, label `enabled`). Duplicate policy: BoDialog
  `duplicate_policy` with the name prefilled `<name> (copy)`.
- Delete collection or folder: BoDialog with a danger BoNotice `delete_collection_peer_dependencies` listing
  "field (collection)" when relations depend on it; Cancel first and focused; danger Button.

## Tier 3 recipes, nháp (017)

Drafts for the questions Q-30 to Q-33 of `specs/017-flows-editor/spec.md`, written before the code (T005, FR-107);
design owner approval pending. Q-29 (canvas) is in `layout-patterns.md` §13. Tokens and the `FOCUS`, `ICON_BTN` helpers
as in the 014 recipes. "Primary" below is `brand`, "secondary" (Directus `--theme--secondary`) is `orange`.

### Flow operation panel (Q-30; Directus `components/operation.vue`, `options-overview.vue`, `v-workspace-tile.vue`)

- Box: `absolute w-[252px] h-[252px] rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800
  dark:bg-gray-900`, attribute `data-panel-key`, `data-pos-x`, `data-pos-y`. Selected for drag: `shadow-theme-md`.
- Header (`flex h-10 items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-800`): type icon (`text-brand-500`,
  a reject child `text-orange-500`; trigger `offline_bolt`), type name `text-theme-xs font-medium uppercase
  text-gray-500`. In edit mode at the end: pencil `ICON_BTN` (`edit`, `aria-label` edit) and, for operations, a
  `more_vert` `ICON_BTN` opening BoMenu `copy_to` (disabled for unsaved `_` ids), `duplicate`, `delete`
  (`text-error-600`).
- Body (`p-3`): title = operation name `text-theme-sm font-semibold text-gray-800 dark:text-white/90 truncate`, tooltip
  the key; then a `<dl>` of overview rows: `dt` `text-theme-xs text-gray-500`, `dd` `text-theme-sm text-gray-700
  dark:text-gray-300 font-mono break-all line-clamp-2`; copy `ICON_BTN` `content_copy` after a copyable value. All
  text is plain interpolation.
- Trigger footer (`border-t px-3 py-2`): status dot (`size-2 rounded-full bg-brand-500` active, `bg-gray-400`
  inactive) + in edit mode a compact BoSelect (`active` / `inactive`), in view mode the text.
- Handles: round buttons on the right edge, 32 × 32 hit area with a 20 px icon: resolve `check_circle` `text-brand-500`
  at 10 cells from the top, reject `cancel` `text-orange-500` at 12 cells; input `adjust` `text-gray-400` on the left
  edge at 3 cells (operations only). Hint "+" (`add_circle_outline`) next to a free handle on hover in edit mode.
  Tooltips `operation_handle_resolve` / `operation_handle_reject`.
- Subdued (flow inactive or loner): `opacity-50` and an sr-only line ("not linked to the trigger" / "flow inactive").
- Drag position label while moving: `absolute -top-6 start-0 rounded bg-gray-800 px-1.5 text-theme-xs text-white`
  showing `(x:y)`.
- Error boundary: a danger BoNotice `unexpected_error` inside the body.

### Flow operation drawer (Q-31; Directus `components/operation-detail.vue`)

- BoDrawer `persistent`, `max-w-3xl`, title `create_operation` / `edit_operation`, subtitle the flow name, icon
  `offline_bolt`; one primary header action Done (`check`), disabled without type or with a duplicate key.
- First row `grid grid-cols-2 gap-6`: Name (BoInput, placeholder the chosen type name) and Key (BoInput `dbSafe`,
  `font-mono`, placeholder the generated key, error `operation_key_unique_error` linked by `aria-describedby`).
- Type: BoFancySelect (the 016 Field drawer recipe) with icon, name and description of the 15 operations; once chosen only the chosen
  card stays with a change button.
- Options: the form of ExtensionOptions (BoForm grid of §8) with the raw editor toggle; for `mail` an info BoNotice
  `operations_mail_not_sent_notice` above the form (D-106). Unknown type: danger BoNotice `operation_not_found` with a
  text button to reset the type.

### Flow logs (Q-32; Directus `components/logs-sidebar-detail.vue`, `logs-drawer.vue`)

- Detail panel section (SidebarDetail) `logs`, icon `fact_check`, badge = abbreviated count. Top: a toggle row
  `show_failed_only` (switch, `text-theme-sm`). Loading: BoProgressLinear indeterminate.
- List: RevisionsDateGroup headings (Q-10); a row is a full-width button `flex items-center gap-2 rounded-lg px-2
  py-1.5 hover:bg-gray-100 dark:hover:bg-white/5` with `check_circle` `text-brand-500` (resolve) or `cancel`
  `text-orange-500` (other) and `HH:mm (x ago)` in `text-theme-sm`. Empty: `text-theme-sm text-gray-500` `no_logs` /
  `no_logs_on_page`. Pager: BoPagination compact (3 visible).
- Log drawer: BoDrawer (not persistent), title the run time, icon `fact_check`. Body is an `<ol>` timeline: each step a
  `relative ps-6` item with a dot (`absolute start-0 top-1.5 size-2.5 rounded-full`, `bg-brand-500` default and
  resolve, `bg-orange-500` reject) on a `border-s border-gray-200 dark:border-gray-800` line; heading = name
  (`font-medium`, tooltip key) + type in `text-gray-500`; under it BoDetail sections Options / Payload (/
  Accountability for the trigger), each a `<pre class="overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono
  text-theme-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">`.

### Flow list, flow drawer and dialogs (Q-33; Directus `overview.vue`, `flow-drawer.vue`, `flow.vue`)

- List: Data table (Q-2) with columns icon (42 px, flow icon in the flow color inline, default `text-brand-500`),
  Status (Badge: `active` brand light, `inactive` gray light), Name, Description (truncate); header "+" Button
  (`create_flow`, disabled with tooltip `not_allowed`); row menu `more_vert` (BoMenu: `set_flow_inactive` `block` /
  `set_flow_active` `check`, `edit_flow` `edit`, divider, `delete_flow` `text-error-600`). Empty: the 014 blank state
  with `bolt`, `no_flows`, `no_flows_copy` and the create Button.
- Flow drawer: BoDrawer `persistent`, title `creating_new_flow` / `updating_flow`, vertical BoTabs (Q-22) `flow_setup`
  and `trigger_setup` (second disabled without a name). Flow setup grid: Name (half, required star, autofocus), Status
  (half), Description (full), Icon (half), Color (half), Divider, `flow_tracking` select (full). Trigger setup:
  BoFancySelect of the five triggers, then the options BoForm. Header action changes with the tab: Next
  (`arrow_forward`), Save / Finish Setup (`check`).
- Copy To dialog: BoDialog `copy_to` with one BoSelect of the other flows; empty → info BoNotice
  `no_other_flows_copy`; Cancel first, confirm primary (disabled without choice).
- Delete flow dialog: BoDialog `flow_delete_confirm`, Cancel first, danger Button `delete_label`.

## Acceptance criteria

- Recipes above copied as they are; only theme classes; `dark:` classes present.
- Reka primitive used where one exists; exports checked against the installed version.
- `FOCUS` (or `FOCUS_ERROR`) on every interactive element; keyboard works; labels, hints and errors linked; state not by
  color alone.
- Default, hover, focus-visible, disabled, invalid, loading and empty states covered where relevant.
- Any new color pair is added to the contrast table in `migration-guide.md` and passes (4.5:1 text, 3:1 boundaries and
  focus).
