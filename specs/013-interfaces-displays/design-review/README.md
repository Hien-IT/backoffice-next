# Design review 013: Tier 3 recipes Q-1 to Q-12 (nháp)

Status: **waiting for the design owner (project owner). Nothing in this file is approved.** The recipes keep the
"nháp (013)" marker until the owner signs off; then each Q row of `spec.md` ("Câu hỏi mở về design-system") moves to
"Đóng" with the recipe name (T098, SC-008).

What changed in T098: the draft recipes were written before the code (FR-093). They were compared with the components
as built (classes, states, ARIA, keyboard) and rewritten to describe the code. Where the code differs from the first
draft on purpose, the recipe has a "Deviation" line; owner questions are "Open" lines. Components built without a
recipe got one (Translation progress, Remove button, Flow dialogs, BoTable manual sort, EditorFrame toolbar, DrawerFiles
folder select, Upload dialogs, map controls). Missing color pairs were added to the contrast table.

Sources for the review:

- Recipes: [`design-system/docs/component-specs.md`](../../../design-system/docs/component-specs.md), section "Tier 3
  recipes, nháp (013)"; form grid and drawer:
  [`design-system/docs/layout-patterns.md`](../../../design-system/docs/layout-patterns.md) §8.
- Contrast table: [`design-system/docs/migration-guide.md`](../../../design-system/docs/migration-guide.md), rows marked
  "013".
- Checklist this file follows: [`design-system/qa/handoff-checklist.md`](../../../design-system/qa/handoff-checklist.md).
- Code: `apps/web/src/components/` (`Bo*.vue`, `form/`, `render/`, `drawers/`, `files/`), `apps/web/src/interfaces/`,
  `apps/web/src/displays/`.
- Automated checks the owner can run (browser project, chromium): `apps/web/src/components/form/a11y.browser.test.ts`
  (axe, light and dark, on the fixture forms and a table of all displays), `keyboard.browser.test.ts`,
  `perf.browser.test.ts`; for example
  `cd apps/web && pnpm exec vitest run --project browser --coverage.enabled=false src/components/form/a11y.browser.test.ts`.
- Visual comparison: TailAdmin reference screens and the Directus 11.17.4 app (parity env, `http://127.0.0.1:8155`) on
  the same fixture collections (`bo_std`, `bo_groups`, `bo_rel`). Screenshots for this review are not in this folder
  yet (see "Not done").

How to use this file: for each Q section, read the recipe, open the components, tick the boxes, and write the
decision in the sign-off table at the end. A review only changes recipes and classes (component-specs, "Tier 3").

## General checklist (handoff-checklist applied to 013)

Theme

- [ ] No raw hex, `rgb()` or arbitrary colors in the 013 components; data color constants copied from Directus carry
      `// raw-color-allowed: Directus data default (Q-C)` (`node tools/check-raw-colors.mjs .`).
- [ ] Data colors (choice colors, chip colors, color values, header colors) are applied with `style` only, never
      classes.
- [ ] No `dark-900` or other class without a theme value.

Components

- [ ] Reka UI primitives used where one exists (RadioGroup, Combobox, Checkbox, Tree, Calendar, TimeField, Slider,
      TagsInput, Tabs, Accordion, Collapsible, Separator, Popover, Toolbar, DropdownMenu, Dialog); exports match
      `reka-ui` 2.8.2.
- [ ] Each recipe matches its component (spot-check the class strings named in each section below).
- [ ] States covered where relevant: default, hover, focus-visible, active/checked, disabled, invalid, loading, empty.
- [ ] No TailAdmin Pro code; TailAdmin MIT notice kept wherever TailAdmin code was copied.

Dark mode

- [ ] Every Q section checked with `dark` on `<html>` and in light mode; no unreadable text, no white flashes.

Accessibility

- [ ] Every color pair of the 013 components is in the contrast table (rows "013"); the three "fail" rows are decided
      (open points 1 and 2 below).
