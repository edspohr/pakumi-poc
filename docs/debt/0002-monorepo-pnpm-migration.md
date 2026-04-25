# 0002 — Monorepo / pnpm workspaces migration

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | low                                |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | unassigned                         |
| **Category**  | infra                              |

## Context

The repo is a **single-package layout** with two independent npm projects
side-by-side: `web/` (React 19 + TS + Vite) and `functions/` (Node JS Cloud
Functions). Each has its own `package.json`, `node_modules/`, and lockfile.
There is no workspace tool tying them together.

The reference pattern from ConectApp uses **pnpm workspaces** with
`shared/`, `functions/`, and `web/` packages, allowing shared TypeScript
types (e.g. domain models) to live in one place and be imported by both the
frontend and the backend.

Today we have one such candidate for sharing: the `Pet` and
`EmergencyProfile` interfaces in `web/src/types/index.ts`. The Cloud
Function reads/writes the same Firestore documents but without typed access.

## Impact

Currently dormant. Pain shows up when:

- A shared type (e.g. `Pet`) drifts between `web/` and `functions/` and a
  silent data-shape mismatch breaks WhatsApp replies or dashboard rendering.
- We add a second backend surface (additional functions, jobs, etc.) that
  also needs typed access to the same Firestore shapes.
- We want a single `pnpm install` at the root instead of remembering to run
  it in two places.

Until any of those happens, the cost of duplication is low.

## Current workaround

`Pet` and `EmergencyProfile` are defined in `web/src/types/index.ts` and the
Cloud Function operates on plain objects (no shared type). Firestore rules
and the two-collection pattern (`pets/` vs `emergency_profiles/`) are the
real safety net for shape integrity, not the type system.

## Proposed fix

1. Introduce pnpm at the repo root with `pnpm-workspace.yaml`.
2. Create `shared/` package containing the domain types and any pure
   helpers (e.g. emergency-profile field whitelist).
3. Convert `web/` and `functions/` to workspace members; update their
   `package.json` files to depend on `shared` via the workspace protocol.
4. Migrate `functions/` to TypeScript at the same time, or stage that as a
   follow-up — the value of shared types only fully lands once `functions/`
   can consume them.
5. Update CI / deploy scripts and `firebase.json` `predeploy` hooks to use
   pnpm.

Effort: **M**. Mostly mechanical, but touches every dependency-related file
and the deploy flow.

**Trigger to start:** first incident caused by drift between the two type
definitions, or the moment `functions/` is migrated to TypeScript. Estimated
**Sprint 4+**, after the 8-week POC scope is past.

## References

- ADR: [`docs/decisions/ADR-001-pakumi-platform.md`](../decisions/ADR-001-pakumi-platform.md) — alternatives section
- Code: `web/src/types/index.ts`, `functions/index.js`

## History

- **2026-04-25** — Detected by Edmundo Spohr. Registered as debt at the same
  time as ADR-001 was accepted.
