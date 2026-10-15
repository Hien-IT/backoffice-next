# Design review 015: Files and Users recipes Q-13 to Q-19 (nháp)

Status: **waiting for the design owner (project owner). Nothing in this file is approved.** The recipes keep the
"nháp (015)" marker until the owner signs off; then each Q row of `spec.md` ("Câu hỏi mở về design-system") moves to
"Đóng" and the marker is removed (T098, SC-008).

The drafts were written before the code (T006, T007, FR-110). At the end of wave 4 (T098) they are compared with the
components as built and rewritten to describe the code ("Built:", "Deviation", "Open" lines).

## Checklist

Tick a row when the recipe is approved (or write the change you want next to it).

| ✓ | Q | Topic | Recipe | Screen to look at (fixture set `bo_files`, `bo_users`) |
|---|---|-------|--------|---------------------------------------------------------|
| [ ] | Q-13 | Folder tree in the Files sub-menu | `design-system/docs/layout-patterns.md` §11 | sidebar of `/admin/files`: `bo-fixtures` > `sub` > `deep`, All / My / Recent files, folder row menu |
| [ ] | Q-14 | Folder cards and drop zone | `component-specs.md` "Folder cards and drop zone" | `/admin/files/folders/<bo-fixtures>` on the cards layout; drag a file from the desktop |
| [ ] | Q-15 | File page and file details | `component-specs.md` "File page and file details" | an image of `bo-fixtures` (JPEG with EXIF): preview, replace, move dialog, details panel |
| [ ] | Q-16 | Image editor | `component-specs.md` "Image editor" | `bo-edit.png` → edit image |
| [ ] | Q-17 | Status rows and role tree in the Users sub-menu | `layout-patterns.md` §11 | sidebar of `/admin/users`: `bo-editor` > `bo-sub` |
| [ ] | Q-18 | User box | `component-specs.md` "User box" | `/admin/users/<bo-active>`, `<bo-suspended>`, `<bo-invited>` |
| [ ] | Q-19 | Invite, TFA, token, theme picker, theme overrides | `component-specs.md` "Invite, TFA, token and theme controls" | `/admin/users` invite; own user page: TFA, token, theme, overrides |

Each screen in light and dark, at 1280 px and 768 px.
