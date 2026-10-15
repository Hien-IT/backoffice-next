# Migration guide: E-Hiring pack → TailAdmin

On 2026-10-15 the project owner replaced the E-Hiring design system (`--eh-*` tokens, Tailwind v3 config) with TailAdmin
Vue (constitution XII, 2.0.0). Class names are now TailAdmin's own theme names; there is no `eh-*` alias layer. The
E-Hiring open questions (primary `#1890FF` vs `#FF5F52`, font, status colors, radius/control height) are closed by the
TailAdmin values.

## Removed files

| File                               | Why                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `tokens/tokens.css`                | `--eh-*` custom properties, replaced by `tokens/theme.css`                    |
| `tailwind.config.js`               | Tailwind v3 theme extension; Tailwind 4 uses `@theme` in `tokens/theme.css`   |
| `styles/index.css` (and `styles/`) | v3 `@tailwind` entry and base styles; the base layer is in `tokens/theme.css` |
| `docs/audit-report.md`             | Audit of the E-Hiring Figma file, no longer the source                        |

`tokens/tokens.json`, `README.md`, `docs/component-specs.md`, `qa/handoff-checklist.md` and the two example components
were rewritten. `apps/web` still has its own copy of the old tokens (`src/styles/tokens.css`, `theme.css`,
`theme.test.ts`, `tools/check-raw-colors.mjs` exclusions); feature 012 Phase 11 replaces them.

## Steps for `apps/web`

1. Replace the `@theme` mapping of `--eh-*` with a copy of `design-system/tokens/theme.css`; delete the app's
   `tokens.css`.
2. Self-host Outfit and Noto Sans (woff2, `@font-face`, OFL text next to the files).
3. Replace every `eh-*` utility with the TailAdmin class from the table below, adding the `dark:` class each time.
4. Rebuild the shell per `layout-patterns.md` and the Tier 1 components per `component-specs.md`.
5. Point the raw-color check at the new theme file and forbid palette names outside the theme.
6. Map settings `theme_light_overrides` / `theme_dark_overrides` keys to the theme variables (`primary` →
   `--color-brand-500`, ...).
7. Check the contrast pairs below and run the handoff checklist.

## Token and utility mapping

