# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.4.0). Mark PASS, or VIOLATION with
a row in Complexity Tracking.

- [ ] I. No file under `directus/` changed; ported files name their source path in a header comment
- [ ] II. No DDL on `directus_*` base tables/columns outside the ported Directus 11.17.4 seeds/migrations
  (`bootstrap`/`migrate` on Postgres and SQLite, 3.0.0); no Backoffice-only system table, column or migration (user
  columns and `is_indexed` on system columns allowed, as Directus does) except Backoffice migrations (3.2.0): tracked in
  system table `backoffice_migrations`, never in `directus_migrations`; only `backoffice_*` tables, `bo_*` columns on
  `directus_*` and their `directus_fields` rows; `up` only, Knex, 7 vendors, re-runnable; run by `bootstrap` on every
  vendor after the Directus migrations; checked at start; written data matches Directus format (except UUID v7 for
  `uuid` specials of user collections, system collections keep v4, 3.4.0); the DB stays usable by Directus 11.17.4 with
  no new file or config
- [ ] III. REST/GraphQL path, query, response, error, status, header, cookie identical to Directus
- [ ] IV. Shared SECRET/JWT/Redis keys; no critical in-process state; scheduled flows use Redis lock
- [ ] V. Parity tests (Directus vs new app) planned for every endpoint added or changed
- [ ] VI. Nx layout, NestJS provider per Directus service, Knex (no ORM), Vue 3 Composition API
- [ ] VII. Multi-instance safe: runtime FE config, shared storage (files and extensions), read-only startup (except new
  `directus_extensions` rows, 2.2.0, and `bootstrap`, 3.0.0: in standalone mode with several replicas run once by a Helm
  Job or compose one-shot service; in shared mode each replica starts like a Directus container; Backoffice migrations
  under a shared Redis lock, 3.2.0), graceful SIGTERM; in-process caches only if rebuilt from DB/Redis and cleared via
  the Redis bus on every instance; next to Directus, Backoffice on its own domain and its API pool holds only BE
  replicas, Directus never in it (3.3.0)
- [ ] VIII. Only Directus env vars (same names/defaults); new ones prefixed `BACKOFFICE_` with safe default; next to
  Directus only `PUBLIC_URL` is set apart for Backoffice (3.3.0)
- [ ] IX. Rebranding limited to allowed surfaces; compatibility identifiers kept
- [ ] X. Coverage, perf (≤10% vs Directus), logging/metrics, no email sending, deviations in spec
- [ ] XI. Nothing out of scope (SAML, non-S3 storage, websockets, theme extensions, AI/MCP...)
- [ ] XII. (FE only) Read `design-system/` docs (TailAdmin based); theme names (`brand-*`, `gray-*`...) via Tailwind 4
  `@theme`, no raw hex or palette outside the theme; app shell per `docs/layout-patterns.md`; component-specs
  conventions (Reka UI, states, keyboard, linked labels); gaps listed as open questions in the spec; settings
  branding (project_color, theme overrides) layered on the theme as in Directus

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
