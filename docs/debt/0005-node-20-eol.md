# 0005 — Node 20 EOL on Cloud Functions

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | medium                             |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | unassigned                         |
| **Category**  | infra                              |

## Context

`functions/package.json` declares `"engines": { "node": "20" }`, which is
also what the deployed Cloud Functions runtime will use. **Node 20 reaches
end-of-life in October 2026.** After that, Google Cloud Functions will stop
accepting new deploys on Node 20 and may eventually retire existing
deployments.

Separately, `firebase-functions` is on a major version that is
compatibility-locked with the Node 20 runtime. Migrating runtime requires
migrating the SDK to a current major (v6 or later as of writing) at the same
time, which has its own breaking changes.

There is also a known dev-environment mismatch documented in `CLAUDE.md`:
the dev machine runs Node 22 while the engine field declares Node 20,
producing an `EBADENGINE` warning on `npm install`. That mismatch must be
reconciled deliberately — not silently bumped — when this debt is addressed.

## Impact

- **Hard deadline.** Unlike most debt, this one has a calendar date attached:
  **October 2026**. After EOL, deploys break.
- **Coupled migration.** Cannot be done as a pure runtime bump; the
  `firebase-functions` SDK upgrade is part of the same change and brings
  breaking API changes that touch every function definition.
- **Currently dormant.** No production pressure today; the cost is purely
  the deadline.

## Current workaround

None needed today. The runtime works; the deadline is months away.

## Proposed fix

1. Bump `functions/package.json` `engines.node` from `"20"` to `"22"`.
2. Upgrade `firebase-functions` to v6 (or whatever the current major is at
   migration time) and `firebase-admin` to a compatible version.
3. Adjust the function definitions in `functions/index.js` for any v6
   breaking changes (mainly initialization and trigger declarations).
4. Re-test the WhatsApp webhook end-to-end against the emulator and a
   sandbox deploy before promoting to `pakumi-poc`.
5. Decide locally: `nvm use 22` everywhere, removing the existing
   `EBADENGINE` mismatch noted in `CLAUDE.md`.

Effort: **S–M**.

**Trigger to start:** target completion **no later than September 2026** to
leave a one-month buffer before the Node 20 EOL date.

## References

- `CLAUDE.md` — "Node version mismatch (known)" section
- Code: `functions/package.json`, `functions/index.js`
- Node.js LTS schedule (Node 20 EOL: 2026-10)

## History

- **2026-04-25** — Detected by Edmundo Spohr. Registered with explicit
  October 2026 deadline.
