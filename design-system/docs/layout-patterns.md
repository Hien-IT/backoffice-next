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
        div       w-full p-4 pb-20 md:p-6 md:pb-6                               ← page content (Backoffice: main)
          AppHeader header (sticky): sidebar toggle + PageBreadcrumb (page title + breadcrumb)   ← Backoffice, owner 2026-10-20
          page body (cards, tables, forms)
          [DetailPanel] popover of the page header toggle (Backoffice, optional, section 7)
```

Pages without the shell (sign in, 404) use `FullScreenLayout`: `div.min-h-screen > main > slot`.

## 2. Sidebar (`AppSidebar.vue`)

**Backoffice since D-157 (owner 2026-10-22): one sidebar column in the manner of the Arc browser sidebar.** Built:
`layout/AppSidebar.vue` (also the Directus module-bar port), `ModuleTabs.vue`, `composables/use-module-bar.ts`,
`PrivateView.vue`. (The same day a top tab bar, then a Directus-like vertical icon rail came first; the owner chose this.)

- Column `aside#navigation` (`aria-label` `navigation`): from `xl` `fixed inset-y-0 start-0 w-[290px]`, the content
  `xl:ms-[290px]`; the header toggle (always shown) hides the whole column (saved in `backoffice-nav-bar-collapsed`, no
  rail); below `xl` the same column is the drawer of §3.
- Card on the project color (`data-testid="module-rail"`, after the owner's mock-up 2026-10-22:
  `m-3 flex flex-col gap-4 rounded-2xl bg-linear-to-br from-(--project-color) to-brand-800 p-4 shadow-theme-md`): the
  logo (`SidebarLogo`, `size-12`, the default app icon or `project_logo`) with the project name
  `text-lg font-semibold text-white` and descriptor `text-theme-xs text-white/80`, then the module tiles: `nav`
  `aria-label` `modules`, `data-testid="module-bar"`, `grid grid-cols-3 gap-2`; each tile
  `flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-theme-xs font-medium` with the icon and the name under it
  (truncated, full name in `title`); active `bg-white text-gray-800 shadow-theme-sm ring-2 ring-white/60` +
  `aria-current="page"`, others `bg-white/10 text-white hover:bg-white/20`; focus `outline-white`; `module_bar` order,
  FR-021, FR-081, D-49 unchanged; the tiles are the internal modules only. The `module_bar` links (Settings > Project >
  Module Bar, Add Link; internal router links or external links in a new tab) and the app extension modules (D-144)
  share one `apps` tile labelled `more_modules` ("More", accessible name "More: Links and extensions", D-162) opening a
  BoMenu of them in `module_bar` order, the open one checked; the tile is active on their pages and absent when there
  are none.
- Below the block, on white: the open module's title row (`px-5 pt-5 pb-3`, module icon gray-500 / gray-400, `h2`
  `text-base font-semibold`, then the `module-actions-<id>` target, e.g. the Content hidden-collections toggle), then its
  `navigation` slot (`px-5`, scrolls); pages without navigation keep the column with the tiles only.
- Bottom row (`border-t border-gray-200 px-5 py-3`): the user menu (avatar and name, menu opens upwards) and the
  notifications bell (TailAdmin round button, panel opens upwards).
- Why white under the block: the module navigations (trees, search, menus) use the light theme colors; on the project
  color their gray text would not be readable.
