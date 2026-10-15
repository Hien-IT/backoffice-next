# Developer handoff checklist (TailAdmin pack)

## Theme

- [ ] `design-system/tokens/theme.css` copied once into the app (`apps/web/src/styles/theme.css`), imported after
      `@import 'tailwindcss';`, not edited in the app.
- [ ] `tokens/tokens.json` matches `theme.css` when the theme changed.
- [ ] Outfit and Noto Sans self-hosted (no Google Fonts request); Vietnamese text renders in Noto Sans, not a system
      font.
- [ ] No raw hex, `rgb()` or arbitrary color values in components; no palette outside the theme (`red-*`, `slate-*`,
      `sky-*` ...).
- [ ] No `dark-900` or other class TailAdmin uses without a theme value.
- [ ] Settings branding: `project_color` only on logo, public/share pages, favicon, meta `theme-color`; theme overrides
      change the mapped variables.

## Layout

- [ ] Shell follows `docs/layout-patterns.md`: sidebar widths 290px / 90px, inline from `xl` (1280px) with
      hover-to-expand when collapsed, off-canvas drawer **with** Backdrop below `xl`, sticky header, content
      `max-w-(--breakpoint-2xl) p-4 md:p-6`; checked at 768px, 1024px, 1279px and 1280px.
- [ ] One "Menu" group: modules and `module_bar` links in `module_bar` order, Settings last for admins; module
      navigation as one sub-menu level; external links open a new tab with a hint.
- [ ] Page header (title, breadcrumb, actions) inside the content; right detail panel 333px, inline and open from `xl`,
      closed drawer with Backdrop below `xl`.
- [ ] No horizontal page scroll from 768px; tables scroll in their own container.

## Components

- [ ] Reka UI primitives used; exports checked against the installed `reka-ui`.
- [ ] Final recipes from `docs/component-specs.md` copied as they are (not the original TailAdmin values), each with its
      `dark:` classes.
- [ ] States covered where relevant: default, hover, focus-visible, active/checked, disabled, invalid, loading, empty.
- [ ] TailAdmin code copied? MIT notice kept at the top of the file.

## Dark mode

- [ ] Every screen checked with `dark` on `<html>` and in light mode; no white flashes, no unreadable text.
- [ ] Appearance follows the Directus user/settings value (light, dark, auto).

## Accessibility

- [ ] Every color pair used by the screen is in the contrast table of `docs/migration-guide.md` (all pass: 4.5:1 text,
      3:1 input boundaries, toggle tracks, meaningful icons and focus); a new pair is added and passes.
- [ ] Keyboard: every action reachable, `FOCUS` recipe on every interactive element, Esc closes menus, drawers and
      dialogs, focus returns to the trigger.
- [ ] Skip link, landmarks, `aria-current="page"` on the active nav item, `aria-expanded` on toggles, labels on
      icon-only buttons.
- [ ] Drawers and dialogs trap focus while open.
- [ ] Labels, hints and errors linked (`for`, `aria-describedby`, `aria-invalid`); status never by color alone.
- [ ] `prefers-reduced-motion` respected for sidebar and sub-menu transitions.

## Attribution and release

- [ ] `design-system/README.md` attribution (TailAdmin MIT, Figma CC BY 4.0 credit, Outfit and Noto Sans OFL) kept; OFL
      text shipped with the fonts.
- [ ] Open questions of the feature listed in its spec, none picked silently.
- [ ] Visual check against TailAdmin reference screens and the Directus flow for the same screen.

## Recorded exceptions

- Image editor (feature 015, FR-111, owner 2026-10-15): dragging the crop box and the focal point is mouse only, as in
  Directus; every toolbar control is reachable by keyboard. axe does not check dragging.
