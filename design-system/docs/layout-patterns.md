# Layout patterns

The app shell as TailAdmin Vue builds it (`src/components/layout/*`, `src/composables/useSidebar.ts`,
`src/assets/main.css`, read at commit `6d5a365`), then how the Directus app maps onto it. Classes are quoted from the
TailAdmin sources. A Backoffice implementation uses Vue 3 + Reka UI and these classes; it does not copy TailAdmin files
(see README, Rules). Where the owner decisions of 2026-10-15 (migration-guide, Decisions) change a TailAdmin class or
behaviour, the line says **Backoffice**; the Backoffice value wins. All interactive elements get the `FOCUS` recipe of
`component-specs.md`; the `menu-item` and `menu-dropdown-item` utilities include it.

## 1. Shell structure

```text
<html class="dark?">                        ThemeProvider: `dark` class on <html>, saved in localStorage
  <body>                                    bg-gray-50, dark:bg-gray-900, font-outfit (theme base layer)
    AdminLayout   div.min-h-screen.xl:flex
      AppSidebar  aside (fixed, full height)
      Backdrop    div (below xl, when the sidebar drawer is open)
      div.flex-1  margin-start follows the sidebar width (xl:ms-[290px] or xl:ms-[90px]), transition-all duration-300 ease-in-out
        AppHeader header (sticky)
        div       mx-auto max-w-(--breakpoint-2xl) p-4 pb-20 md:p-6 md:pb-6     ← page content
          PageBreadcrumb (page title + breadcrumb)
          page body (cards, tables, forms)
          [DetailPanel] aside (Backoffice, optional, section 7)
```

Pages without the shell (sign in, 404) use `FullScreenLayout`: `div.min-h-screen > main > slot`.

## 2. Sidebar (`AppSidebar.vue`)

State (`useSidebar`, provided once by `SidebarProvider`): `isExpanded` (default true, forced false on mobile),
`isMobileOpen`, `isHovered`, `openSubmenu` (one open sub-menu at a time, key `group-item`).

| Aspect             | TailAdmin                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Container          | `fixed top-0 start-0 flex flex-col h-screen px-5 bg-white border-e border-gray-200 text-gray-900 z-99999 transition-all duration-300 ease-in-out dark:bg-gray-900 dark:border-gray-800`                                                                                                                                                                            |
| Width expanded     | `xl:w-[290px]` when `isExpanded`, `isHovered` or `isMobileOpen`                                                                                                                                                                                                                                                                                                    |
| Width collapsed    | `xl:w-[90px]` when not expanded and not hovered                                                                                                                                                                                                                                                                                                                    |
| Hover to expand    | Desktop only: `mouseenter` sets `isHovered` when the sidebar is collapsed, `mouseleave` clears it. The content margin also follows `isHovered`, so the page shifts while hovering                                                                                                                                                                                  |
| Mobile             | `max-xl:-translate-x-full` when closed, `translate-x-0 w-[290px]` when `isMobileOpen` (`rtl:` mirrors)                                                                                                                                                                                                                                                             |
| Logo area          | `pt-8 pb-7 flex`; centred (`xl:justify-center`) when collapsed. Full logo 150×40 (light and dark files) when expanded, 32×32 icon when collapsed                                                                                                                                                                                                                   |
| Scroll area        | `flex flex-col overflow-y-auto no-scrollbar duration-300 ease-linear`                                                                                                                                                                                                                                                                                              |
| Groups             | `nav.mb-6 > div.flex.flex-col.gap-4`; group titles "Menu" and "Others" rendered uppercase: `h2.mb-4.flex.text-xs.uppercase.leading-5.text-gray-400`; when collapsed the title is replaced by a "…" icon and centred. **Backoffice:** one group "Menu" only (L-2), title `text-gray-500 dark:text-gray-400` (gray-400 is 2.58:1)                                    |
| Items              | `ul.flex.flex-col.gap-1 > li`; link item: `menu-item group` + `menu-item-active` / `menu-item-inactive`; icon wrapper `menu-item-icon-active` / `menu-item-icon-inactive`; label `span.menu-item-text` (hidden when collapsed)                                                                                                                                     |
| Item with sub-menu | a `<button>` with the same `menu-item` classes; "active" means "sub-menu open". Chevron `ms-auto w-5 h-5 transition-transform duration-200`, `rotate-180 text-brand-500` when open. **Backoffice:** `menu-item-arrow-active` (`text-brand-600`), `aria-expanded` + `aria-controls`                                                                                 |
| Sub-menu           | `ul.mt-2.space-y-1.ms-9 > li > a.menu-dropdown-item` + `menu-dropdown-item-active` / `-inactive`; optional `new` / `pro` badge `menu-dropdown-badge` (+ `-active` / `-inactive`). Height animated from 0 to `scrollHeight`. Hidden when the sidebar is collapsed. **Backoffice:** one level only (L-3); no `new`/`pro` badges (utilities removed from `theme.css`) |
| Active state       | exact `route.path` match; the sub-menu that holds the active route opens on navigation. **Backoffice:** active text and icon `brand-600` on `brand-50` (5.83:1, in the utilities), `aria-current="page"`                                                                                                                                                           |
| Footer             | `SidebarWidget` (promo card) when expanded. Not used in Backoffice                                                                                                                                                                                                                                                                                                 |