- The TailAdmin sidebar below (logo, groups, rail, hover expand) and the sidebar rows of §7 describe the layout before
  D-157.

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
| Groups             | `nav.mb-6 > div.flex.flex-col.gap-4`; group titles "Menu" and "Others" rendered uppercase: `h2.mb-4.flex.text-xs.uppercase.leading-5.text-gray-400`; when collapsed the title is replaced by a "…" icon and centred. **Backoffice:** one group "Menu" only (L-2); since 016 its title is `sr-only` (the name of the nav, no visible title or "…" icon, user request)                                    |
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
sidebar. **Backoffice:** `fixed inset-0 z-9999 bg-gray-900/50 xl:hidden`, `aria-hidden="true"`. The detail panel is a popover
without Backdrop (section 7, owner 2026-10-20).

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
- **Backoffice (owner 2026-10-20): header and user block.** The header holds only the sidebar toggle and the page header
  of §5 (`min-w-0 flex-1` slot); it sits at the top of `main` (sticky `top-0`, negative margins over the content
  padding), so it is not a `banner` landmark. The user menu and the bell are under the sidebar logo:
  `mb-6 flex items-center gap-3`, `justify-between` when expanded, `flex-col` on the 90px rail (avatar only, name and
  chevron hidden; the bell folds into the avatar, owner 2026-10-21: its badge on the avatar and the count in the trigger
  name; the bell keeps its live region). The rail expands on hover and keyboard focus and stays expanded while the user
  menu is open (the menu is portaled, so entering it is a mouseleave); the avatar trigger keeps `min-w-10` so the bell
  never covers it while the width animates. Below `xl` (sidebar drawer) the bell sits at the end of the header row
  instead, so its badge and live region stay on screen. The bell opens the notification panel (D-132, the TailAdmin
  "Notification panel" above): Reka Popover, `side` bottom, `align` start, `rounded-2xl border p-3 shadow-theme-lg`,
  `w-87.5 max-h-120`; title `text-lg font-semibold` with a ghost "Mark all as read", the 10 newest inbox rows (brand dot,
  subject `text-theme-sm font-medium truncate` as a link to its target, relative time `text-theme-xs`, an `ICON_BTN`
  `done` "Mark as read"), then a full-width secondary "View all" that opens the notifications drawer. The avatar is 40px like the logo (BoAvatar `small`, owner 2026-10-21). The menu opens
  `align="start"`; the name truncates (`min-w-0 truncate`).

## 5. Content area and page header

- Primary (owner 2026-10-22, D-158): with a settings `project_color` the `--color-brand-25…950` scale is derived from it
  (`theme/use-app-head.ts` `brandScaleCss`: 500 = the color, lighter steps `color-mix` with white at 6/9/16/30/49/72%,
  darker with gray-950 at 91/77/60/47/21% of the color), so every `brand-*` utility follows it like the Directus
  `primary: var(--project-color)`; without one the TailAdmin scale stays. Contrast then depends on that data color.
- Page background (owner 2026-10-22, D-152): light `color-mix(in srgb, var(--color-white), var(--project-color) 5%)` on
  `body` (`styles/base.css`), the Directus Color Match background at 5% instead of 7% so brand-500 text keeps 4.5:1
  (4.53:1, gray-500 4.66:1 with the default project color; a very dark project color can still go below); dark keeps
  `gray-900`.
- Container: `w-full p-4 pb-20 md:p-6 md:pb-6` (16px padding, 24px from `md`). Backoffice (owner 2026-10-18): no
  TailAdmin `mx-auto max-w-(--breakpoint-2xl)` cap; the content fills the width after the sidebar like Directus, so a
  wide screen shows no empty band on either side. The page header always spans the content width, its actions at the right edge; a body capped at `max-w-5xl` (Settings forms, D-82) stays
  at the left like Directus. The item pages (Content, File, User) put their body at the left (owner 2026-10-22; centred from
  2026-10-18) in a column as wide as the form shows (`max-w-[47.375rem]`: two 21.375rem columns and the gap plus the form card padding and border, D-150;
  `max-w-[67.125rem]` when a field is `fill`; `utils/form-column.ts`); their page header
  keeps the full width, title at the left and actions at the right (owner 2026-10-18).
- Page header (`PageBreadcrumb.vue`): `flex flex-wrap items-center justify-between gap-3 mb-6`; title
  `h2.text-xl.font-semibold.text-gray-800 dark:text-white/90`; breadcrumb `nav > ol.flex.items-center.gap-1.5`, links
  `inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400` followed by a chevron, current page
  `text-sm text-gray-800 dark:text-white/90`. The breadcrumb is not shown (016 D-101, owner 2026-10-17).
