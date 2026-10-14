# Migration Guide

1. Keep the source Figma library and production UI unchanged.
2. Check the app's package manifest, Tailwind config, global CSS entry and installed Reka UI version.
3. Merge the theme extension into existing `tailwind.config.js`; don't overwrite plugins or presets.
4. Import `tokens.css` once from the global CSS entry.
5. Pilot one low-risk component and compare screenshots.
6. Migrate one component family at a time; do not bulk-replace colors or typography.
7. Add visual regression checks for critical screens.
8. Remove old tokens only after confirming no references remain.

## Decisions requiring approval
- Canonical primary color (`#1890FF` vs `#FF5F52` source values).
- Font family and typography scale.
- Semantic meaning of status colors.
- Canonical radius/control height scale.
- Which dated UI sections remain active.
