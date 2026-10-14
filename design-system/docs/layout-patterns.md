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

| Directus app                                                                         | Backoffice (TailAdmin shell)                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Module bar (left icon rail)                                                          | One sidebar group "Menu" (L-2), no "Others" group. Items in `module_bar` order: each enabled module and each `module_bar` link (internal or external) in the same list, icon + label (`menu-item`). Settings last, admins only |
| Module navigation (second column: collections, folders, presets, settings pages ...) | The module's sub-menu (`menu-dropdown-item`), **one level** (L-3): feature 012 provides this slot; each module feature (014+) decides what goes in it and how deeper navigation (collection groups, folders) works             |
| Settings module                                                                      | Last sidebar item, admins only (Directus permission)                                                                                                                                                                           |
| Module bar links                                                                     | Internal links: router links as items. External URLs: open in a new tab, `target="_blank" rel="noopener noreferrer"` plus an "opens in a new tab" hint (`open_in_new` icon `aria-hidden` + sr-only text)                       |
| Project logo / name at the top of the module bar                                     | Sidebar logo area; logo background uses `--project-color` (branding, README)                                                                                                                                                   |
| Header bar (icon, title, breadcrumb, action buttons)                                 | Page header inside the content (`PageBreadcrumb` layout): title + breadcrumb on the left, actions (Button recipes) on the right, wraps on small screens                                                                        |
| Right sidebar (info, revisions, comments, layout options)                            | Optional right detail panel (L-4, below)                                                                                                                                                                                       |
| User avatar / menu at the bottom of the module bar                                   | `UserMenu` in the header: avatar, name, email, items (profile = Directus user detail page, other Directus entries), Sign out                                                                                                   |
| Notifications drawer                                                                 | `NotificationMenu` button in the header (only if the feature ships it)                                                                                                                                                         |
| Theme (light/dark/auto from user/settings)                                           | `ThemeToggler` in the header sets the `dark` class; the initial value follows the Directus user/settings appearance                                                                                                            |

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