- The page header sits in the app header row after the sidebar toggle, at the top of `main` like the Directus header
  bar (owner 2026-10-20; the page title stays `main h1`). The app header is `sticky top-0` with negative margins over
  the content padding, so the page header stays in view while the page scrolls (owner request 2026-10-17). `fill` list
  pages keep their header fixed already (D-99).
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
| Settings module                                                                      | Last sidebar item, admins only (Directus permission); its sub-menu is the flat grouped list of §12 (016)                                                                                                                                                                                                                             |
| Extension modules (020, D-144)                                                       | Since D-157/D-162 items of the `apps` tile menu (with the module_bar links) in the sidebar module grid (§2). Before: one `Extensions` row (`extension` icon, a `<button>` with `aria-expanded`) after the module_bar items; its sub-menu lists the enabled app extension modules in `module_bar` order (`menu-dropdown-item`), the open module shows its own navigation one level below (owner 2026-10-22: three levels here only). Opens on an extension page |
| Module bar links                                                                     | Internal links: router links as items. External URLs: open in a new tab, `target="_blank" rel="noopener noreferrer"` plus an "opens in a new tab" hint (`open_in_new` icon `aria-hidden` + sr-only text)                                                                                                                             |
| Project logo / name at the top of the module bar                                     | Sidebar logo area; logo background uses `--project-color` (branding, README)                                                                                                                                                                                                                                                         |
| Header bar (icon, title, breadcrumb, action buttons)                                 | Page header in the app header row after the sidebar toggle (`PageBreadcrumb` layout, owner 2026-10-20): title + breadcrumb on the left, actions (Button recipes) on the right, wraps on small screens                                                                                                                                                                              |
| Right sidebar (info, revisions, comments, layout options)                            | Optional right detail panel (L-4, below)                                                                                                                                                                                                                                                                                             |
| User avatar / menu at the bottom of the module bar                                   | `UserMenu` in the sidebar under the logo (owner 2026-10-20; avatar only on the rail): avatar, name, email, items (profile = Directus user detail page, other Directus entries), Sign out                                                                                                                                                                                                         |
| Notifications drawer                                                                 | Bell button in the sidebar after `UserMenu`, under the logo (feature 018, D-107; owner 2026-10-20; folded into the avatar on the rail, 2026-10-21): TailAdmin round header button with a count badge (component-specs "Notifications bell", Q-38); opens the notifications drawer (Q-39)                                                                                                                               |
| Insights dashboards (018)                                                            | Dashboard list in the module sub-menu (L-3, flat rows with colored icon); the dashboard page is a `fill` page with the dashboard grid of §14                                                                                                                                                                                          |
| Theme (light/dark/auto from user/settings)                                           | `ThemeToggler` in the header sets the `dark` class; the initial value follows the Directus user/settings appearance                                                                                                                                                                                                                  |

### Right detail panel (L-4, Backoffice; TailAdmin has none)

- Toggle icon (owner 2026-10-22, D-161): `info` in both states (Directus `right_panel_open` / `right_panel_close`); the
  open state is the button tint `data-[state=open]:bg-brand-500/[0.08] text-brand-600` (dark `text-brand-400`); the
  name stays `open_sidebar` / `close_sidebar`.
- Owner 2026-10-20: on every screen a popover under its toggle at the end of the page header (Reka `Popover`, `side`
  bottom, `align` end), closed on every page load; the toggle shows only when the page has details. Esc and a click
  outside close it, focus returns to the toggle; focus moving out does not close it (a dialog opened from a detail
  stays usable). No inline column, no drawer, no resize.
- Width 333px like Directus: `w-[333px] max-w-[calc(100vw-2rem)]`, height up to the available space
  (`max-h-(--reka-popover-content-available-height) overflow-y-auto`).
- Look: dropdown surface `z-99999 rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800
  dark:bg-gray-dark`; sections as collapsible blocks
  (`px-5 py-4 border-b border-gray-200 dark:border-gray-800`, title
  `text-theme-sm font-medium text-gray-800 dark:text-white/90`, toggle `<button aria-expanded>` with `FOCUS`), content
  text `text-theme-sm text-gray-500 dark:text-gray-400`.
- `<aside aria-label="…">` (Directus label of the panel, for example "Item details").

### Accessibility and keyboard requirements

- Skip link as the first focusable element: "Skip to main content" → `<main id="main">`; visually hidden until focused.
- Landmarks: `<aside aria-label="…">` with `<nav aria-label="Main">` for the sidebar, `<main>` (Backoffice: the
  `<header>` of the page is inside it, owner 2026-10-20), the right panel as `<aside aria-label="…">` inside its popover.
- Active link: `aria-current="page"` on the active item or sub-item (not only the `-active` classes).
- Sub-menu toggles are `<button aria-expanded="true|false" aria-controls="…">`; the header sidebar toggle has
  `aria-expanded`, `aria-controls` and a label ("Open menu" / "Close menu"); the collapse state is not only visual.
- Every icon-only button (sidebar toggle, application menu, theme, notifications, panel close) has an accessible label;
  icons are `aria-hidden="true"`. Collapsed sidebar items keep their label for assistive tech (sr-only or `aria-label`)
  and show a tooltip on hover/focus.
