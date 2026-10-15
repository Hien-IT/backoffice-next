# Design review 015: Files and Users recipes Q-13 to Q-19 (nháp)

Status: **waiting for the design owner (project owner). Nothing in this file is approved.** The recipes keep the
"nháp (015)" marker until the owner signs off; then each Q row of `spec.md` ("Câu hỏi mở về design-system") moves to
"Đóng" and the marker is removed (T098, SC-008).

The drafts were written before the code (T006, T007, FR-110). On 2026-10-16 (T098) they were compared with the
components as built: each recipe now ends with "Built:" (the files), "Deviation" (where the code differs from the
draft, with the reason) and "Open" (what the owner decides) lines.

## Checklist

Tick a row when the recipe is approved (or write the change you want next to it).

| ✓ | Q | Topic | Recipe | Screen to look at (fixture set of `apps/web/fixtures/interfaces`) |
|---|---|-------|--------|---------------------------------------------------------|
| [ ] | Q-13 | Folder tree in the Files sub-menu | `design-system/docs/layout-patterns.md` §11 | sidebar of `/admin/files`: `bo-files` > `bo-files-sub` > `bo-files-deep`, All / My / Recent files, folder row menu |
| [ ] | Q-14 | Folder cards and drop zone | `component-specs.md` "Folder cards and drop zone" | `/admin/files/folders/<bo-files>` on the cards layout; drag a file from the desktop |
| [ ] | Q-15 | File page and file details | `component-specs.md` "File page and file details" | `bo-exif.jpg` in `bo-files` (JPEG with EXIF): preview, replace, move dialog, details panel |
| [ ] | Q-16 | Image editor | `component-specs.md` "Image editor" | `bo-edit.png` → edit image |
| [ ] | Q-17 | Status rows and role tree in the Users sub-menu | `layout-patterns.md` §11 | sidebar of `/admin/users`: `bo-editor` > `bo-sub` |
| [ ] | Q-18 | User box | `component-specs.md` "User box" | `/admin/users/<bo-active>`, `<bo-suspended>`, `<bo-invited>` |
| [ ] | Q-19 | Invite, TFA, token, theme picker, theme overrides | `component-specs.md` "Invite, TFA, token and theme controls" | `/admin/users` invite; own user page: TFA, token, theme, overrides |

Each screen in light and dark, at 1280 px and 768 px.

## Decisions waiting for the owner

- Q-14: name the card checkboxes after the card title (today the 014 Card names them with the item key).
- Q-19 / D-88: the wording of the `theme_applies_in_directus` hint (it names the Directus app).
