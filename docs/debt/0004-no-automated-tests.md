# 0004 — No automated tests

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | medium                             |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | unassigned                         |
| **Category**  | ops                                |

## Context

The repo has **zero unit, integration, or end-to-end tests**. There is no
test runner configured in `web/` or `functions/`, no CI workflow, and no
lint config. Verification today is entirely manual: developers run
`firebase emulators:start` and/or deploy to `pakumi-poc.web.app` and
exercise flows by hand.

This is intentional for the POC phase per `CLAUDE.md` ("No test suite, no
lint config, no CI. Don't add them unless asked.") — speed over polish — but
it is debt and is recorded here so it does not become invisible.

## Impact

- **Regression risk grows with codebase size.** Today the surface is small
  enough to manually exercise in a few minutes. Each new flow adds linear
  manual cost and increases the chance of an unnoticed regression.
- **Refactors are scary.** Anything touching `lib/firestore.ts`, the
  two-collection emergency pattern, or the WhatsApp webhook has no safety
  net beyond the developer's discipline.
- **Onboarding friction.** A new contributor has no test suite to read for
  expected behavior; they must reverse-engineer it from the code.

Currently low-cost to live with; cost rises with every shipped feature.

## Current workaround

Manual testing against the deployed environment (`pakumi-poc.web.app`) and
the Firebase emulator suite. TypeScript on the `web/` side catches a class of
errors that would otherwise need tests.

## Proposed fix

Staged introduction, in priority order:

1. **Functions-side integration tests** for the WhatsApp webhook against the
   Firestore emulator — this is the riskiest surface (third-party callers,
   external API, data writes) and the smallest test setup.
2. **`web/` unit tests** for `lib/firestore.ts` helpers and any non-trivial
   pure logic. Vitest fits cleanly into the Vite stack.
3. **Smoke / E2E** (Playwright) covering register → dashboard → emergency
   page. Runs against the emulator suite.
4. **CI workflow** (GitHub Actions) running typecheck + tests on PR.

Effort: **M** for stages 1–2, **M–L** for stages 3–4.

**Trigger to start:** first regression that costs more than an hour to
diagnose, or the moment we add a second engineer to the codebase, whichever
comes first.

## References

- `CLAUDE.md` — explicit "no tests" guidance for the POC phase
- Code: `functions/index.js`, `web/src/lib/firestore.ts`

## History

- **2026-04-25** — Detected by Edmundo Spohr. Registered for visibility;
  intentionally deferred per POC `CLAUDE.md` guidance.