- Hover-to-expand also needs a keyboard path: focus inside the collapsed sidebar expands it like hover (or the collapse
  toggle is used); never hide focused content.
- Off-canvas sidebar (below `xl`): focus moves into the drawer on open, is trapped while open (Reka `Dialog` or
  equivalent), Esc closes, focus returns to the trigger, the Backdrop click closes. Right detail panel: Reka `Popover`,
  Esc and an outside click close it, focus returns to its toggle (section 7).
- Dropdowns (user menu, notifications) use Reka `DropdownMenu`/`Popover`: arrow keys, Esc, focus return.
- Visible focus on every control (see component-specs: focus-visible recipe).
- Minimum supported width 768px; no horizontal page scroll from 768px (tables scroll inside their own `overflow-x-auto`
  container).
- List pages (Content, Files, Users collections; 016 D-99): `PrivateView fill` keeps the page at the viewport height
  (`relative h-dvh overflow-hidden`); only the table body scrolls, the page header and pagination stay put.
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
  drawers keep their own width. Below a 500px (31.25rem) form width every field spans
  the row, as the Directus `form-grid` container query: the grid is an `@container` and the width classes apply from
  `@min-[31.25rem]` (forms in dialogs, narrow groups and extension boxes are under 500px).
- Widths (Directus `meta.width`, after the Directus `updateFieldWidths`, which turns a `half` that follows a visible
  `half` into `half-right`): `col-span-full` below 31.25rem, then `half` / `half-left` → `col-start-1 col-span-1`,
  `half-right` → `col-start-2 col-span-1`, `full` → `col-start-1 col-span-2`; `fill` → `col-span-full`. Groups use the
  same classes.
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

### Form card (D-150, owner 2026-10-22)

The owner asked (2026-10-22, after comparing with the TailAdmin Form Layout demo) to put the page forms in a TailAdmin
Card. Directus `v-form` has no card; fields, widths and behaviour stay those of Directus (principle VI), only the
surface changes.

- Built: `BoForm` prop `card` (the sections reuse one field loop through `createReusableTemplate`),
  `utils/form-column.ts`; used by the item pages Content (`ItemRoute`, also new items, singletons and the start pane of
  the live preview split), File (`FileItemRoute`), User (`UserItemRoute`) and the Settings pages Project, Appearance, Role, Public role, Policy, Preset, Translation and the Data Model collection page
  (the collection options form under the fields list).
- Unchanged: forms in drawers and dialogs (DrawerItem, DrawerBatch, FlowDrawer, field detail, ComparisonModal), nested
  group forms and ExtensionOptions; they already sit on a drawer or dialog surface.
- Cards: the form is a `flex flex-col gap-6` column of Cards (container
  `rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`), one per section: each
  visible divider (`presentation-divider`, also the system divider) starts a new card (owner 2026-10-22). A divider with
  a title or icon becomes the Card header (`flex items-center gap-3 px-6 py-5`, icon gray-500 / gray-400, `h3`
  `text-base font-medium text-gray-800 dark:text-white/90`; the divider color stays an inline style); its body grid gets
  `border-t border-gray-100 dark:border-gray-800`. The first card (fields before any divider) has no header: the page
  title is already in the page header (D-127). Each body is the form grid with `p-4 sm:p-6`; the fill threshold (726px)
  and the 31.25rem container query read the content box of the first grid, so they measure the fields, not the card. A
  section without a visible field is left out; hidden dividers do not split.
- The card holds the BoForm only. Blocks above or below stay outside it: file preview and image editor, user box,
  preset layout preview, Data Model fields list. The user box takes the card background
  `bg-white dark:bg-white/[0.03]` (it already had the card border) so the two blocks match.
- Width: the fields keep their Directus widths (342px columns), so the card is the form column plus padding and border:
  item pages `max-w-[47.375rem]` at the left (44.25rem + 2 × 1.5rem + 2px), `max-w-[67.125rem]` with a `fill` field (64rem +
  the same). Settings: the card sits in the existing `max-w-5xl` wrapper; the form is then 974px wide and keeps the
  three-column `fill` grid (> 726px).
- Inside the cards: grid, the validation notice (first card) and loading skeletons are unchanged. Empty form (no
  visible fields): one card, no card in the card, the info drops its border, background and padding (icon and the two
  lines stay centred).