- [ ] Keyboard: every action reachable, `FOCUS` on every interactive element, Esc closes menus, popovers, drawers and
      dialogs, focus returns to the trigger.
- [ ] Labels, hints and errors linked (`for` / `aria-labelledby`, `aria-describedby`, `aria-invalid`); state never by
      color alone.
- [ ] Drawers and dialogs trap focus while open.
- [ ] `prefers-reduced-motion`: transitions and animations off (component classes and `styles/base.css`).
- [ ] axe exceptions accepted: MapLibre attribution `link-in-text-block`; data colors applied with an inline style
      (`color-contrast`, Q-C), both listed in `a11y.browser.test.ts`.

Attribution and release

- [ ] Open questions of 013 listed in `spec.md`, none picked silently (this file, "Open points").
- [ ] Visual check against TailAdmin reference screens and the Directus flow for the same field.

## Q-1 Form grid, field label, edited dot, note, validation notice

- Recipes: layout-patterns §8 "Form grid (`BoForm`…)"; component-specs "Field label row (Q-1…)", "ValidationErrors
  notice", "Flow dialogs".
- Components: `components/form/BoForm.vue`, `FormField.vue`, `FormFieldInterface.vue`, `FormFieldLabel.vue`,
  `FormFieldMenu.vue`, `FormFieldRawEditor.vue`, `ValidationErrors.vue`, `ValidationNestedGroups.vue`,
  `ValidationNestedGroupsList.vue`, `types.ts` (`WIDTH_CLASSES`); `interfaces/presentation-header/FlowDialogs.vue`.
- Look at:
  - [ ] Two columns, `half` / `half-right` / `full`, and the third `fill` column above 726px form width; gaps
        `gap-x-6 gap-y-5`.
  - [ ] Label row: name, required `*` (+ sr-only "required"), edited dot (gray, Tooltip "Edited"), Hidden badge,
        group badge, raw toggle, menu chevron visible on hover / focus / open.
  - [ ] Field menu items and separator; raw value dialog (Cancel / Done).
  - [ ] Note under the control (links, max width), validation line, custom validation message with the help button.
  - [ ] Loading: one skeleton per control (labels stay visible); empty card "No visible fields".
  - [ ] Validation notice: danger Alert, field buttons scroll to the field, nested rules toggle.
  - [ ] Flow dialogs: Modal recipe, result Notice under the dialogs.
- Known open points:
  - Disabled field labels stay `text-gray-500` (Tier 1 disabled label is gray-300): deviation to confirm.
  - Loading has no label skeleton (draft had one): deviation to confirm.
  - BoDialog has no close button in the corner (Esc, outside click and Cancel close it); the Tier 1 Modal recipe has
    one (open point 7).

## Q-2 Combobox, multi-select, radio, checkbox grid, checkbox tree

- Recipes: component-specs "Radio", "Combobox", "MultiSelect", "CheckboxGroup", "CheckboxTree".
- Components: `components/BoRadio.vue`, `BoCombobox.vue`, `BoMultiSelect.vue`, `BoCheckboxGroup.vue`,
  `BoCheckboxTree.vue`, `BoCheckbox.vue`; interfaces `select-radio`, `select-dropdown`, `input-autocomplete-api`,
  `select-multiple-dropdown`, `select-multiple-checkbox`, `select-multiple-checkbox-tree`.
- Look at:
  - [ ] Radio and checkbox grids (1–4 columns from `sm`), custom icons, choice color by style, invalid state.
  - [ ] Radio "other" row (dashed empty, gray filled, brand selected) and checkbox "other" rows with remove button.
  - [ ] Combobox: chevron is not a Tab stop (input is the combobox); prepend icon / color dot; loading and empty rows.
  - [ ] Multi-select: chips below the preview threshold, "N items" from it, search inside the panel, Deselect all.
  - [ ] Checkbox tree: frame, indent, chevron, mixed state dash, search over 10 choices, "show selected" toggle.
  - [ ] Keyboard: arrows in radio groups and lists, Space toggles in the multi-select and tree, Esc closes.
