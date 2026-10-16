# Design review 015: Files and Users recipes Q-13 to Q-19

Status: **approved by the design owner (project owner) on 2026-10-16**, Q-14 with one change (below). The "nháp"
markers are removed and the Q rows of `spec.md` are closed (T098, SC-008).

The drafts were written before the code (T006, T007, FR-110). On 2026-10-16 (T098) they were compared with the
components as built: each recipe now ends with "Built:" (the files), "Deviation" (where the code differs from the
draft, with the reason) lines.

## Checklist

Tick a row when the recipe is approved (or write the change you want next to it).

| ✓ | Q | Topic | Recipe | Screen to look at (fixture set of `apps/web/fixtures/interfaces`) |
|---|---|-------|--------|---------------------------------------------------------|
| [x] | Q-13 | Folder tree in the Files sub-menu | `design-system/docs/layout-patterns.md` §11 | sidebar of `/admin/files`: `bo-files` > `bo-files-sub` > `bo-files-deep`, All / My / Recent files, folder row menu |
| [x] | Q-14 | Folder cards and drop zone | `component-specs.md` "Folder cards and drop zone" | `/admin/files/folders/<bo-files>` on the cards layout; drag a file from the desktop |
| [x] | Q-15 | File page and file details | `component-specs.md` "File page and file details" | `bo-exif.jpg` in `bo-files` (JPEG with EXIF): preview, replace, move dialog, details panel |
| [x] | Q-16 | Image editor | `component-specs.md` "Image editor" | `bo-edit.png` → edit image |
| [x] | Q-17 | Status rows and role tree in the Users sub-menu | `layout-patterns.md` §11 | sidebar of `/admin/users`: `bo-editor` > `bo-sub` |
| [x] | Q-18 | User box | `component-specs.md` "User box" | `/admin/users/<bo-active>`, `<bo-suspended>`, `<bo-invited>` |
| [x] | Q-19 | Invite, TFA, token, theme picker, theme overrides | `component-specs.md` "Invite, TFA, token and theme controls" | `/admin/users` invite; own user page: TFA, token, theme, overrides |

Each screen in light and dark, at 1280 px and 768 px.

## Owner decisions

- Q-14 (2026-10-16): name the card checkboxes after the card title. Done in `layouts/cards/components/Card.vue`
  (`aria-labelledby` "Select" + title, for folder and file cards); the key stays only for a card without a title.