- Inputs keep their classes: on the white card they read white like TailAdmin; dark `bg-gray-900` on
  `bg-white/[0.03]` like TailAdmin. Their borders are the TailAdmin gray-300 (C-2 lifted 2026-10-22).
- Accessibility: the card is a plain `div` (no role or landmark); focus order and labels unchanged.
- Forms without `card` (drawers, dialogs, nested groups) keep the single grid and the Directus divider look.

### Drawer (`BoDrawer`; Directus `v-drawer`)

- Built: `apps/web/src/components/drawers/BoDrawer.vue`; used by `DrawerItem.vue` (nested item edit),
  `DrawerCollection.vue` (item select), `DrawerFiles.vue` (file select), `DrawerBatch.vue` (batch edit) and the block
  editor image upload.
- Reka `DialogRoot` / `DialogPortal` / `DialogOverlay` / `DialogContent` / `DialogTitle` / `DialogDescription`, the
  panel on the end side.
- Overlay: `fixed inset-0 z-99999 bg-gray-900/50 dark:bg-gray-950/80` (the Backdrop colors; darker in dark mode, where
  the page and the panel share `gray-900`, 016).
- Panel:
  `fixed inset-y-0 end-0 z-99999 flex w-full flex-col bg-white shadow-theme-xl outline-hidden xl:w-[640px] dark:border-s dark:border-gray-800 dark:bg-gray-900`
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
- A drawer opened from the detail panel popover opens above it; the popover stays open (focus moving out does not close
  it, owner 2026-10-20).

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
- Nesting: children in a `ul role="group"` `mt-1 flex flex-col gap-1 ps-4`; a group row has a toggle button at the end
  of the row (`size-6 rounded FOCUS`, `expand_more` turning 180° when open, `motion-reduce:transition-none`,
  `aria-label` `expand` / `collapse` + name), as the TailAdmin sub-menu chevron and Directus (owner 2026-10-21: siblings
  with and without children stay aligned and children sit 16px deeper than their parent); a folder (collection without
  `schema`) is a row whose label is not a link and toggles on click; `collapse: locked` groups have no toggle. The toggle
  has `tabindex="-1"`: the tree keys open and close groups, so the toggle is for the mouse.
- Root folders as group titles (D-156, owner 2026-10-22): a level-1 folder (no `schema`, with children) is shown like
  the TailAdmin menu group title: `min-h-8 text-theme-xs uppercase tracking-wide text-gray-500 hover:text-gray-700
  dark:text-gray-400 dark:hover:text-gray-300`, no icon, `mt-3` from the previous root row, its children without the
  `ps-4` indent; the toggle, click and keyboard stay the same. Deeper folders and collections with children keep the
  row style.
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

## 12. Settings sub-menu and collection tree (nháp, 016)

Recipe for spec 016 Q-20 and Q-24 (T005, FR-107), written before the code and approved by the owner on 2026-10-17. Behaviour is the Directus one (`modules/settings/components/navigation.vue`,
`routes/data-model/collections/*`).

- **Settings sub-menu (Q-24)**: one level (L-3, no tree exception). Rows are `menu-dropdown-item` links with icon and
  label, in three groups split by the §11 divider (`my-2 h-px bg-gray-200 dark:bg-gray-800`, `role="separator"`):
  Data Model (`database`), Flows (`bolt`, the flows editor of §13, 017); Roles (`group`), Access Policies
  (`admin_panel_settings`); Project (`tune`), Appearance (`palette`), Presets (`bookmark`), Translations
  (`translate`). Active row by route prefix (`aria-current="page"`). No Report Bug / Request Feature rows (D-94) and no
  version row at the end (D-95).
- **Collection tree (Q-20)**: in the page body (not the sidebar), inside a Card (`rounded-2xl border border-gray-200
  bg-white dark:border-gray-800 dark:bg-white/[0.03]`). A row is `flex min-h-11 items-center gap-3 px-4` with: drag
  handle (`drag_indicator`, `ICON_BTN` 32x32, `cursor-grab`, mouse only, `aria-hidden` on the icon), collection icon in
  `meta.color` (inline `style="color: …"` from data; default `text-brand-500`), the key in `font-mono text-theme-sm`
  with the search match in `bg-warning-50 text-warning-700`, the note in `text-theme-xs text-gray-500 truncate`, then
  at the end the collapse toggle (`unfold_less`/`unfold_more`, `aria-expanded`, only with children) and the row menu
  (`more_vert`, `aria-label` `item_options`). Hidden collections: icon `visibility_off`, row text `text-gray-400`.
  Children nest in `ps-6` with a start border `border-s border-gray-100 dark:border-gray-800`. Clicking the row links
  to the collection page; a folder row opens the folder dialog.
