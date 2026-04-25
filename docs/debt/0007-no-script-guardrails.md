# 0007 — No script guardrails against prod

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | resolved                           |
| **Priority**  | medium                             |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | 2026-04-25                         |
| **Owner**     | Edmundo Spohr                      |
| **Category**  | ops                                |

## Context

Operations / maintenance scripts (data backfills, Firestore wipes,
re-seeding, etc.) had **no guardrail to confirm the targeted Firebase
project before performing destructive operations**. A script run with the
wrong `firebase use` context — or with an explicit project flag pointing at
the wrong environment — would happily delete or overwrite data in the
unintended project.

Given that `pakumi-poc` is the only project today, the immediate blast
radius was small, but the same scripts will be reused as soon as a
`pakumi-prod` (or equivalent) project exists.

## Impact

- **Risk of irreversible data loss** in production once a second project
  exists.
- **Cognitive load on the operator** — relying on always-correct
  `firebase use` state is fragile, especially for someone juggling multiple
  Firebase projects across clients.

The risk was latent (no prod environment yet) but the cost of fixing it
once was much lower than the cost of one mistake later.

## Current workaround

N/A — resolved.

## Proposed fix

(Already applied — kept for the audit trail.)

Add a **project-ID verification check** to every destructive operations
script: before any write/delete, the script reads the active Firebase
project (or an explicitly passed `--project` flag) and aborts unless it
matches an allow-list appropriate to that script. Production-targeted
operations additionally require an interactive `yes/no` confirmation that
echoes the project ID being targeted.

## References

- ADR: [`docs/decisions/ADR-001-pakumi-platform.md`](../decisions/ADR-001-pakumi-platform.md) — operational posture
- Related debt: this is the kind of guardrail that the (deferred) test /
  CI work in [0004 — No automated tests](./0004-no-automated-tests.md)
  would also help with.

## History

- **2026-04-25** — Detected and resolved by Edmundo Spohr the same day.
  Added project-ID verification to all destructive operations scripts; entry
  retained in the register as audit trail.
