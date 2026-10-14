# E-Hiring Design System Audit — Initial Findings

**Status:** Metadata-based initial audit, not a complete pixel-by-pixel review. Stack: Vue 3 + Reka UI + Tailwind CSS v3.

## Observed structure
- Initial sidebar screenshot showed 12 pages; accessible metadata currently exposes Prototype, Style Guide, Components, UI and Draft. Reconcile page count/source of truth before declaring inventory complete.
- Components page extraction showed 37 sections, 108 frame nodes, 23 instance nodes and 373 symbol nodes in that response. These are structural node counts, not unique component counts.
- UI page contains many dated update sections. Identify active vs archived screens before migration.
- Inspected patterns include status/select, PATD Select, Website Config Select and Talent Profile.

## Findings
### F-01 — Token naming inconsistency (P1 proposal)
Evidence: `Primary/1`, `primary/d400`, `Neutral/Black`, `secondary/d200`. Introduce normalized primitives and semantic aliases separately; don't rename source variables before dependency checks.

### F-02 — Conflicting primary values (P1 proposal)
Evidence: `Primary/1` = `#1890FF`; `Primary/Primary Color` = `#FF5F52`. Product/design must decide canonical color and whether coral is legacy or a separate theme. No mass migration yet.

### F-03 — Typography inconsistency (P1 proposal)
Evidence: body variables use Open Sans, title styles use Noto Sans, a button token uses Roboto, and a label mentions Manrope. Some line-height/letter-spacing values require unit/render validation. Establish semantic roles and a verified type scale.

### F-04 — Status variants can be normalized carefully (P1 proposal)
Evidence: `Kanban & Table status select` exposes `state` values `Ended`, `Not start`, `Paused`, `Scheduled`, `Started` and `propFunction` values `Select` / `View`. Map colors to semantic tokens; share base only where meaning and behavior match.

### F-05 — Domain Selects mix primitives and product patterns (P2 proposal)
PATD Select and Website Config Select include domain-specific content and fixed dimensions. Separate generic Select behavior from product layouts.

### F-06 — Historical UI needs triage (P2 proposal)
UI contains dated updates from 2024–2025. Label current, superseded and archived sections before refactoring.

### F-07 — Reuse status is not fully verified (pending)
Many instances and nested frames exist, but not every main-component relationship or detached instance has been verified.

## Limitations
This is based on accessible metadata and selected design-context extractions. Full screen inventory, variables usage, prototype flows, detached-instance status and page count remain to be verified. Priority labels are proposed audit priorities, not confirmed production incidents.