- Folders and drops (owner 2026-10-21): a folder row (no `schema`) has a dashed brand border on a brand tint
  (`border-dashed border-brand-300 bg-brand-25`, dark `border-brand-500/40 bg-brand-500/[0.06]`, `folderRowClass`). An
  empty folder shows a drop area under its name (`min-h-10 rounded-lg border border-dashed border-gray-300
  dark:border-gray-700`, centred hint `drop_collections_here` in `text-theme-xs text-gray-500`, `pointer-events-none`);
  an empty table keeps a drop target of no layout height (`h-0`, the list's `min-h-3` overflows into the row padding)
  so its row stays centred on the handle. The lists use the nested-drag settings of the SortableList recipe.
- Row menu (BoMenu): `goto_collection_content`, hide/show, the three collapse defaults (current one checked), then the
  move items of D-96 (Move up, Move down, Into the group above, Out of the group; disabled at the ends), divider, delete
  (`text-error-600 dark:text-error-500`). Moving by menu announces the new place in a polite live region (the
  BoSortableList strings) and keeps focus on the row.
- "Expand all / none" bar above the tree: `text-theme-sm` label `expand` with two text buttons, only when a folder
  exists. Search in the page header (`SearchInput` without filter).
- Unmanaged tables: a second Card titled `db_only_click_to_configure` rows with `add` and `dns` icons, a link to the
  collection page and the row menu with delete only.
- System collections: a `BoDetail` (closed by default) titled `system_collections`; rows with the `settings` icon, no
  handle, no menu.
- Empty: the 014 blank state (`box` icon, `no_collections`, `no_collections_copy_admin`, primary Button
  `create_collection`). Loading: six skeleton rows as §11.
- Folder dialog: BoDialog (`create_folder` / `edit_folder`) with the key (BoInput `dbSafe`, `font-mono`, disabled when
  editing), icon (BoIconPicker), color (BoColorPicker), note (BoInput) and the translations list (`list` interface);
  Cancel first, Save primary (disabled without key).
- At 768px a row keeps one line; the note truncates.

## 13. Flow canvas (nháp, 017)

Recipe for spec 017 Q-29 (T004, FR-107), written before the code and updated to it (T101, 2026-10-17); approved by the design
owner on 2026-10-17. Behaviour is the
Directus one (`modules/settings/routes/flows/flow.vue`, `components/operation.vue`, `components/arrows/*`,
`components/v-workspace*.vue`); this section only sets the look.

- **Page**: `PrivateView fill` (D-99): page header stays, the canvas is the only scroll area (`overflow-auto` on both
  axes, `relative`). The canvas box is a focusable `role="region"` labelled with the flow name (`tabindex="0"`, `FOCUS`
  inset): in view mode it holds no control, and the keyboard scrolls the canvas from it (axe
  `scrollable-region-focusable`). The right detail panel (L-4) holds the Logs section (component-specs "Flow logs").
- **Grid**: one cell is 18 px (CSS grid, tiles placed by row/column span). In edit mode only (as Directus) a dot grid
  appears: a CSS `radial-gradient` of `var(--color-gray-300)` (dark `var(--color-gray-700)`) every 18 px, fading in
  150 ms (none with `motion-reduce`); no raw color. The canvas background stays the page background. Size in cells as
  Directus: edit mode `(x + width + 25) × 18` px, view mode `(x + width − 1) × 18` px from the furthest panel.
- **Panels** are absolutely positioned at `(position_x − 1) × 18`, `(position_y − 1) × 18`, 14 × 14 cells (252 px);
  recipe in component-specs "Flow operation panel".
- **Arrows**: one SVG over the canvas (`pointer-events-none`, `aria-hidden`), size = furthest panel + 100 px. Stroke
  2 px, round caps, rounded corners, 8 px ">" head. Resolve `stroke-brand-500` (dark `stroke-brand-400`), reject
  `stroke-orange-500` (dark `stroke-orange-400`) with `stroke-dasharray="6 4"` so the branch is not told by color
  only. Subdued (flow inactive, or panel not linked to the trigger): `opacity-50`. Hint stub (3 cells) and the arrow
  being dragged use the same stroke at `opacity-60`. Fade transition 150 ms, none with `motion-reduce`.
- **Modes**: view mode shows arrows of existing links only; edit mode adds the hint stubs, the "+" buttons and drag.
  Dragging panels and arrows is mouse/pointer only, as Directus (recorded exception in `qa/handoff-checklist.md`);
  everything else on the canvas (pencil, tile menu, trigger status select, header buttons) is a focusable control.
- **768 px**: the canvas keeps its size and scrolls; the detail panel stays the L-4 popover.


## 14. Dashboard grid and charts (018, duyệt 2026-10-18)

Recipe for spec 018 Q-34 and Q-35 (T003, FR-107), written before the code and updated to it (T120, after the axe scans
of T115); approved by the design owner on 2026-10-18. Behaviour is the Directus one (`modules/insights/routes/dashboard.vue`, `components/v-workspace*.vue`,
`panels/*`); this section only sets the look.

- **Page**: `PrivateView fill`, the grid is the only scroll area (`overflow-auto` on both axes), a focusable
  `role="region"` labelled with the dashboard name, as the flow canvas (§13). Header actions: zoom-to-fit toggle
  (`aspect_ratio`, pressed state `bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400`), edit (`edit`);
  in edit mode Clear Changes, "+" and Save.
- **Grid**: 18 px cells, tiles absolutely positioned at `(position_x − 1) × 18`, `(position_y − 1) × 18`, size
  `width × 18` by `height × 18` px. Edit mode adds the dot grid of §13 and 25 cells of room. Zoom-to-fit: one CSS
  `transform: scale()` from the top left corner, the outer box takes the scaled size (no scroll when it fits).
- **Tile** (Q-34): `rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900`;
  in edit mode `cursor-move border-gray-300` (hover `gray-400`; dark `gray-700` / `gray-600`); while dragged
  `border-brand-300 shadow-theme-md` (dark `border-brand-700`) and every corner rounded. A corner that touches another
  tile has radius 0 (Directus rule).
  Header (`show_header`): `h-10 px-4 flex items-center gap-2`, icon 20 px in the panel `color` (inline style, user
  data; default `text-brand-500`), name `text-theme-sm font-semibold text-gray-800 dark:text-white/90 truncate`, note
  as an info icon button (`ICON_BTN`, `aria-label` = note) with a BoTooltip on hover and focus. Body `px-4 pb-4`
  (`p-4` without header); a list or metric list body that scrolls takes the keyboard focus (`tabindex="0"`, focus
  ring, axe scrollable-region-focusable).
- **Tile states**: first load: centered `BoProgressCircular`; reload: body `opacity-50` (transition 150 ms, none with
  `motion-reduce`); error: `error-500` warning icon, `unexpected_error` and the error text `text-theme-xs`; empty:
  `no_data` `text-theme-sm text-gray-500` centered.
- **Edit mode**: pencil and `more_vert` `ICON_BTN` at the header end (menu Copy To, Duplicate, Delete
  `text-error-600`); 8 resize handles shown on hover (corners `size-3`, edges `h-3` / `w-3` along the side inset by
  12 px, `rounded-full bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-600`, cursor per direction);
  while resizing a label `W×H` and while moving `(x:y)` (`rounded bg-gray-800 px-1.5 font-mono text-theme-xs
  text-white`). Drag and resize are
  mouse/pointer only (recorded exception in `qa/handoff-checklist.md`).
- **Charts** (Q-35, ApexCharts): font `Outfit`; axis labels and legend `var(--color-gray-500)` (dark
  `var(--color-gray-400)`), grid lines `var(--color-gray-100)` (dark `var(--color-gray-800)`), no toolbar; default
  series color `var(--color-brand-500)` (D-108) when the panel `color` is empty; more series get the Directus
  mono-theme generator applied to that base (lighter/darker steps), each step at least 3:1 against the tile background.
  Tooltip and legend CSS of ApexCharts is overridden in `src/styles/apexcharts.css` with theme variables only (dark
  variant on `.dark`): tooltip `bg-white border-gray-200 shadow-theme-lg text-theme-xs` / dark `bg-gray-900
  border-gray-800`. Every chart has an sr-only table (caption = tile label) with the same series; the drawn chart is
  `aria-hidden`. Animations off with `prefers-reduced-motion`.
- **768 px**: the grid keeps its size and scrolls; the detail panel stays the L-4 popover; the panel drawer is full
  screen.
