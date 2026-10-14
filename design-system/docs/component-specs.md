# Component Specifications — Vue 3 + Reka UI + Tailwind v3

## Conventions
- Vue 3 SFC with `<script setup lang="ts">`.
- Use Reka UI for accessible interactive primitives when appropriate.
- Use Tailwind for layout/states; reference CSS variables for visual tokens.
- Keep domain patterns separate from generic controls.
- Prefer `modelValue` / `update:modelValue` for controlled form components.
- Define focus-visible, disabled, invalid, loading and empty states as applicable.

## Component tiers
**Tier 1:** Button, Input, Select, Checkbox, Radio, Switch, Tag/Badge, Tooltip, Popover, Dialog, Table, Pagination.
**Tier 2:** FilterBar, DataTable patterns, Header/Navigation, Card/MetricCard, Stepper/Progress, Upload.
**Tier 3:** PATD Select/steps, Talent Profile, Talent Pool Card, recruitment/interview statuses, Website Config Select, Campaign components.

## Example StatusBadge API
- `status`: `neutral | success | warning | danger | info` (default `neutral`)
- `size`: `sm | md` (default `md`)
- Default slot contains the visible label.
- Do not convey status through color alone.

## Example SelectField API
- `modelValue?: string`
- `options: { label: string; value: string }[]`
- `placeholder?: string`
- `disabled?: boolean`
- Emits `update:modelValue`.
- Verify Reka UI exports against the installed package/version.

## Acceptance criteria
- Component classes use semantic tokens rather than raw hex values.
- Keyboard interaction and focus visibility work.
- Labels and errors are programmatically associated.
- Empty, disabled and error states are documented.
- Approved Figma frames are used for visual QA.
