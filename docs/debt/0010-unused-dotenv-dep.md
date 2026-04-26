# 0010 — Unused `dotenv` dependency in `functions/`

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | low                                |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | Edmundo Spohr                      |
| **Category**  | maintenance / cleanup              |

## Context

The `dotenv` npm package was a runtime dependency of `functions/` and
backed a small lazy loader (`ensureEnv()`) that read `functions/.env` on
the first invocation needing config or secrets.

During the migration to **`firebase-functions/params`** (commit pending —
see history below), `ensureEnv()` and both `process.env.*` reads were
removed. The params package reads `functions/.env` natively in
firebase-functions v4.3+ (we are on v6.6.0), so `dotenv` is no longer
needed at all.

The dependency was intentionally **left installed** in
`functions/package.json` to keep the migration commit's diff focused —
removing the package would have meant an additional churn line in
`package.json` and a `package-lock.json` change unrelated to the params
migration.

## Impact

Minor. The dependency:

- Adds a few KB to the deployment package.
- Adds a small amount of install time (`npm install` in `functions/`).
- Has no functional effect (the require call site was removed).
- Has no security risk (`dotenv` is widely used and well-maintained; even
  if compromised, our code never imports it post-migration).

This is pure cleanup, not a fix for any active problem.

## Current workaround

Leave the dependency installed. It is inert.

## Proposed fix

```bash
cd functions
npm uninstall dotenv
```

Then verify nothing references it:

```bash
grep -rn "dotenv" functions/ --include="*.js" | grep -v node_modules
```

Should produce no results. Commit the resulting `package.json` and
`package-lock.json` changes as a single-line dependency removal.

Effort: **S** (≈5 minutes).

**Trigger to start:** any future `functions/` cleanup pass, or simply
"next time someone is editing `functions/package.json` for another
reason."

## References

- See the commit migrating to `firebase-functions/params` for the change
  that made this dependency redundant.
- Code: `functions/package.json` (the dependency to remove); confirmed no
  remaining references in `functions/index.js`.

## History

- **2026-04-25** — Created during params migration cleanup by Edmundo
  Spohr. Recorded as deferred follow-up so the inert dependency does not
  sit unnoticed indefinitely.
