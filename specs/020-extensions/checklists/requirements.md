# Specification Quality Checklist: Extensions (020)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- The feature is compatibility with Directus extensions, so the user's own words name the Directus files, env variables,
  bus channel, lock names, isolated-vm, `v-*` components and injects; these are the contract to match (Constitution I,
  III), not implementation choices, as in specs 001–019. Choices left to the plan: Express 4 compatibility for endpoint
  and `init` hooks, how the API learns the web shared-dep chunk paths, machine-id lock in containers, shim structure.
- Resolved with the owner 2026-10-21 (spec Clarifications): FR-014 embed not applied on the new web app (D-138); FR-047
  lb and Ingress send `/extensions/sources/*` to Backoffice replicas only; FR-081 axios 1.15.0 for `useApi()`, owner
  approved the change to the 012 "SDK only" decision.
- Gate done 2026-10-21: constitution 2.1.0 (XI keeps only theme extensions out of scope; VII covers extensions on
  several instances).
- `/speckit.clarify` 2026-10-21, 5 questions: FR-019/D-139 (Express 5 configured like Express 4), FR-062/D-140 (API build
  embeds the web chunk manifest, same commit), FR-001 (`module` source in scope), FR-060 (bundle built per node in
  process), Assumptions (three implementation waves, registry install opens in wave 3). Re-validated: all items pass.
- Shell details from the 2026-10-21 owner UI changes (D-127, D-128, D-130) taken into FR-072 and FR-074 (handoff from
  the session that pushed c6fe4907, 00d7c0e5).
- Release-gate CHK001–CHK059 (2026-10-21) applied in full (owner; CHK013 option a): see `release-gate.md`; requirements
  checklist re-validated, all items still pass.