| E-Hiring token / utility                                           | Backoffice class (light → `dark:`), final                                                                                                                                                             | Where TailAdmin uses it                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `--eh-color-action-primary`, `bg-eh-primary`                       | `bg-brand-500`, hover `bg-brand-600`, disabled `bg-brand-300`                                                                                                                                         | `ui/Button.vue` primary                  |
| `text-eh-primary` (links, active)                                  | links `text-brand-500 hover:text-brand-600` → `dark:text-brand-400`; active/selected on a tint `text-brand-600` → `dark:text-brand-400`                                                               | sign-in links, `menu-item-active`        |
| primary tint (`sky-50` hovers)                                     | `bg-brand-50` → `dark:bg-brand-500/[0.12]` (menu) or `dark:bg-brand-500/15` (badge)                                                                                                                   | `menu-item-active`, Badge                |
| `--eh-color-text-primary`, `text-eh-text-primary`                  | `text-gray-800` → `dark:text-white/90`                                                                                                                                                                | titles, input values, table primary cell |
| body / label text                                                  | `text-gray-700` → `dark:text-gray-400`                                                                                                                                                                | form labels, user menu                   |
| `--eh-color-text-secondary`, `text-eh-text-secondary`              | `text-gray-500` → `dark:text-gray-400`                                                                                                                                                                | descriptions, table cells, breadcrumb    |
| placeholder                                                        | `placeholder:text-gray-500` → `dark:placeholder:text-gray-400` (TailAdmin: gray-400 / white/30)                                                                                                       | inputs                                   |
| `--eh-color-surface-default`, `bg-eh-surface`                      | `bg-white` → `dark:bg-gray-900` (sidebar, header, inputs, modal); cards `dark:bg-white/[0.03]`                                                                                                        | AppSidebar, AppHeader, ComponentCard     |
| `--eh-color-surface-subtle`, `bg-eh-surface-subtle`                | page `bg-gray-50` → `dark:bg-gray-900` (body); subtle fill `bg-gray-100` → `dark:bg-white/5`; menus/popovers `dark:bg-gray-dark`                                                                      | base layer, hover rows, dropdown panels  |
| `--eh-color-border`, `border-eh-border`                            | `border-gray-200` → `dark:border-gray-800`; inner dividers `border-gray-100` → `dark:border-gray-800`; inputs, checkboxes `border-gray-500` → `dark:border-gray-500` (TailAdmin: gray-300 / gray-700) | cards, header, inputs                    |
| `--eh-color-status-success`                                        | tint `bg-success-50` → `dark:bg-success-500/15`; text on tint or white `success-700` → `dark:success-400`; icons `success-600` → `dark:success-500`; solid `bg-success-700` + white                   | Alert, Badge, table status               |
| `--eh-color-status-warning`                                        | tint `bg-warning-50` → `dark:bg-warning-500/15`; text `warning-700` → `dark:warning-400`; icons `warning-600` → `dark:warning-500`; solid `bg-warning-700` + white                                    | Alert, Badge                             |
| `--eh-color-status-danger`                                         | tint `bg-error-50` → `dark:bg-error-500/15`; badge text `error-700`, field error text and border `error-600` → `dark:error-400`; solid and danger button `bg-error-600` (hover `error-700`) + white   | Alert, Badge, input error                |
| info (was `eh-primary`)                                            | tint `bg-blue-light-50` → `dark:bg-blue-light-500/15`; text `blue-light-700` → `dark:blue-light-400`; icons `blue-light-600` → `dark:blue-light-500`; solid `bg-blue-light-700` + white               | Alert info, Badge info                   |
| `--eh-color-blue-*`, `--eh-color-neutral-*`, `red/orange/teal-500` | no direct equivalent: use the semantic rows above                                                                                                                                                     | —                                        |
| `--eh-radius-sm` (4px)                                             | `rounded` (badge in user menu) or `rounded-md` (checkbox)                                                                                                                                             | —                                        |
| `--eh-radius-md` (8px), `rounded-eh-md`                            | `rounded-lg`                                                                                                                                                                                          | buttons, inputs, menu items              |
| `--eh-radius-lg` (12px), `rounded-eh-lg`                           | `rounded-xl` (alert, table frame); cards and popovers `rounded-2xl`; modal `rounded-3xl`                                                                                                              | —                                        |
| `--eh-radius-full`                                                 | `rounded-full`                                                                                                                                                                                        | badges, avatars, toggles                 |
| `--eh-spacing-*`, `p-eh-*`                                         | Tailwind default scale (`p-1` = 4px … `p-12` = 48px)                                                                                                                                                  | —                                        |
| `--eh-font-family-body`, `font-eh`                                 | `font-outfit` (Outfit, Noto Sans fallback); set on `body` by the base layer                                                                                                                           | —                                        |
| `--eh-font-size-xs` (12) / `sm` (14)                               | `text-theme-xs` (12/18) / `text-theme-sm` (14/20) or `text-sm`                                                                                                                                        | —                                        |
| `--eh-font-size-base` … `3xl`                                      | `text-base`, `text-lg`, `text-theme-xl` (20/30), `text-2xl`; display `text-title-sm` (30) … `text-title-2xl` (72)                                                                                     | —                                        |
| `--eh-shadow-sm`                                                   | `shadow-theme-xs` (inputs, buttons) or `shadow-theme-sm`; popovers `shadow-theme-lg`                                                                                                                  | —                                        |
| focus outline (`outline-eh-primary`)                               | `focus-visible:outline-brand-500` → `dark:focus-visible:outline-brand-400` (Backoffice recipe, component-specs)                                                                                       | —                                        |