`main.css` also has `.sidebar:hover …` rules (`width: 290px`, show `.logo`, `.menu-item-text`, `.menu-dropdown`). They
belong to the HTML edition: the Vue `AppSidebar` does not use these class names and does the same with `isHovered`. They
are not in `tokens/theme.css`.

### Breakpoints

What TailAdmin does (not consistent):

- Sidebar, content margin, header layout and `HeaderLogo` switch at `xl` (1280px): below 1280px the sidebar is
  off-canvas.
- `Backdrop` is `lg:hidden` (1024px): between 1024px and 1279px an open sidebar has no backdrop.
- `useSidebar` treats `< 768px` as mobile (`isExpanded` forced false), and the header toggle uses
  `window.innerWidth >= 1280`.

**Backoffice (L-1): one breakpoint, `xl` (1280px), for all of them.**

- From `xl`: the sidebar is inline (fixed, content margin `xl:ms-[290px]` / `xl:ms-[90px]`), expanded or collapsed,
  hover-to-expand when collapsed.
- Below `xl`: the sidebar is an off-canvas drawer (`max-xl:-translate-x-full`, open `translate-x-0 w-[290px]`) **with**
  the Backdrop (`xl:hidden`, fixing the TailAdmin gap), always shown expanded (labels visible), focus trapped while
  open, Esc and Backdrop click close it, closing on navigation.
- The "mobile" state of the sidebar store is `width < 1280px` (one `useMediaQuery('(min-width: 1280px)')`), not 768px;
  crossing to `xl` closes the drawer.
- Minimum supported width: 768px (`md`). No horizontal page scroll from 768px; narrower widths are not tested.

## 3. Backdrop (`Backdrop.vue`)

TailAdmin: `fixed inset-0 bg-gray-900/50 z-9999 lg:hidden`, rendered only while `isMobileOpen`; click closes the
sidebar. **Backoffice:** `fixed inset-0 z-9999 bg-gray-900/50 xl:hidden`, `aria-hidden="true"`; the same Backdrop serves
the detail panel drawer (section 7).

## 4. Header (`AppHeader.vue`)

| Part                    | TailAdmin                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container               | `header.sticky.top-0.flex.w-full.bg-white.border-gray-200.z-99999 dark:border-gray-800 dark:bg-gray-900 xl:border-b`                                                                                                                                                                                                                                                                                                                                                 |
| Row                     | `flex flex-col items-center justify-between grow xl:flex-row xl:px-6`                                                                                                                                                                                                                                                                                                                                                                                                |
| Left block              | `flex items-center justify-between w-full gap-2 px-3 py-3 border-b border-gray-200 sm:gap-4 xl:justify-normal xl:border-b-0 xl:px-0 lg:py-4 dark:border-gray-800`                                                                                                                                                                                                                                                                                                    |
| Sidebar toggle          | `flex items-center justify-center w-10 h-10 text-gray-500 border-gray-200 rounded-lg z-99999 lg:h-11 lg:w-11 lg:border dark:border-gray-800 dark:text-gray-400`; shows a close icon while the mobile sidebar is open. Desktop: collapse/expand; mobile: open/close. **Backoffice:** `FOCUS`, `aria-label`, `aria-expanded`, `aria-controls`; drawer mode below `xl`                                                                                                  |
| Logo (mobile)           | `HeaderLogo`: logo link, `xl:hidden`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Application menu toggle | "⋯" button, `xl:hidden`: shows/hides the right block on small screens (`hidden` / `flex`, `shadow-theme-md`)                                                                                                                                                                                                                                                                                                                                                         |
| Search (optional)       | `SearchBar`, `hidden xl:block`: input `h-11 w-full xl:w-[430px] rounded-lg border border-gray-200 bg-transparent py-2.5 ps-12 pe-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/3 dark:text-white/90`; sr-only label; ⌘K / Ctrl+K focuses it. **Backoffice:** use the Search recipe of component-specs (`FIELD`: gray-500 border and placeholder) |
| Right block             | `flex items-center justify-between w-full gap-4 px-5 py-4 xl:flex xl:justify-end xl:px-0 xl:shadow-none`, holding `ThemeToggler` + `NotificationMenu` (`flex items-center gap-2 2xsm:gap-3`) and `UserMenu`                                                                                                                                                                                                                                                          |
| Round icon buttons      | Theme toggle and notifications: `relative flex items-center justify-center h-11 w-11 rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white`                                                                                                                                                       |
| Notification dot        | `absolute right-0 top-0.5 z-1 h-2 w-2 rounded-full bg-orange-400` with an `animate-ping` halo                                                                                                                                                                                                                                                                                                                                                                        |
| Notification panel      | `absolute mt-4.25 flex h-120 w-87.5 sm:w-90.25 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark z-50`; title `text-lg font-semibold text-gray-800 dark:text-white/90`; list `custom-scrollbar`; items `flex gap-3 rounded-lg border-b border-gray-100 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5`; footer link styled as the outline button                             |