- Known open points:
  - Multi-select is always a Combobox with search (draft: Select without search): deviation to confirm.
  - Radio "other" row is a button + input outside the Reka radio group (arrows do not reach it): deviation to confirm.
  - Checkbox tree: Directus search highlight, `nonEditable` and group toggle not ported.

## Q-3 Date and time picker

- Recipe: component-specs "DatePicker".
- Components: `interfaces/datetime/Datetime.vue`, `components/BoDatePicker.vue`.
- Look at:
  - [ ] Trigger: value, time zone icon with Tooltip, clear button / `today` icon at the end, open state border.
  - [ ] Calendar header with month Select and year Input, day cells (today = bold + underline, selected = fill,
        outside month gray), focus on the selected day when opening.
  - [ ] Time segments 12 / 24 h and seconds; "Set to now"; time zone name for `timestamp` only.
  - [ ] Keyboard: arrows, PageUp/PageDown, Enter, Esc returns focus to the trigger.
- Known open points:
  - Clear button sits on the trigger and the footer has no clear (Directus): deviation to confirm.

## Q-4 Slider, rating, translation progress

- Recipes: component-specs "Slider", "Rating", "Translation progress".
- Components: `components/BoSlider.vue`, `displays/rating/DisplayRating.vue`,
  `interfaces/translations/LanguageSelect.vue`, `displays/translations/DisplayTranslations.vue`,
  `components/BoProgressLinear.vue`.
- Look at:
  - [ ] Slider track, range, thumb, value bubble (always or on hover / focus), ticks, min / max labels, invalid.
  - [ ] Rating detailed (clipped filled stars over outline stars) and simple (warning badge).
  - [ ] Language bar colors (first language brand, second blue-light), menu items with progress bars, edited marker.
  - [ ] Translations display popover: progress colors by percent.
- Known open points:
  - Light mode: translations display bars `warning-500` (2.13:1) and `success-500` (2.38:1) on the gray-100 track
    fail 3:1 (Directus `colorful`); the percent is only in a hover Tooltip and `aria-valuenow` (open point 1).
  - Half stars are clipped filled stars, not `star_half`: deviation to confirm.

## Q-5 Tags, chips, labels with data colors, color dot

- Recipes: component-specs "Chip", "TagsInput".
- Components: `components/BoChip.vue`, `BoTagsInput.vue`, `interfaces/tags/Tags.vue`,
  `displays/labels/DisplayLabels.vue`, `displays/color/DisplayColor.vue`.
- Look at:
  - [ ] Chip base, sizes, data colors by style, leading icon / dot, delete button (14px icon, "Remove <value>").
  - [ ] Tags input: input on top, tags below, active tag ring, presets as toggle chips (`aria-pressed` + check icon).
  - [ ] `labels` with `showAsDot`: dots with Tooltips and one sr-only list.
  - [ ] Color dot border when the color is too close to the page background.
- Known open points:
  - BoChip has no dot or clickable variant (dots are DisplayColor, toggles are the presets): deviation to confirm.
  - Data colors may fail contrast; accepted as Q-C (Directus behaviour, axe exception) — owner to confirm Q-C, which
    the spec lists as "default, not asked" (open point 5).

## Q-6 Tabs, accordion, detail, divider

- Recipes: component-specs "Tabs", "Accordion", "Detail", "Divider with title and icon".
- Components: `components/BoTabs.vue`, `BoAccordion.vue`, `BoDetail.vue`, `BoDivider.vue`; interfaces `group-tabs`,
  `group-accordion`, `group-detail`, `group-raw`, `presentation-divider`.
