# Backoffice design system (TailAdmin based)

Visual source of truth for `apps/web` (constitution principle XII, version 2.0.0). It is built on
[TailAdmin Vue](https://github.com/TailAdmin/vue-tailwind-admin-dashboard) (free edition, MIT, version 2.4.0, read from
`main` at commit `6d5a365`). The project owner chose TailAdmin on 2026-10-15 to replace the previous E-Hiring pack, and
the theme names are TailAdmin's own (`brand-*`, `gray-*`, `success-*`, ...).

Screen flows, routes and behaviour stay those of the Directus app (principle VI). This pack decides the look and the app
shell layout (sidebar, header, content, detail panel).

## Files

| File                                                       | Content                                                                                                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens/theme.css`                                         | The Tailwind 4 theme: `@custom-variant dark`, `@theme` (colors, font, text sizes, shadows, z-index, breakpoints), base layer, `menu-*`, `no-scrollbar` and `custom-scrollbar` utilities |
| `tokens/tokens.json`                                       | Machine-readable list of the `@theme` variables (name → value), generated from `theme.css`                                                                                              |
| `docs/layout-patterns.md`                                  | The TailAdmin app shell and how the Directus app maps onto it                                                                                                                           |
| `docs/component-specs.md`                                  | Component conventions, tiers and the TailAdmin class recipe for each Tier 1 component                                                                                                   |
| `docs/migration-guide.md`                                  | E-Hiring → TailAdmin mapping, dark mode pattern, contrast table, owner decisions                                                                                                        |
| `qa/handoff-checklist.md`                                  | Checklist for every FE change                                                                                                                                                           |
| `components/StatusBadge.vue`, `components/SelectField.vue` | Examples only (Reka UI + TailAdmin classes), not production code                                                                                                                        |
| `LICENSE-TailAdmin.md`                                     | TailAdmin MIT license text                                                                                                                                                              |

## Use with Tailwind 4

1. Copy `tokens/theme.css` once into the app (`apps/web/src/styles/theme.css`) and import it right after
   `@import 'tailwindcss';`. Do not edit the copy: change `design-system/tokens/theme.css` (and `tokens.json`) first,
   then copy again.
2. Self-host the fonts: Outfit (variable, weights 100–900) and Noto Sans (for Vietnamese, which Outfit does not cover)
   as woff2 files with `@font-face` in the app. `theme.css` has no Google Fonts `@import`.
3. Dark mode is the `dark` class on `<html>`; every component carries its `dark:` classes (see the migration guide).
4. Settings branding layers on top as in Directus (`directus/app/src/app.vue`): `project_color` drives only
   `--project-color` (logo, public and share pages, favicon, meta `theme-color`); `theme_light_overrides` /
   `theme_dark_overrides` override the mapped theme variables (for example `primary` → `--color-brand-500`).

## Rules

- Colors, font, text sizes, shadows, z-index and breakpoints come only from the theme. No raw hex, `rgb()` or arbitrary
  color values in components, and no Tailwind palette outside the theme (`red-*`, `slate-*`, `sky-*` ... do not exist
  after `--color-*: initial`). Opacity modifiers on theme colors (`bg-brand-500/15`, `dark:text-white/90`) are fine:
  TailAdmin uses them.
- Spacing and radius use the Tailwind default scale, as TailAdmin does (`rounded-lg`, `rounded-xl`, `rounded-2xl`,
  `p-4`, `md:p-6`, ...).
- Never redefine a Tailwind utility (`.sr-only`, `.hidden`, ...) in the app CSS: a copy in `@layer utilities` comes
  after Tailwind's and beats its variants (`sm:not-sr-only`); an unlayered copy beats every utility.
- Interactive components use Reka UI primitives and follow `docs/component-specs.md` (states, keyboard, linked labels,
  status never by color alone).
- TailAdmin code is a reference only. When a substantial part of a TailAdmin file is copied, keep the MIT notice
  (copyright line and permission notice from `LICENSE-TailAdmin.md`) in a comment at the top of that file.
- What this pack does not cover (CMS screens with no TailAdmin pattern, for example) is an open question in the feature
  spec. Do not pick silently.

## Attribution

- **TailAdmin Vue** code and theme: MIT License, Copyright (c) 2026 TailAdmin. See `LICENSE-TailAdmin.md`.
- **TailAdmin Figma file**:
  [Figma Community file 1463141366275764364](https://www.figma.com/community/file/1463141366275764364). Free Figma
  Community files are published under CC BY 4.0 (Figma help center), so the creator (TailAdmin) must be credited
  wherever designs derived from the file are shared. This section is that credit; keep it.
- **Outfit** font: SIL Open Font License 1.1. **Noto Sans** (fallback for Vietnamese): SIL Open Font License 1.1. Ship
  the OFL text next to the self-hosted font files.