### User menu (`header/UserMenu.vue`)

- Trigger: `flex items-center text-gray-700 dark:text-gray-400`; avatar `h-11 w-11 rounded-full overflow-hidden me-3`;
  name `block font-medium text-theme-sm me-1`; chevron `size-5 text-gray-500 dark:text-gray-400`, `rotate-180` when
  open.
- Panel:
  `absolute end-0 z-50 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark`.
- Identity: full name `block font-medium text-gray-700 text-theme-sm dark:text-gray-400`, email
  `mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400`.
- Items: `ul.flex.flex-col.gap-1.pt-4.pb-3.border-b.border-gray-200 dark:border-gray-800`; each link
  `group flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300`,
  icon `fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300`. TailAdmin items:
  Edit profile, Account settings, Support, Language (fly-out sub-menu).
- Sign out:
  `group mt-3 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300`.
- Closes on outside click and on item click. TailAdmin has no Esc handling and no focus management: Reka `DropdownMenu`
  provides both.
- **Backoffice:** Reka `DropdownMenu` with the Dropdown menu recipe of component-specs; trigger has `FOCUS` and an
  accessible name (user name); no Language item (Directus language comes from the user profile); avatar without image
  uses the Avatar fallback (B-2).

## 5. Content area and page header

- Container: `mx-auto max-w-(--breakpoint-2xl) p-4 pb-20 md:p-6 md:pb-6` (max width 1536px; 16px padding, 24px from
  `md`).
- Page header (`PageBreadcrumb.vue`): `flex flex-wrap items-center justify-between gap-3 mb-6`; title
  `h2.text-xl.font-semibold.text-gray-800 dark:text-white/90`; breadcrumb `nav > ol.flex.items-center.gap-1.5`, links
  `inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400` followed by a chevron, current page
  `text-sm text-gray-800 dark:text-white/90`.
- Page body blocks: card `rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]` (see
  Card in component-specs); grids with `gap-4 md:gap-6`.

## 6. Full-screen pages

- **Sign in** (`views/Auth/Signin.vue`): two columns from `lg`. Left: `w-full max-w-md mx-auto` form column on
  `bg-white dark:bg-gray-900` with a "back" link, title
  `font-semibold text-gray-800 text-title-sm sm:text-title-md dark:text-white/90`, subtitle
  `text-sm text-gray-500 dark:text-gray-400`, social buttons
  (`bg-gray-100 rounded-lg py-3 px-3 sm:px-4 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-white/90`), an
  "Or" divider, fields `space-y-5`, full-width primary button. Right (`hidden lg:grid lg:w-1/2`):
  `bg-brand-950 dark:bg-white/5` panel with a grid-shape decoration, logo and tagline
  `text-gray-400 dark:text-white/60`.