## Dark mode pattern

- The `dark` class on `<html>` turns dark mode on (`@custom-variant dark (&:where(.dark, .dark *))`). The app sets it
  from the user's appearance (Directus `light` / `dark` / `auto` → `prefers-color-scheme`).
- Every color class has its `dark:` partner in the same `class` attribute: `bg-white dark:bg-gray-900`,
  `text-gray-800 dark:text-white/90`, `border-gray-200 dark:border-gray-800`. No separate dark stylesheet.
- Dark surfaces are layered with white at low opacity on `gray-900`: card `white/[0.03]`, subtle fill `white/5`, hover
  `white/5` or `white/[0.07]`; popovers use `gray-dark`.
- Tints become the 500 color at 12–15 % (`dark:bg-brand-500/[0.12]`, `dark:bg-success-500/15`) and text moves one step
  lighter (`brand-500` → `brand-400`).
- Images with a dark variant use the `dark:hidden` / `hidden dark:block` pair (logo, 404 illustration).

## Contrast (WCAG 2.x)

The pairs used by the final recipes (`component-specs.md`, `layout-patterns.md`, the `menu-*` utilities), computed from
`tokens/tokens.json`: alpha colors are composited on the stated background, the dark page is `gray-900`. Text needs
4.5:1 (no use here is large text); input boundaries, toggle tracks, icons that carry meaning and focus indicators need
3:1 (WCAG 1.4.11). Disabled controls are exempt. All pairs pass except the three rows marked "fail", which are open
points of feature 013 for the design owner. Add a row (and recompute) for any new pair. Feature 014 (Content module) uses only pairs already listed.

