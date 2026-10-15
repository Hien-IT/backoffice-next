# Design review 014: Content module recipes Q-1 to Q-12 (nháp)

Status: **waiting for the design owner (project owner). Nothing in this file is approved.** The recipes keep the
"nháp (014)" marker until the owner signs off; then each Q row of `spec.md` ("Câu hỏi mở về design-system") moves to
"Đóng" with the recipe name and the marker is removed (T098, SC-009).

The drafts were written before the code (T006, FR-110). At the end of wave 4 (T098) they were compared with the
components as built and rewritten to describe the code: each recipe now starts with a "Built:" line naming its files,
deliberate differences have a "Deviation" line with the reason, owner questions an "Open" line.

## Checklist

Tick a row when the recipe is approved (or write the change you want next to it).

| ✓ | Q | Topic | Recipe | Screen to look at (fixture set, below) |
|---|---|-------|--------|-----------------------------------------|
| [ ] | Q-1 | Collection tree in the sidebar sub-menu | `design-system/docs/layout-patterns.md` §9 | sidebar of any `/admin/content/*` page: folder `bo_folder` (locked) holding `bo_content`, bookmarks under `bo_content`, hidden collections toggle; `/admin/content` with no collection (empty database) |
| [ ] | Q-2 | Data table, header menu, column reorder, pagination | `component-specs.md` "Data table and pagination" | `/admin/content/bo_content` (tabular, 30 items, manual sort on `sort`): header menu, add column, per page 25 → pages |
| [ ] | Q-3 | Cards grid | `component-specs.md` "Cards grid" | `bo_content`, Layout section → Cards (image `cover`) |
| [ ] | Q-4 | Calendar layout (FullCalendar on the theme) | `component-specs.md` "Calendar layout" | `bo_content` → Calendar, date field `date_published` |
| [ ] | Q-5 | Kanban board | `component-specs.md` "Kanban board" | `bo_content` → Kanban, group by `status` (choices) |
| [ ] | Q-6 | Map layout, live preview split | `component-specs.md` "Map layout"; `layout-patterns.md` §10 | `bo_content` → Map, field `location` (Postgres with PostGIS); item `bo_content/1` → `visibility` button (has `preview_url`) |
| [ ] | Q-7 | Search and advanced filter | `component-specs.md` "Search and advanced filter" | search pill and filter button on `bo_content`; nested `_and` / `_or` groups |
| [ ] | Q-8 | Bookmark button, version menu, save split button, notices, title skeleton | `component-specs.md` "Page header controls" | bookmark `bo-bookmark` (change the filter to see the unsaved state); item `bo_content/1` (versions `draft`, `local-1`), save menu, a save notice |
| [ ] | Q-9 | Detail panel sections | `component-specs.md` "Detail panel sections" | panel of `bo_content` (Layout, Archive, Refresh, Import / export, flow `bo-flow-content`) and of `bo_content/1` (flow `bo-flow-item`) |
| [ ] | Q-10 | Revisions and comparison | `component-specs.md` "Revisions and comparison" | `bo_content/1`: Revisions section → a revision; version `draft` → Promote |
| [ ] | Q-11 | Comments and shares | `component-specs.md` "Comments and shares" | `bo_content/1`: two comments (one mention), share `bo-share` (password, five uses), Send link dialog |
| [ ] | Q-12 | Export, import and batch dialogs | `component-specs.md` "Export, import and batch dialogs" | `bo_content` panel Import / export; select rows → delete / archive confirm, batch edit drawer |
| [ ] | §8 | Drawer sidebar and DrawerCollection by preset layout (014 part of the 013 drawer recipe) | `layout-patterns.md` §8 | an m2o / m2m field of `bo_rel` → select drawer |

Each screen in light and dark (theme toggle in the header), at 1280 px and 768 px.

## What changed from the first draft

Every "Deviation" line of the recipes, in short (reasons in the recipes):

- Q-1 (§9): group toggle first and not a Tab stop; hidden-collections button keeps one name with `aria-pressed`; no
  search highlight.
- Q-2: native header drag; per page Select is the `h-11` BoSelect; no count skeleton; count line screen-reader only
  below `sm`.
- Q-3: column width `size × 40` px; `grid_view` for every size; unsortable fields left out of the sort Select; header
  bar not sticky.
- Q-4: outline toolbar buttons; toolbar not sticky.
- Q-5: title above the image; inline `h-7` avatars; no drop zone highlight; "Add group" button (Directus has none);
  group delete asks first (D-74).
- Q-6: selected map features in orange-500 (Directus secondary); geometry error as BoNotice danger. §10: separator
  values are the preview size; no close button in the preview toolbar; new window in the display options menu; zoom is
  a menu.
- Q-7: buttons in the search pill and the filter in a popover; brand / orange logic chip; no `allow-other` on choices;
  no "wrap in group"; no field search highlight, no `$version` field.
- Q-8: saved bookmark state is a plain icon, hints are `title` attributes; no separate "compare" item; version menu not
  modal (axe `aria-hidden-focus`); title skeleton `h-6 w-48 bg-gray-100`.
- Q-9: badge = BoChip or a dot; one AccordionRoot per section; `active` / `none` Select items; flow color on the icon.
- Q-10: recipe dot colors; plain-text user in revision rows; one header per comparison column; Reka Dialog
  `max-w-6xl`; delete-version Checkbox in the footer.
- Q-11: `@<uuid>` while typing, no emoji picker; comment menu always visible, plain-text comments; share role not shown.
- Q-12: export in the 700 px BoDialog; count as a BoNotice; no field reorder; file picker row instead of the Upload
  drop zone; batch confirms in the 700 px BoDialog.

## Decisions of the design owner (2026-10-15)

- Q-8: the item page `delete` gets the danger hover of the collection page batch delete (both match). Done.
- Q-8: the notice live region is always in the page (empty without notices). Done.
- §8 (013): DrawerFiles keeps the sub folder indentation with leading spaces in the option text.

The recipes themselves (checklist above) still wait for the owner's approval.

## How to view the screens

Needs Docker and Node 22 (see `../quickstart.md`). The fixture set is `apps/web/fixtures/interfaces` (README there):
`bo_content` (30 items, versioning, archive on `status`, display template, `preview_url`, manual sort, `location`),
`bo_singleton`, folder `bo_folder`, presets and bookmarks `bo-bookmark` / `bo-global-bookmark`, versions, share,
comments, flows.

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app       # Directus 8155, Backoffice API 8156
set -a; . tests/parity/env/postgres.env; set +a                        # admin of the parity env (test values)
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"
PUBLIC_URL=http://127.0.0.1:8155 pnpm nx run web:serve                 # http://127.0.0.1:4200/admin/
```

Sign in with the same admin. To compare with Directus, open the Directus app on the same database at
`http://127.0.0.1:8155/admin`. Component-level states (loading, empty, error, disabled) are also in the browser tests
(`apps/web/src/**/*.browser.test.ts`, `pnpm exec vitest --project browser` in `apps/web`); the axe runs of the Content
screens are `src/modules/content/a11y.browser.test.ts` and `apps/web-e2e/src/a11y.spec.ts`.

Contrast: every color pair is already in `design-system/docs/migration-guide.md` (no new pair in 014). Checklist:
`design-system/qa/handoff-checklist.md`.