- **Backoffice public pages (owner's choice 2026-10-15, replaces the two-column sign-in above):** one centered card over
  a full-page background, like the authentik login page.
  - Background (`absolute inset-0`): `public_background` of the settings (image `bg-cover bg-center`, or a muted looped
    video that does not autoplay under `prefers-reduced-motion`), otherwise `--project-color` with the grid shapes of
    `CommonGridShape` in `text-white/30` (top end, and turned at bottom start).
  - Optional `public_foreground` image above the card (`max-h-24`).
  - Card:
    `w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-theme-xl dark:border-gray-800 dark:bg-gray-900`,
    sections with `px-6 sm:px-10`: logo block (`size-12 rounded-xl` on `--project-color`) with the project name and
    descriptor; the form (`py-8`); a footer band
    `border-t border-gray-200 bg-gray-50 py-4 text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400`
    for the notice.
  - `public_note` below the card on a `bg-gray-900/80 text-white` chip (readable on any background).
  - Text never sits directly on the background image: everything readable is inside the card or the note chip.
- **404** (`views/Errors/FourZeroFour.vue`): centred column `max-w-[242px] sm:max-w-[472px] text-center`, title
  `font-bold text-gray-800 text-title-md xl:text-title-2xl dark:text-white/90`, illustration (light/dark files), text
  `text-base sm:text-lg text-gray-700 dark:text-gray-400`, outline button back home, footer `text-sm text-gray-500`.

## 7. Mapping for Backoffice (Directus flows)

Routes, screen flows and permissions stay those of the Directus app (principle VI); this section only says where each
Directus shell part goes. Which modules exist, their order, labels and routes are decided by Directus (module bar
settings, permissions), not by this pack.

| Directus app                                                                         | Backoffice (TailAdmin shell)                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Module bar (left icon rail)                                                          | One sidebar group "Menu" (L-2), no "Others" group. Items in `module_bar` order: each enabled module and each `module_bar` link (internal or external) in the same list, icon + label (`menu-item`). Settings last, admins only                                                                                                       |
| Module navigation (second column: collections, folders, presets, settings pages ...) | The module's sub-menu (`menu-dropdown-item`), **one level** (L-3): feature 012 provides this slot; each module feature (014+) decides what goes in it. Exception (owner, 2026-10-15, spec 014 Q2): the Content module renders its collection tree **nested inside this sub-menu** (groups, folders, bookmarks, search), see §9 (014); the Files and Users modules do the same with flat rows plus a tree (spec 015 Q3), see §11 (015) |
| Settings module                                                                      | Last sidebar item, admins only (Directus permission)                                                                                                                                                                                                                                                                                 |
| Module bar links                                                                     | Internal links: router links as items. External URLs: open in a new tab, `target="_blank" rel="noopener noreferrer"` plus an "opens in a new tab" hint (`open_in_new` icon `aria-hidden` + sr-only text)                                                                                                                             |
| Project logo / name at the top of the module bar                                     | Sidebar logo area; logo background uses `--project-color` (branding, README)                                                                                                                                                                                                                                                         |
| Header bar (icon, title, breadcrumb, action buttons)                                 | Page header inside the content (`PageBreadcrumb` layout): title + breadcrumb on the left, actions (Button recipes) on the right, wraps on small screens                                                                                                                                                                              |
| Right sidebar (info, revisions, comments, layout options)                            | Optional right detail panel (L-4, below)                                                                                                                                                                                                                                                                                             |
| User avatar / menu at the bottom of the module bar                                   | `UserMenu` in the header: avatar, name, email, items (profile = Directus user detail page, other Directus entries), Sign out                                                                                                                                                                                                         |
| Notifications drawer                                                                 | `NotificationMenu` button in the header (only if the feature ships it)                                                                                                                                                                                                                                                               |
| Theme (light/dark/auto from user/settings)                                           | `ThemeToggler` in the header sets the `dark` class; the initial value follows the Directus user/settings appearance                                                                                                                                                                                                                  |

### Right detail panel (L-4, Backoffice; TailAdmin has none)

- Width 333px like Directus: `w-[333px]` (max `max-w-[calc(100vw-2rem)]` in drawer mode).
- From `xl`: inline at the end of the content row (`xl:flex` next to the page body), open by default, collapsible with a
  toggle in the page header (`aria-expanded`, `aria-controls`); the page body takes the remaining width.
- Below `xl`: closed by default; opens as a drawer from the end side:
  `fixed inset-y-0 end-0 z-99999 w-[333px] overflow-y-auto bg-white shadow-theme-xl dark:bg-gray-900` with the Backdrop,
  focus trap, Esc and Backdrop click close, focus returns to the toggle (Reka `Dialog`).
- Look: `border-s border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900`; sections as collapsible blocks
  (`px-5 py-4 border-b border-gray-200 dark:border-gray-800`, title
  `text-theme-sm font-medium text-gray-800 dark:text-white/90`, toggle `<button aria-expanded>` with `FOCUS`), content
  text `text-theme-sm text-gray-500 dark:text-gray-400`.
- `<aside aria-label="…">` (Directus label of the panel, for example "Item details").

### Accessibility and keyboard requirements

- Skip link as the first focusable element: "Skip to main content" → `<main id="main">`; visually hidden until focused.
- Landmarks: `<aside aria-label="…">` with `<nav aria-label="Main">` for the sidebar, `<header>`, `<main>`, the right
  panel as `<aside aria-label="…">`.
- Active link: `aria-current="page"` on the active item or sub-item (not only the `-active` classes).
- Sub-menu toggles are `<button aria-expanded="true|false" aria-controls="…">`; the header sidebar toggle has
  `aria-expanded`, `aria-controls` and a label ("Open menu" / "Close menu"); the collapse state is not only visual.
- Every icon-only button (sidebar toggle, application menu, theme, notifications, panel close) has an accessible label;
  icons are `aria-hidden="true"`. Collapsed sidebar items keep their label for assistive tech (sr-only or `aria-label`)
  and show a tooltip on hover/focus.
- Hover-to-expand also needs a keyboard path: focus inside the collapsed sidebar expands it like hover (or the collapse
  toggle is used); never hide focused content.
- Off-canvas sidebar and right drawer (below `xl`): focus moves into the drawer on open, is trapped while open (Reka
  `Dialog` or equivalent), Esc closes, focus returns to the trigger, the Backdrop click closes.
- Dropdowns (user menu, notifications) use Reka `DropdownMenu`/`Popover`: arrow keys, Esc, focus return.
- Visible focus on every control (see component-specs: focus-visible recipe).
- Minimum supported width 768px; no horizontal page scroll from 768px (tables scroll inside their own `overflow-x-auto`
  container).
- Respect `prefers-reduced-motion` for the width and sub-menu transitions (`motion-reduce:transition-none`).

## 8. Forms and drawers (nháp, 013)

**Draft (nháp, 013)** for spec Q-1 and Q-10 (CHK037), written before the code and updated to the code as built (T098);
reviewed by the design owner before 013 closes (checklist `specs/013-interfaces-displays/design-review/README.md`). The
behaviour is the Directus `v-form` / `v-drawer` one; the classes follow `component-specs.md` (Tier 1 and the Tier 3
drafts). "Deviation" lines say where the code differs from the first draft.

### Form grid (`BoForm`; Directus `v-form` + `form-grid` mixin)

- Built: `apps/web/src/components/form/BoForm.vue`, `FormField.vue`, `FormFieldInterface.vue`, `types.ts`
  (`WIDTH_CLASSES`).
- Grid: `grid grid-cols-2 gap-x-6 gap-y-5`, two columns from 768px (the minimum supported width, L-1) and in the drawer.
- Item page (014, D-82): the form is capped at `max-w-5xl` (64rem) so `fill` fields stop there on wide screens; the
  drawers keep their own width. Directus stacks halves only below a 500px form width (container query), which the shell
  from 768px and the 640px drawer do not reach [Inference: content and drawer widths minus padding stay above 500px], so
  there is no container query.
- Widths (Directus `meta.width`, after the Directus `updateFieldWidths`, which turns a `half` that follows a visible
  `half` into `half-right`): `half` / `half-left` → `col-start-1 col-span-1`, `half-right` → `col-start-2 col-span-1`,
  `full` → `col-start-1 col-span-2`, `fill` → `col-span-full`. Groups use the same classes.
- Fill: when the form is wider than 726px (Directus `v-form`: 770 drawer − 2 × 22 padding, measured with
  `useElementSize`) the grid gets a third column like Directus `.with-fill`:
  `grid-cols-[minmax(0,21.375rem)_minmax(0,21.375rem)_1fr]`; `half` and `full` stay in the first two columns (342px max
  each), `fill` spans all three. At 726px or less the grid stays `grid-cols-2` and `fill` = both columns.
- Each field (`relative min-w-0`, `data-field`): label row (component-specs, Field label row) → control → note (Hint
  classes, `max-w-[29.25rem]`) → validation message (Error message classes); note and error ids in the control's
  `aria-describedby`. A field whose label is hidden keeps a sr-only `<label>`; a half-width one keeps a `mb-1.5 h-6`
  spacer so the controls line up. Batch mode: the control is `opacity-50` until its batch checkbox is on.
- Dividers: the Directus system divider is a `role="separator"`
  `col-span-full border-t border-gray-200 dark:border-gray-800`; the divider after the form (Directus `showDivider`) is
  the same line with `aria-hidden="true"`.
- Group fields (Detail, Accordion, Tabs, raw group) span their Directus width and hold a nested BoForm with the same
  classes (no nested empty state, no nested error notice).
- Form-level errors: the ValidationErrors notice (component-specs) as the first grid row (`col-span-full`).
- Loading: the grid has `aria-busy="true"`; each control is covered by a skeleton
  `absolute inset-0 z-2 h-full min-h-11 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800`
  (unless the interface hides the loader). Deviation: no separate label skeleton; the real labels stay visible.
- Empty (no visible fields, Directus `v-info`):
  `col-span-full flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-5 py-7 text-center xl:px-10 xl:py-12 dark:border-gray-800 dark:bg-white/[0.03]`
  (Card empty-page classes) with a `search` icon (lg, gray-500 / gray-400), `no_visible_fields`
  (`text-base font-medium text-gray-800 dark:text-white/90`) and `no_visible_fields_copy`
  (`mt-1 text-sm text-gray-500 dark:text-gray-400`).
- An interface that fails to render shows a warning Notice `unexpected_error`; an unknown interface a warning Notice
  `interface_not_found`.

### Drawer (`BoDrawer`; Directus `v-drawer`)

- Built: `apps/web/src/components/drawers/BoDrawer.vue`; used by `DrawerItem.vue` (nested item edit),
  `DrawerCollection.vue` (item select), `DrawerFiles.vue` (file select), `DrawerBatch.vue` (batch edit) and the block
  editor image upload.
- Reka `DialogRoot` / `DialogPortal` / `DialogOverlay` / `DialogContent` / `DialogTitle` / `DialogDescription`, the
  panel on the end side.
- Overlay: `fixed inset-0 z-99999 bg-gray-900/50` (the Backdrop colors).
- Panel:
  `fixed inset-y-0 end-0 z-99999 flex w-full flex-col bg-white shadow-theme-xl outline-hidden xl:w-[640px] dark:bg-gray-900`
  (640px from `xl`; below `xl` full width like the L-4 drawer). Enter / exit: slide from the end side (250 ms in, 200 ms
  out, mirrored in RTL) and overlay fade, both off under `prefers-reduced-motion: reduce`.
- Header: `flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800`:
  - Close first (when `cancelable`): Modal close classes without `absolute`
    (`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-white/[0.05] dark:text-gray-400 dark:hover:bg-white/[0.07] dark:hover:text-gray-300 FOCUS`),
    `aria-label` "Cancel" and `title` "Cancel (Esc)"; it emits `cancel` (the caller decides to close).
  - Header icon (Directus):
    `flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400`,
    the collection icon (sm), data `iconColor` by `style`.
  - Title block `min-w-0 flex-1`: subtitle above the title (`DialogDescription`, collection name,
    `truncate text-theme-xs text-gray-500 dark:text-gray-400`), `DialogTitle`
    `m-0 min-w-0 truncate text-lg font-semibold text-gray-800 dark:text-white/90`. DrawerItem can render the title from
    the collection display template, with a `h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800` skeleton
    (sr-only title) while it loads.
  - Actions at the end `flex shrink-0 items-center gap-2`: caller actions (e.g. a secondary icon Button `download` in
    the file drawer), then the save Button. Deviation: save is an icon-only primary Button `check` with `aria-label`
    "Save" (Directus v-drawer), not "check + text"; disabled while nothing changed (DrawerItem: not savable;
    DrawerCollection: selection unchanged); DrawerBatch keeps it enabled; no loading state on it.
- Body: `<main>` `custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6`.
- Sidebar (014, FR-029; used by `DrawerCollection` for the layout options and the folders of the files drawer): an
  `aside` (`aria-label` "Sidebar") of `w-60` on the end side from `xl`
  (`border-s border-gray-200 dark:border-gray-800 overflow-y-auto`, the drawer grows to `xl:w-[880px]`); below `xl` it
  sits at the top of the body as a collapsible section (a full-width button `aria-expanded` + `expand_more`, content
  hidden until opened). Not resizeable.
- DrawerItem body: file preview (files collection), then the empty state, or `flex flex-col gap-12` with the
  ValidationErrors notice, the junction form and the main form (order swapped as Directus).
- DrawerCollection (014, D-58 lifted): the layout of the collection preset (tabular, cards, calendar, kanban, map) from
  the layout registry, in select mode (`showSelect` one or multiple); the layout actions (count line) and `SearchInput`
  (Q-7) sit in the header actions before the save Button; the drawer sidebar holds the caller's `sidebar` slot (folders
  of the files drawer) then the Layout section (Q-9) with the layout options; the body is the layout itself (its own
  pagination), `BoInfo` `item_count` 0 when empty, a danger Notice with the translated API error on load error. The
  temporary preset is never written. Deviation: the 013 body (search Input, simple Table, Previous / Next `nav`) is
  gone.