- Look at:
  - [ ] Tab trigger underline + color, edited dot, badge chip, error icon with Tooltip.
  - [ ] Accordion and detail headers: chevron rotation (off under reduced motion), edited dot and error icon while
        closed, header color by style.
  - [ ] Divider: inline title vs title above, icon, data color.
- Known open points:
  - Detail error shows the messages (Tooltip + sr-only), not a count: deviation to confirm.

## Q-7 Color picker, icon picker

- Recipes: component-specs "ColorPicker", "IconPicker".
- Components: `components/BoColorPicker.vue`, `BoIconPicker.vue`; interfaces `select-color`, `select-icon`.
- Look at:
  - [ ] Color field: swatch states (color, no value `colorize`, unknown `question_mark`, low-contrast ring), clear vs
        palette button.
  - [ ] Popover: mode Select (`h-11`), channel sliders with number inputs, HEX field, browser picker button, presets
        with selected ring.
  - [ ] Icon picker: trigger, search, virtual grid (columns from width), selected icon, empty state.
  - [ ] Keyboard in the icon grid: one Tab stop, arrows, Home/End, Enter.
- Known open points:
  - Icon grid: the Tab stop resets to the first icon after search / open; once scrolled out of the virtual window the
    arrows work again only after scrolling back (code `shortcut:` comment).
  - No Tooltip per icon (the name is the `aria-label`); mode Select is `h-11`: deviations to confirm.

## Q-8 Code, rich text, markdown, block editor

- Recipe: component-specs "EditorFrame".
- Components: `components/BoEditorFrame.vue`, `interfaces/input-code/InputCode.vue`, `styles/codemirror-theme.css`,
  `interfaces/input-rich-text-md/InputRichTextMd.vue`, `interfaces/input-block-editor/InputBlockEditor.vue`,
  `interfaces/input-block-editor/editorjs-overrides.css`, `interfaces/input/InterfaceInput.vue`,
  `interfaces/input-multiline/InputMultiline.vue` (soft-length counters).
- Look at:
  - [ ] Frame states (focus ring, invalid, disabled); toolbar row, button "on" state, Tooltips with shortcuts.
  - [ ] Markdown edit / preview segmented toggle in the toolbar (deviation from Tabs), preview typography.
  - [ ] CodeMirror colors light and dark (syntax, gutters, active line, selection, lint marks).
  - [ ] Editor.js toolbars, popovers and tooltips in both modes.
  - [ ] Soft-length counters (markdown under the frame; `input` / `input-multiline` inside the field).
- Known open points:
  - CodeMirror keeps Tab for indentation like Directus, so Tab does not leave a code field (WCAG 2.1.2 risk);
    `keyboard.browser.test.ts` documents it. The markdown editing area is CodeMirror 5 too [Unverified: Tab inside
    it not tested] (open point 3).
  - `input-rich-text-html` (TinyMCE) is not installed: TinyMCE 6.8.6 has a high XSS advisory fixed only in the GPL
    line (FR-060); the interface is not registered (open point 4).
  - `input` / `input-multiline` counter under 10 % uses `text-warning-600` (3.49:1 on white, fails 4.5:1); the recipe
    says `warning-700` (open point 2; code change, not a recipe change).
  - Markdown edit / preview is a toggle group, not Tabs; no loading pulse while the editor chunk loads: deviations to
    confirm.

## Q-9 Map frame

- Recipe: component-specs "Map frame".
- Component: `interfaces/map/InterfaceMap.vue` (MapLibre GL 6.14.0 + Mapbox Draw).
- Look at:
  - [ ] Frame, canvas focus ring, control buttons (zoom, geolocate, fit, draw modes with `aria-pressed`, delete),
        basemap Select, draw hint tooltip, loading spinner.
  - [ ] Errors as Notices under the map (danger for options, warning with Continue / Reset for geometry).
  - [ ] Dark mode of the controls (pressed state over gray-800 is 4.43:1, icon use).
