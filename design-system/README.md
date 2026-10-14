# E-Hiring Design System — Vue 3 + Reka UI + Tailwind CSS v3

Starter handoff pack based on accessible Figma metadata. It is a proposal, not an approved replacement for the existing library.

## Files
- `tokens/tokens.json`: source observations separated from proposed tokens
- `tokens/tokens.css`: CSS custom properties
- `tailwind.config.js`: Tailwind v3 theme mapping
- `styles/index.css`: base CSS
- `components/StatusBadge.vue`: example status component
- `components/SelectField.vue`: example Reka UI Select wrapper
- `docs/audit-report.md`: current findings and limitations
- `docs/component-specs.md`: component conventions
- `docs/migration-guide.md`: safe adoption
- `qa/handoff-checklist.md`: implementation checklist

Merge the Tailwind config into the existing app config; do not overwrite existing plugins or settings. Verify Reka UI imports against the installed version. No changes have been made to the source Figma file.