| Mode  | Foreground       | Background            | Use                                                                                                       | Ratio   | Needed | Result |
| ----- | ---------------- | --------------------- | --------------------------------------------------------------------------------------------------------- | ------- | ------ | ------ |
| light | `white`          | `brand-500`           | Primary button, solid primary badge, checked checkbox/toggle                                              | 4.84:1  | 4.5:1  | pass   |
| light | `white`          | `brand-600`           | Primary button hover                                                                                      | 6.50:1  | 4.5:1  | pass   |
| light | `brand-500`      | `white`               | Link                                                                                                      | 4.84:1  | 4.5:1  | pass   |
| light | `brand-600`      | `brand-50`            | Active menu item and icon, light primary badge, selected option                                           | 5.83:1  | 4.5:1  | pass   |
| light | `gray-800`       | `white`               | Titles, input value                                                                                       | 14.70:1 | 4.5:1  | pass   |
| light | `gray-700`       | `white`               | Labels, inactive menu item, outline button                                                                | 10.46:1 | 4.5:1  | pass   |
| light | `gray-500`       | `white`               | Secondary text, hints, placeholder, table header, "MENU" label                                            | 4.97:1  | 4.5:1  | pass   |
| light | `gray-500`       | `gray-50`             | Secondary text on page background, hovered table row                                                      | 4.76:1  | 4.5:1  | pass   |
| light | `gray-500`       | `gray-100`            | Modal close icon, avatar fallback icon                                                                    | 4.51:1  | 4.5:1  | pass   |
| light | `gray-700`       | `gray-100`            | Light "light" badge                                                                                       | 9.49:1  | 4.5:1  | pass   |
| light | `error-600`      | `white`               | Field error message, required mark                                                                        | 4.83:1  | 4.5:1  | pass   |
| light | `success-700`    | `white`               | Field success message                                                                                     | 5.41:1  | 4.5:1  | pass   |
| light | `success-700`    | `success-50`          | Light success badge                                                                                       | 5.13:1  | 4.5:1  | pass   |
| light | `warning-700`    | `warning-50`          | Light warning badge                                                                                       | 5.20:1  | 4.5:1  | pass   |
| light | `error-700`      | `error-50`            | Light error badge                                                                                         | 6.05:1  | 4.5:1  | pass   |
| light | `blue-light-700` | `blue-light-50`       | Light info badge                                                                                          | 5.49:1  | 4.5:1  | pass   |
| light | `gray-500`       | `error-50`            | Alert message (lowest of the four tints)                                                                  | 4.58:1  | 4.5:1  | pass   |
| light | `white`          | `success-700`         | Solid success badge/button                                                                                | 5.41:1  | 4.5:1  | pass   |
| light | `white`          | `warning-700`         | Solid warning badge/button                                                                                | 5.43:1  | 4.5:1  | pass   |
| light | `white`          | `error-600`           | Danger button, solid error badge                                                                          | 4.83:1  | 4.5:1  | pass   |
| light | `white`          | `error-700`           | Danger button hover                                                                                       | 6.57:1  | 4.5:1  | pass   |
| light | `white`          | `blue-light-700`      | Solid info badge                                                                                          | 5.86:1  | 4.5:1  | pass   |
| light | `white`          | `gray-500`            | Solid light badge, light "dark" badge                                                                     | 4.97:1  | 4.5:1  | pass   |
| light | `white`          | `gray-700`            | Solid dark badge                                                                                          | 10.46:1 | 4.5:1  | pass   |
| light | `white`          | `gray-900`            | Tooltip                                                                                                   | 17.75:1 | 4.5:1  | pass   |
| light | `gray-500`       | `white`               | Input, select, textarea, checkbox border; toggle off track                                                | 4.97:1  | 3:1    | pass   |
| light | `brand-500`      | `white`               | Focus outline, input focus border                                                                         | 4.84:1  | 3:1    | pass   |
| light | `brand-500`      | `gray-50`             | Focus outline on page background                                                                          | 4.63:1  | 3:1    | pass   |
| light | `error-600`      | `white`               | Invalid input border, error focus outline                                                                 | 4.83:1  | 3:1    | pass   |
| light | `success-600`    | `white`               | Valid input border                                                                                        | 3.73:1  | 3:1    | pass   |
| light | `success-600`    | `success-50`          | Alert icon (lowest: warning-600 below)                                                                    | 3.54:1  | 3:1    | pass   |
| light | `warning-600`    | `warning-50`          | Alert icon                                                                                                | 3.34:1  | 3:1    | pass   |
| light | `gray-700`       | `gray-50`             | Upload dropzone text (013)                                                                                | 10.01:1 | 4.5:1  | pass   |
| light | `gray-700`       | `brand-50`            | Upload dropzone text and hint while dragging (013)                                                        | 9.38:1  | 4.5:1  | pass   |
| light | `gray-800`       | `error-50`            | ValidationErrors field name (013)                                                                         | 13.52:1 | 4.5:1  | pass   |
| light | `warning-700`    | `white`               | Soft-length counter, under 10 % left (013)                                                                | 5.43:1  | 4.5:1  | pass   |
| light | `white`          | `gray-900/0.95`       | Lightbox title and icons, composited over white (013)                                                     | 15.63:1 | 4.5:1  | pass   |
| light | `white`          | `white/0.1`           | Lightbox button on the lightbox background (013)                                                          | 11.50:1 | 4.5:1  | pass   |
| light | `warning-600`    | `white`               | Rating filled star (013; on `gray-50` 3.34:1)                                                             | 3.49:1  | 3:1    | pass   |
| light | `brand-500`      | `gray-200`            | Slider range and upload progress bar on the track (013)                                                   | 3.90:1  | 3:1    | pass   |
| light | `brand-500`      | `gray-900/0.95`       | Focus outline in the lightbox (013)                                                                       | 3.23:1  | 3:1    | pass   |
| light | `gray-800`       | `brand-50`            | Radio "other" row selected, input text (013)                                                              | 13.18:1 | 4.5:1  | pass   |
| light | `brand-500`      | `brand-50`            | Radio "other" icon when selected (013)                                                                    | 4.34:1  | 3:1    | pass   |
| light | `gray-800`       | `gray-100`            | Radio "other" text not selected, markdown inline code (013)                                               | 13.34:1 | 4.5:1  | pass   |
| light | `brand-600`      | `white`               | Calendar today, active tab, CodeMirror keyword, markdown heading (013; on `gray-50` 6.22)                 | 6.50:1  | 4.5:1  | pass   |
| light | `brand-600`      | `gray-100`            | Calendar today hovered, fill-template button hovered (013)                                                | 5.90:1  | 4.5:1  | pass   |
| light | `gray-700`       | `gray-200`            | Chip delete button and selected tag preset hovered (013)                                                  | 8.44:1  | 4.5:1  | pass   |
| light | `error-600`      | `gray-100`            | Remove button icon hovered (013)                                                                          | 4.38:1  | 3:1    | pass   |
| light | `error-700`      | `white`               | User popover error, CodeMirror string (013; on `gray-50` 6.29)                                            | 6.57:1  | 4.5:1  | pass   |
| light | `blue-light-700` | `gray-50`             | CodeMirror atom / def on the active line (013; on white 5.86)                                             | 5.60:1  | 4.5:1  | pass   |
| light | `success-700`    | `gray-50`             | CodeMirror number / type on the active line (013)                                                         | 5.18:1  | 4.5:1  | pass   |
| light | `warning-700`    | `gray-50`             | CodeMirror comment on the active line (013)                                                               | 5.19:1  | 4.5:1  | pass   |
| light | `orange-700`     | `gray-50`             | CodeMirror property on the active line (013; on white 5.52)                                               | 5.28:1  | 4.5:1  | pass   |
| light | `gray-800`       | `brand-100`           | CodeMirror selected text (013)                                                                            | 12.02:1 | 4.5:1  | pass   |
| light | `brand-500`      | `gray-100`            | Progress bar on its track: language select, upload (013)                                                  | 4.39:1  | 3:1    | pass   |
| light | `error-500`      | `gray-100`            | Translations display progress up to 33 % (013)                                                            | 3.41:1  | 3:1    | pass   |
| light | `warning-500`    | `gray-100`            | Translations display progress 34–66 % (013, Directus colors; open point)                                  | 2.13:1  | 3:1    | fail   |
| light | `success-500`    | `gray-100`            | Translations display progress above 66 % (013, Directus colors; open point)                               | 2.38:1  | 3:1    | fail   |
| light | `warning-600`    | `white`               | `input` / `input-multiline` counter under 10 % left (013, code; recipe warning-700; open point)           | 3.49:1  | 4.5:1  | fail   |
| dark  | `white/0.9`      | `gray-900`            | Titles, input value                                                                                       | 14.46:1 | 4.5:1  | pass   |
| dark  | `gray-400`       | `gray-900`            | Secondary text, labels, hints, placeholder                                                                | 6.89:1  | 4.5:1  | pass   |
| dark  | `gray-300`       | `gray-900`            | Inactive menu item                                                                                        | 12.04:1 | 4.5:1  | pass   |
| dark  | `brand-400`      | `brand-500/0.12`      | Active menu item                                                                                          | 5.52:1  | 4.5:1  | pass   |
| dark  | `brand-400`      | `gray-900`            | Link                                                                                                      | 6.18:1  | 4.5:1  | pass   |
| dark  | `gray-400`       | `white/0.03`          | Secondary text in card                                                                                    | 6.41:1  | 4.5:1  | pass   |
| dark  | `gray-400`       | `gray-dark`           | Dropdown item                                                                                             | 6.19:1  | 4.5:1  | pass   |
| dark  | `gray-400`       | `gray-800`            | Outline button, avatar fallback icon                                                                      | 5.71:1  | 4.5:1  | pass   |
| dark  | `gray-400`       | `white/0.05`          | Modal close icon                                                                                          | 6.07:1  | 4.5:1  | pass   |
| dark  | `error-400`      | `gray-900`            | Field error message                                                                                       | 6.37:1  | 4.5:1  | pass   |
| dark  | `success-400`    | `gray-900`            | Field success message                                                                                     | 9.28:1  | 4.5:1  | pass   |
| dark  | `success-400`    | `success-500/0.15`    | Light success badge                                                                                       | 7.38:1  | 4.5:1  | pass   |
| dark  | `warning-400`    | `warning-500/0.15`    | Light warning badge                                                                                       | 7.63:1  | 4.5:1  | pass   |
| dark  | `error-400`      | `error-500/0.15`      | Light error badge                                                                                         | 5.54:1  | 4.5:1  | pass   |
| dark  | `blue-light-400` | `blue-light-500/0.15` | Light info badge                                                                                          | 6.73:1  | 4.5:1  | pass   |
| dark  | `brand-400`      | `brand-500/0.15`      | Light primary badge, selected option                                                                      | 5.34:1  | 4.5:1  | pass   |
| dark  | `white/0.8`      | `white/0.05`          | Light "light" badge, solid light badge                                                                    | 10.44:1 | 4.5:1  | pass   |
| dark  | `gray-400`       | `error-500/0.15`      | Alert message (lowest: warning tint below)                                                                | 6.00:1  | 4.5:1  | pass   |
| dark  | `gray-400`       | `warning-500/0.15`    | Alert message                                                                                             | 5.45:1  | 4.5:1  | pass   |
| dark  | `white/0.9`      | `gray-800`            | Tooltip                                                                                                   | 12.16:1 | 4.5:1  | pass   |
| dark  | `gray-500`       | `gray-900`            | Input, checkbox border; toggle off track                                                                  | 3.57:1  | 3:1    | pass   |
| dark  | `gray-500`       | `white/0.03`          | Input border inside a card                                                                                | 3.32:1  | 3:1    | pass   |
| dark  | `brand-500`      | `gray-900`            | Toggle on track                                                                                           | 3.67:1  | 3:1    | pass   |
| dark  | `brand-400`      | `gray-900`            | Focus outline, input focus border                                                                         | 6.18:1  | 3:1    | pass   |
| dark  | `brand-400`      | `gray-800`            | Focus outline on gray-800                                                                                 | 5.12:1  | 3:1    | pass   |
| dark  | `error-400`      | `gray-900`            | Invalid input border, error focus outline                                                                 | 6.37:1  | 3:1    | pass   |
| dark  | `success-400`    | `gray-900`            | Valid input border                                                                                        | 9.28:1  | 3:1    | pass   |
| dark  | `white/0.9`      | `gray-dark`           | Popover titles: calendar heading, user popover name (013)                                                 | 13.11:1 | 4.5:1  | pass   |
| dark  | `gray-300`       | `gray-dark`           | Calendar day (013)                                                                                        | 10.81:1 | 4.5:1  | pass   |
| dark  | `brand-400`      | `gray-dark`           | Calendar today, user popover link (013)                                                                   | 5.55:1  | 4.5:1  | pass   |
| dark  | `brand-400`      | `brand-500/0.15`      | Selected icon in the icon picker, over `gray-dark` (013)                                                  | 4.79:1  | 4.5:1  | pass   |
| dark  | `gray-400`       | `brand-500/0.12`      | Upload dropzone text while dragging (013)                                                                 | 6.15:1  | 4.5:1  | pass   |
| dark  | `white/0.9`      | `error-500/0.15`      | ValidationErrors field name (013)                                                                         | 12.73:1 | 4.5:1  | pass   |
| dark  | `warning-400`    | `gray-900`            | Soft-length counter (013); rating star (3:1 use)                                                          | 9.64:1  | 4.5:1  | pass   |
| dark  | `gray-300`       | `white/0.1`           | Chip delete button hover (013)                                                                            | 9.09:1  | 4.5:1  | pass   |
| dark  | `gray-500`       | `gray-dark`           | Input border inside a popover (013)                                                                       | 3.21:1  | 3:1    | pass   |
| dark  | `white/0.9`      | `brand-500/0.15`      | Radio "other" row selected (013)                                                                          | 12.63:1 | 4.5:1  | pass   |
| dark  | `white/0.9`      | `white/0.05`          | Radio "other" text not selected (013)                                                                     | 12.87:1 | 4.5:1  | pass   |
| dark  | `gray-300`       | `white/0.05`          | Calendar day hovered, over `gray-dark` (013)                                                              | 9.37:1  | 4.5:1  | pass   |
| dark  | `brand-400`      | `white/0.05`          | Calendar today hovered, over `gray-dark`; progress bar on its track (3:1 use; over `gray-900` 5.44) (013) | 4.81:1  | 4.5:1  | pass   |
| dark  | `brand-300`      | `white/0.05`          | Fill-template button hovered (013)                                                                        | 8.04:1  | 4.5:1  | pass   |
| dark  | `error-400`      | `white/0.05`          | Remove button icon hovered (013)                                                                          | 5.61:1  | 3:1    | pass   |
| dark  | `error-400`      | `white/0.03`          | Deleted row text in a relational list (013)                                                               | 5.92:1  | 4.5:1  | pass   |
| dark  | `error-400`      | `gray-dark`           | User popover error (013)                                                                                  | 5.72:1  | 4.5:1  | pass   |
| dark  | `brand-400`      | `white/0.03`          | CodeMirror keyword on the active line (013; lowest syntax color, on `gray-900` 6.18)                      | 5.75:1  | 4.5:1  | pass   |
| dark  | `blue-light-400` | `gray-900`            | CodeMirror atom / def (013; active line 7.85)                                                             | 8.44:1  | 4.5:1  | pass   |
| dark  | `orange-400`     | `gray-900`            | CodeMirror property (013; active line 6.75)                                                               | 7.26:1  | 4.5:1  | pass   |
| dark  | `white/0.9`      | `gray-700`            | CodeMirror selected text (013)                                                                            | 8.84:1  | 4.5:1  | pass   |
| dark  | `gray-400`       | `white/0.05`          | Markdown edit / preview toggle idle, over the toolbar `white/0.03` (013)                                  | 5.58:1  | 4.5:1  | pass   |
| dark  | `brand-400`      | `brand-500/0.15`      | Map control pressed, over `gray-800` (013, icon)                                                          | 4.43:1  | 3:1    | pass   |
| dark  | `brand-400`      | `gray-800`            | Slider range on its track (013)                                                                           | 5.12:1  | 3:1    | pass   |
| dark  | `error-500`      | `white/0.05`          | Translations display progress up to 33 %, over `gray-dark` (013)                                          | 3.68:1  | 3:1    | pass   |
| dark  | `warning-500`    | `white/0.05`          | Translations display progress 34–66 %, over `gray-dark` (013)                                             | 5.89:1  | 3:1    | pass   |
| dark  | `success-500`    | `white/0.05`          | Translations display progress above 66 %, over `gray-dark` (013)                                          | 5.27:1  | 3:1    | pass   |
| dark  | `warning-500`    | `gray-900`            | `input` / `input-multiline` counter under 10 % left (013)                                                 | 7.56:1  | 4.5:1  | pass   |