- DrawerFiles (new): Directus files navigation (folder tree sidebar) becomes a Tier 1 Select labelled "Folder" at the
  top of the body: the root (or the field's folder) and its sub folders, then "All files", "My files", "Recent files";
  the choice is kept in session storage (`backoffice-` prefix). Sub folders are indented with leading spaces in the
  option text (kept by the design owner, 2026-10-15).
- Keyboard and focus: on open, focus goes to the first focusable element of the body (else the panel); it is trapped
  while open; Esc emits `cancel` (DrawerItem asks "Discard all changes?" in a Modal when there are edits: Discard
  (secondary) / Keep editing (primary)); an overlay click closes unless `persistent` (DrawerItem, DrawerBatch); Ctrl/Cmd
  - Enter (or Ctrl/Cmd + S) applies; focus returns to the element focused before opening (recorded when the drawer
    opens).
- Nested drawers: each one opens its own `DialogRoot` above the previous (same `z-99999`, later in the DOM wins); a
  nested drawer's overlay is `bg-transparent` (depth > 0) so the page dims once; only the top drawer reacts to Esc and
  outside clicks, and focus returns to its trigger inside the drawer below.
- Below `xl` a drawer covers the right detail panel drawer if both are open; only one Backdrop dims the page.

## 9. Content module navigation tree (nháp, 014)

**Draft (nháp, 014)** for spec 014 Q-1 (owner choice 2026-10-15, Clarifications Q2), updated to the code as built
(T098): the Content module renders the Directus collection tree (`modules/content/components/navigation.vue`,
`navigation-item.vue`, `navigation-bookmark.vue`) **inside its sidebar sub-menu** (the `navigation` slot of
`AppSidebar`, §7), several levels deep. Other modules keep one level. Behaviour (open groups, hidden collections,
search, bookmarks, last accessed collection) is the Directus one. Built: `apps/web/src/modules/content/components/`
`ContentNavigation.vue`, `NavigationItem.vue`, `NavigationItemContent.vue`, `NavigationBookmark.vue`,
`routes/NoCollections.vue`.

- Container: the sub-menu block of 012; the tree is a `ul role="tree"` (`m-0 flex list-none flex-col gap-1 p-0`) with
  `aria-label` `collections`; items are `li role="treeitem"` with `aria-level`, `aria-expanded` on groups and
  `aria-selected`; the link of the current collection or bookmark has `aria-current="page"`.
- Rows reuse `menu-dropdown-item` / `menu-dropdown-item-active` / `menu-dropdown-item-inactive` (theme.css) with
  `gap-2 py-1`; the link fills the row (`after:absolute after:inset-0`) and the row shows the `FOCUS` outline through
  `has-focus-visible:`. The icon is `BoIcon` `sm` `shrink-0` with the collection `color` as inline style (data color,
  Q-C of 013), else the row color (Directus foreground; gray-500 on the active brand-50 row fails axe color-contrast);
  the name truncates (`BoTextOverflow`). Deviation: no search highlight (BoTextOverflow has none).
- Nesting: children in a `ul role="group"` `mt-1 flex flex-col gap-1 ps-4`; a group row has a toggle button first
  (`size-6 rounded FOCUS`, `chevron_right` turning 90° when open, `motion-reduce:transition-none`, `aria-label` `expand`
  / `collapse` + name); a folder (collection without `schema`) is a row whose label is not a link and toggles on click;
  `collapse: locked` groups have no toggle. Deviation: the toggle comes first (Directus: after the name) and has
  `tabindex="-1"`: the tree keys open and close groups, so the toggle is for the mouse.
- Dense (more than 5 visible collections, Directus `dense`): `min-h-8 text-theme-sm`; otherwise `min-h-9 text-sm`.
- Bookmarks: child rows of their collection (`?bookmark=<id>` link), the bookmark icon (default `bookmark`) and color; a
  row menu button at the end
  (`ctx-toggle size-7 rounded FOCUS opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100`,
  `more_vert`, `aria-label` `item_options`) that follows the row's roving tabindex, so Tab reaches it; a BoMenu with
  `edit_<scope>_bookmark` (personal: a BoDialog with name, icon, color; role and global: a link to
  `/settings/presets/<id>`, D-71) and `delete_<scope>_bookmark` (a BoDialog, Cancel first). Without permission a `lock`
  icon (`role="img"`, `aria-label` and BoTooltip `cannot_edit_<scope>_bookmarks`). Deleting the open bookmark goes to
  the collection and focuses the page title.
- Hidden collections: rows `text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5` (gray-400 fails
  axe color-contrast on white) with a `visibility_off` icon after the name and an sr-only "(hidden)"; shown only when
  "show hidden collections" is on.
- Header row above the tree (`sticky top-0 z-1 flex items-center gap-2 bg-white pb-2 dark:bg-gray-900`): the search
  BoInput (`type="search"`, `h-9`, placeholder and `aria-label` `search_collection`) when more than 20 collections are
  visible, and a ghost icon Button `visibility` / `visibility_off` with `aria-pressed` when hidden collections exist
  (keyboard path for the Directus right-click menu, which stays). Deviation: its name stays `show_hidden_collections`
  and `aria-pressed` gives the state (a toggle button keeps one name), not a name that switches to
  `hide_hidden_collections`.
- Right-click menu (Reka `ContextMenu` on the tree, shared menu classes of component-specs 014): on a table row for
  admins `edit_collection` (`database`, link `/settings/data-model/<collection>`), otherwise show / hide hidden
  collections; a bookmark row keeps the browser menu (Directus).
- No match: an sr-only `role="status"` text `no_results` and a visible
  `px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400` row (`aria-hidden`).
- Keyboard (WAI-ARIA tree): one roving `tabindex` over the visible rows; Up/Down move, Right opens a group or moves to
  its first child, Left closes or moves to the parent, Enter follows the link (or toggles a folder), Home/End first/last
  row; Tab leaves the tree (or reaches the bookmark menu button).
- Empty (admin, no collection): a full-width secondary Button `create_collection` to `/settings/data-model/+` above the
  tree, and the `/content` page shows the blank page card (`no_collections`, the admin copy and a primary
  `create_collection` Button to the same route; Settings frame of 012 until 016, D-71).
- Collapsed sidebar (90px): the tree is hidden like other sub-menus; hover/focus expand shows it (§2).

## 10. Live preview split (nháp, 014)

**Draft (nháp, 014)** for spec 014 Q-6 (live preview, Clarifications Q1 = A; no visual editing, D-67), updated to the
code as built (T098). Behaviour is Directus `routes/item.vue` + `live-preview.vue`. Built:
`apps/web/src/components/SplitPanel.vue`, `components/LivePreview.vue`, `modules/content/routes/ItemRoute.vue`,
`routes/PreviewRoute.vue`.

- Split (`SplitPanel`, on `@directus/vue-split-panel` 0.8.9): form at the start, preview at the end; the end panel is
  primary, size in % (default 50, min 20, max 80, or 100 at full width; snap point 50; collapsible to 0 under 15 %; 150
  ms transition, 0 under `prefers-reduced-motion`). The size is kept in `backoffice-live-preview-size` (D-39). At `sm`
  and below: min 0, max 100 and the divider is disabled.
- Divider: the package's divider gets `role="separator"`, `aria-label` `live_preview.change_size`,
  `aria-orientation="vertical"`, `aria-valuemin` / `aria-valuemax` = the min / max above (set by `SplitPanel`, the
  package writes 0 / 100) and its own `aria-valuenow`; `FOCUS` on it; inside,
  `flex h-full w-1.5 cursor-col-resize justify-center bg-transparent group-hover:bg-brand-500/20 motion-reduce:transition-none`
  with a `w-px bg-gray-200 dark:bg-gray-800` line; hidden when collapsed. Keys (D-69): Left/Right ±5 % (Left grows the
  preview), Home/End = min / max of the preview, Enter collapses (package). Deviation: the values are the preview size
  (the primary end panel), not the form size.
- Preview frame:
  `@container flex size-full flex-col border-s border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900`.
  Toolbar `flex h-11 shrink-0 items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-800`: at the start a
  ghost icon Button: display options BoMenu (`display_settings`: `full_width`, `live_preview.new_window` with
  `open_in_new`), or `width_full` (`live_preview.exit_full_width`) at full width, or `exit_to_app`
  (`live_preview.close_window`) in the popup; then refresh (ghost `refresh`, loading while refreshing, disabled without
  a valid URL) and the URL `text-theme-xs` (a BoMenu with `arrow_drop_down` when there are several URLs); a spacer; when
  the frame has a URL the width and height inputs
  (`h-8 w-16 rounded-lg border border-gray-300 text-center text-theme-xs`, `aria-label` `width` / `height`, a `close`
  icon between) and a zoom BoMenu (25–200 %), disabled at full size; at the end the size toggle `devices`
  (`live_preview.change_size`, secondary while a fixed size is on, `aria-pressed`). Below a 27rem container the start
  group (or, at full size, the inputs) hide. Tooltips are BoTooltip. Deviation: no close button in the toolbar (the
  header button closes the preview, as Directus); the new window entry is in the display options menu; the zoom is a
  BoMenu, not a Select.
- Iframe: `size-full border-0 bg-white`, `title` `live_preview.iframe_title`, in a `grid size-full overflow-auto` view:
  at a fixed size `p-11`, the box `shadow-theme-md` with CSS `resize: both` and `transform: scale(<zoom>)`; at full size
  `p-0`. A top `PROGRESS` bar while refreshing; no URL = BoInfo `no_url`, invalid URL = BoInfo danger `invalid_url`
  (Card empty-page block).
- Header button (item page actions): icon Button `visibility`, secondary when off and primary when on, `aria-pressed`,
  name and `title` `live_preview.enable` / `live_preview.disable`.
- Popup route (`/content/:collection/:primaryKey/preview`): the preview frame alone, full window (`in-popup`), no
  PublicView; the version comes from `?version=`; no `saved` message to the opener (no visual editing).

## 11. Folder tree and role tree in the sub-menu (015)

For spec 015 Q-13 and Q-17 (owner choice 2026-10-16, Clarifications Q3; approved by the design owner 2026-10-16): the Files and Users
modules put the Directus module navigation (`views/private/components/files-navigation.vue`,
`files-navigation-folder.vue`; `modules/users/components/navigation.vue`, `NavigationRole.vue`) inside their sidebar
sub-menu like the Content tree of §9. Unlike §9 the sub-menu mixes flat rows and a tree. Behaviour is the Directus one.
Built: `components/files/FilesNavigation.vue` (Q-13), `components/files/FolderPicker.vue` (the picker rows),
`modules/users/components/UsersNavigation.vue` (Q-17), keyboard in `composables/use-tree-keyboard.ts`.
Deviation: the trees are flat lists of `li role="treeitem"` with `aria-level` and an inline start padding per level,
not nested `ul role="group"` (one roving list, like the picker); the delete folder menu item has the default menu color,
not `error-600`.

- Same tree DOM, rows, nesting, focus and keyboard model as §9: `ul role="tree"` with `aria-label`, `li role="treeitem"`
  with `aria-level`, `aria-expanded` on parents, `aria-current="page"` on the active link, `menu-dropdown-item*` rows
  (`min-h-9 text-sm`), children in `ul role="group" ps-4`, a mouse-only chevron toggle first (`tabindex="-1"`), one roving
  `tabindex` (Up/Down, Right/Left open-close, Enter, Home/End).
- **Files (Q-13)**: the tree root is "File Library" (`folder_special`, active without folder and special), its children
  are the folders (`folder`), open by default (`['root']`) and opened down to the current folder; then a 1px divider
  (`my-2 h-px bg-gray-200 dark:bg-gray-800`, `role="separator"`); then three flat rows `all_files` (`file_copy`),
  `my_files` (`folder_shared`), `recent_files` (`history`), active by route. Loading: four skeleton rows
  (`h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800 motion-reduce:animate-none`).
- Folder menu: right-click (Reka `ContextMenu`) and a row menu button at the end like the §9 bookmark button
  (`more_vert`, `aria-label` `item_options`, visible on hover and focus) with `rename_folder` (`edit`), `move_to_folder`
  (`folder_move`), `download_folder` (`download`), `delete_folder` (`delete`, `text-error-600 dark:text-error-500`);
  rename and move open a BoDialog (Cancel first); delete opens the delete-folder dialog (component-specs 015).
  `actionsDisabled` (file select drawer) hides the button and the context menu.
- **Users (Q-17)**: four flat rows first, `exact` active: `active_users` (`group`), `suspended_users` (`group_off`),
  `invited_users` (`person_add`), `all_users` (`folder_shared`); a divider when roles exist or load; then the role tree
  (role `icon`, name through `translate`, children by `parent`, sorted by name); a role row links to
  `/users/roles/<id>`; admins get the row menu and right-click item `edit_role` (`list_alt`, link
  `/settings/roles/<id>`, the Settings frame of 012 until 016, D-85).
- Below `xl` and collapsed sidebar: as §9.