- Known open points:
  - Drawing a geometry needs a pointer (Mapbox Draw) [Inference: no keyboard drawing in Directus either]; keyboard
    users can pan, zoom, fit and delete. Owner to confirm this is acceptable.
  - Reduced motion relies on MapLibre's own handling (no explicit `jumpTo`): deviation to confirm.
  - MapLibre attribution links without underline: accepted axe exception.

## Q-10 Drawers (item select, nested item edit)

- Recipe: layout-patterns §8 "Drawer (`BoDrawer`…)".
- Components: `components/drawers/BoDrawer.vue`, `DrawerItem.vue`, `DrawerCollection.vue`, `DrawerFiles.vue`,
  `DrawerBatch.vue`.
- Look at:
  - [ ] Panel 640px from `xl`, full width below; overlay; slide animation off under reduced motion.
  - [ ] Header: Cancel button, header icon, subtitle above the title, template title skeleton, actions, icon-only save.
  - [ ] Nested drawers dim the page once; Esc closes only the top one; focus returns.
  - [ ] DrawerItem: discard-changes dialog; DrawerCollection: search, table, pagination; DrawerFiles: folder Select.
  - [ ] Ctrl/Cmd + Enter applies.
- Known open points:
  - Save is an icon-only `check` button (Directus) with `aria-label` "Save", not "check + text", and has no loading
    state: deviation to confirm.
  - No drawer sidebar; DrawerFiles uses a folder Select at the top of the body instead of the Directus folder tree.
  - DrawerFiles indents sub folders with leading spaces in the option text; HTML may collapse them [Unverified: not
    checked in a browser] (open point 6).

## Q-11 Relational lists (list and table), files and images

- Recipes: component-specs "Table, simple", "SortableList row menu", "Remove button", "Upload", "Image preview and
  Lightbox".
- Components: `components/BoTable.vue`, `BoSortableList.vue`, `BoRemove.vue`, `files/BoUpload.vue`,
  `files/FilePreview.vue`, `files/FileLightbox.vue`; interfaces `list`, `list-o2m`, `list-m2m`, `list-m2a`,
  `list-o2m-tree-view`, `collection-item-multiple-dropdown`, `file`, `files`, `file-image`.
- Look at:
  - [ ] Table: sticky header, row heights, select column, sort arrows, manual sort toggle and handles, resize handle,
        focusable clickable rows, loading bar, empty row.
  - [ ] List rows: handle, row button, deleted rows (red + strikethrough), link, Remove, row menu (move up / down,
        indent / outdent), focus back on the menu after a move, live announcement.
  - [ ] Remove button icons (delete, deselect, undo) and the confirm dialog.
  - [ ] Upload zone: idle, drag over, uploading (percent, count, bar), errors, disabled; import-from-URL dialog;
        markdown image dialog and block editor upload drawer.
  - [ ] Image card (always visible actions), file preview fallback, lightbox (download, close, Esc).
- Known open points:
  - Keyboard resize of table columns is not built: Directus has none. The draft proposal (separator with Left/Right
    ± 10px) needs an owner decision and a D-xx (open point 8).
  - Clickable table rows are focusable `tr` elements (Directus), not a link in the first cell (Tier 1 Table rule):
    deviation to confirm.
  - Row menu has no separator between the row actions and the move items (BoMenu has no separator item).
  - Table drag and list drag are pointer only (Directus); the keyboard path is the row menu (D-60).
  - Upload progress moves per finished file (no byte progress, no TUS, FR-053).

## Q-12 Null value, user popover, "N items" menu

- Recipes: component-specs "ValueNull", "UserPopover", "\"N items\" menu".
- Components: `components/render/ValueNull.vue`, `UserPopover.vue`, `ItemsMenu.vue`; displays `user`,
  `related-values`, `translations`, `formatted-json-value`.