TailAdmin values replaced because they failed: placeholder gray-400 (2.58) / white/30 (2.70); field error-500 (3.76) and
success-500 (2.62) text; light badge text -500/-600 (2.59–4.44); active menu brand-500 on brand-50 (4.34); dark
error-500 on its tint (4.11); white on success-500, warning-500, blue-light-500, gray-400, error-500 (2.35–3.76); input
border gray-300 (1.47) and dark gray-700 (1.70); toggle off track gray-200 (1.24); "MENU" label gray-400 (2.58); modal
close icon gray-400 on gray-100. Card and table borders (gray-200 / gray-800) are decorative and keep the TailAdmin
values.

Rows marked "013" come from the Tier 3 draft recipes (`component-specs.md`, "Tier 3 recipes, 013, duyệt 2026-10-15") and
the form/drawer draft (`layout-patterns.md` §8), checked against the components as built (T098) and computed from
`tokens/theme.css` the same way (sRGB, alpha composited on the stated background). Colors that come from data (choice
colors, chip colors, color values) are not in the table: they are applied as is like Directus (Q-C, accepted axe
exception in `apps/web/src/components/form/a11y.browser.test.ts`). The three "fail" rows are open points of the 013
design review (`specs/013-interfaces-displays/design-review/README.md`): the Directus `colorful` progress colors of the
translations display in light mode, and the `warning-600` counter text of `input` / `input-multiline`, which differs
from the recipe (`warning-700`). Avoided in those drafts because they fail: `gray-500` on `brand-50` (4.46:1, so
selected table rows use `gray-50` and the dropzone hint turns `gray-700` while dragging); `gray-500` text on `gray-dark`
(3.21:1, so dark calendar days use `gray-300` / `gray-400`); the `warning-500` edited dot of research R6 (the Directus
subdued `gray-500` / dark `gray-400` dot is used).

