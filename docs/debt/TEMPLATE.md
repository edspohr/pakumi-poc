# NNNN — <Short title>

| Field         | Value                                              |
| ------------- | -------------------------------------------------- |
| **Status**    | open \| in-progress \| resolved \| wontfix         |
| **Priority**  | high \| medium \| low                              |
| **Detected**  | YYYY-MM-DD                                         |
| **Resolved**  | YYYY-MM-DD (or `—`)                                |
| **Owner**     | Name or `unassigned`                               |
| **Category**  | infra \| backend \| frontend \| data \| ops \| security \| product |

## Context

What is true today that creates this debt? Describe the current state of the
code, infrastructure, or process — enough that someone unfamiliar with the
repo can understand the situation without reading the codebase. Avoid
prescriptions here; this section is descriptive.

## Impact

What hurts because this debt exists? Be concrete: who is affected, when does
the pain show up, and how bad is it today vs. how bad it could become if left
unaddressed. If the debt is currently dormant ("doesn't bite us yet"), say so
explicitly and name the trigger that would activate it.

## Current workaround

What we do today to live with the debt. If there is no workaround (the debt
is simply tolerated), write "None — tolerated for the POC phase" or similar.

## Proposed fix

The shape of the resolution. This is not a final design — it is enough
direction that whoever picks the item up knows where to start. Include rough
effort estimate if known (S / M / L), and any precondition that must be true
before work can begin (e.g. "blocked on …").

## References

- Related ADRs: `docs/decisions/ADR-NNN-…md`
- Related code: `path/to/file.ts:LL`
- Related issues / tickets: `…`
- External docs / runbooks: `…`

## History

- **YYYY-MM-DD** — Detected by `<name>`. Initial entry.
- **YYYY-MM-DD** — Status change / re-prioritization / new context. One line.
- **YYYY-MM-DD** — Resolved by `<commit-sha or PR>`. Brief note on how.