- Look at:
  - [ ] `--` with the sr-only `no_value` text.
  - [ ] User popover: hover delay, click / Enter, avatar, status badge, role chip, email, Open link, loading and error.
  - [ ] "N items" trigger (dotted underline), popover with arrow, item rows with the open link; icon trigger variant.
- Known open points:
  - "N items" opens on click only (Directus related-values), no hover: deviation to confirm.
  - ValueNull uses the Directus key `no_value` instead of a Backoffice overlay string.

## Open points for the owner

| #   | Topic                                                                                                         | Where                                                                                    | Proposal in the docs                                     |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Translations display progress colors fail 3:1 in light mode (warning-500 2.13:1, success-500 2.38:1)          | `displays/translations/DisplayTranslations.vue`; migration-guide "fail" rows             | none; keep Directus colors or use -700 / visible percent |
| 2   | `input` / `input-multiline` counter under 10 % is `warning-600` text (3.49:1)                                 | `interfaces/input/InterfaceInput.vue`, `interfaces/input-multiline/InputMultiline.vue`   | recipe says `warning-700` (code to align, not a recipe)  |
| 3   | CodeMirror keeps Tab (code field, and the markdown editing area [Unverified])                                 | `interfaces/input-code/InputCode.vue`, `keyboard.browser.test.ts`                        | keep Directus, or add an escape key                      |
| 4   | TinyMCE not installed, `input-rich-text-html` not registered                                                  | spec FR-060, `interfaces/registry.test.ts`                                               | owner decision                                           |
| 5   | Data colors applied as is (Q-C, default not asked); axe `color-contrast` exception                            | `components/form/a11y.browser.test.ts`                                                   | confirm Q-C                                              |
| 6   | DrawerFiles sub folder indentation by leading spaces [Unverified]                                             | `components/drawers/DrawerFiles.vue`                                                     | check in a browser                                       |
| 7   | BoDialog has no corner close button (Tier 1 Modal has one)                                                    | `components/BoDialog.vue`                                                                | confirm or add the close button                          |
| 8   | Keyboard resize of table columns not built (not in Directus)                                                  | `components/BoTable.vue`                                                                 | separator + arrows, needs a D-xx                         |
| 9   | Deliberate deviations listed per Q above ("Deviation" lines of the recipes)                                   | component-specs Tier 3, layout-patterns §8                                               | approve or change the recipe                             |

## Not done in T098

- Screenshots against TailAdmin and the Directus flow (asked by T098 for this folder) are not produced; the owner's
  visual check uses the parity env.
- No code was changed (docs only); open points 1, 2, 6 and 7 need code if the owner decides so.
- The Q table of `spec.md` stays "Mở" until the owner signs off below.

## Sign-off (design owner)

| Q    | Recipe (component-specs / layout-patterns)                                                                | Decision | Date | Notes |
| ---- | --------------------------------------------------------------------------------------------------------- | -------- | ---- | ----- |
| Q-1  | Form grid (§8), Field label row, ValidationErrors notice, Flow dialogs                                    |          |      |       |
| Q-2  | Radio, Combobox, MultiSelect, CheckboxGroup, CheckboxTree                                                 |          |      |       |
| Q-3  | DatePicker                                                                                                |          |      |       |
| Q-4  | Slider, Rating, Translation progress                                                                      |          |      |       |
| Q-5  | Chip, TagsInput                                                                                           |          |      |       |
| Q-6  | Tabs, Accordion, Detail, Divider with title and icon                                                      |          |      |       |
| Q-7  | ColorPicker, IconPicker                                                                                   |          |      |       |
| Q-8  | EditorFrame                                                                                               |          |      |       |
| Q-9  | Map frame                                                                                                 |          |      |       |
| Q-10 | Drawer (§8)                                                                                               |          |      |       |
| Q-11 | Table simple, SortableList row menu, Remove button, Upload, Image preview and Lightbox                    |          |      |       |
| Q-12 | ValueNull, UserPopover, "N items" menu                                                                    |          |      |       |