## Decisions (project owner, 2026-10-15)

| #     | Question                                      | Decision                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1   | TailAdmin text pairs below 4.5:1              | Use the passing theme substitutes everywhere (table above): placeholder gray-500 / dark gray-400; field error text error-600 / dark error-400; light badges -700 text on -50 (brand-600), dark -400 on -500/15; solid status badges/buttons only on backgrounds that reach 4.5:1 with white (brand-500, success-700, warning-700, error-600, blue-light-700, gray-500, gray-700); active menu brand-600 on brand-50 |
| C-2   | Input boundary below 3:1                      | Inputs, selects, textareas, checkboxes and the toggle off track use gray-500 (4.97:1 on white, 3.57:1 on gray-900, 3.32:1 in a dark card)                                                                                                                                                                                                                                                                           |
| Focus | No focus style in TailAdmin buttons and links | `FOCUS` recipe on every interactive element (brand-500 / dark brand-400 outline, 2px, offset 2px); error controls error-600 / dark error-400                                                                                                                                                                                                                                                                        |
| L-1   | Shell breakpoint                              | `xl` (1280px) as TailAdmin: sidebar inline from `xl`, off-canvas drawer **with** Backdrop below `xl` (fixes TailAdmin's `lg:hidden` gap); sidebar "mobile" state = below 1280px; minimum supported width 768px                                                                                                                                                                                                      |
| L-2   | Sidebar groups                                | One "Menu" group: modules and `module_bar` links (internal and external) in `module_bar` order, Settings last for admins; no "Others" group                                                                                                                                                                                                                                                                         |
| L-3   | Deep navigation                               | One sub-menu level in 012 (the module navigation slot); deeper navigation is decided by each module feature (014+)                                                                                                                                                                                                                                                                                                  |
| L-4   | Right detail panel                            | 333px wide like Directus; inline and open from `xl`; closed by default below `xl` and opened as a drawer with the Backdrop                                                                                                                                                                                                                                                                                          |
| B-1   | Danger button, table row hover                | Danger `bg-error-600 text-white hover:bg-error-700` (4.83:1 / 6.57:1); row hover `hover:bg-gray-50 dark:hover:bg-white/[0.03]`                                                                                                                                                                                                                                                                                      |
| B-2   | Avatar fallback                               | Material Symbols `account_circle` on `bg-gray-100 text-gray-500` / `dark:bg-gray-800 dark:text-gray-400`                                                                                                                                                                                                                                                                                                            |

Changes to `tokens/theme.css` from these decisions: the `menu-*` active classes use `text-brand-600`, `menu-item` and
`menu-dropdown-item` include the focus recipe, and the `menu-dropdown-badge*` utilities ("new"/"pro") were removed. The
`@theme` variables (and `tokens.json`) did not change.
