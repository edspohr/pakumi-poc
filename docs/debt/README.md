# Technical Debt Register

This directory tracks known technical debt for **Pakumi**. Each item lives in
its own numbered file so the history of a single piece of debt is auditable
in `git log` without digging through a monolithic document.

## Conventions

- **Filename:** `NNNN-short-kebab-title.md` (zero-padded four-digit ID).
- **IDs are sequential and never reused.** The next item is the next free
  number, regardless of which items are open or resolved.
- **Resolved items keep their file** (status flipped to `resolved`, with a
  resolution date and a `History` entry). Do not delete — the audit trail
  matters more than a tidy directory.
- **Use `TEMPLATE.md`** as the starting point for any new entry. Keep the
  structure stable so the index below stays scannable.
- **Update this README's index** whenever an item is added, resolved, or
  re-prioritized.

## Status legend

- `open` — known, not yet being worked on.
- `in-progress` — actively being addressed.
- `resolved` — fixed; kept for audit trail.
- `wontfix` — explicitly accepted as permanent. Rare; needs justification in the file.

## Priority legend

- `high` — actively biting us, blocking a milestone, or carrying material risk.
- `medium` — will bite us soon or under foreseeable conditions.
- `low` — known sub-optimality with no near-term trigger.

## Index

| ID   | Title                                                           | Status   | Priority | Detected   | Resolved   | Owner       | Category |
| ---- | --------------------------------------------------------------- | -------- | -------- | ---------- | ---------- | ----------- | -------- |
| 0001 | [Vertex AI migration](./0001-vertex-ai-migration.md)            | open     | medium   | 2026-04-25 | —          | unassigned  | backend  |
| 0002 | [Monorepo / pnpm workspaces migration](./0002-monorepo-pnpm-migration.md) | open     | low      | 2026-04-25 | —          | unassigned  | infra    |
| 0003 | [Rich pet profile schema](./0003-rich-pet-profile-schema.md)    | open     | high     | 2026-04-25 | —          | unassigned  | data     |
| 0004 | [No automated tests](./0004-no-automated-tests.md)              | open     | medium   | 2026-04-25 | —          | unassigned  | ops      |
| 0005 | [Node 20 EOL on Cloud Functions](./0005-node-20-eol.md)         | open     | medium   | 2026-04-25 | —          | unassigned  | infra    |
| 0006 | [Twilio Sandbox only](./0006-twilio-sandbox-only.md)            | open     | high     | 2026-04-25 | —          | unassigned  | product  |
| 0007 | [No script guardrails against prod](./0007-no-script-guardrails.md) | resolved | medium   | 2026-04-25 | 2026-04-25 | Edmundo Spohr | ops    |
| 0008 | [Emergency templates clinical validation](./0008-emergency-templates-clinical-validation.md) | open     | high     | 2026-04-25 | —          | Edmundo Spohr + clinical partner (TBD) | safety |
| 0009 | [Fallback message recovery](./0009-fallback-message-recovery.md) | open     | medium   | 2026-04-25 | —          | unassigned  | backend  |
| 0010 | [Unused dotenv dependency](./0010-unused-dotenv-dep.md)         | open     | low      | 2026-04-25 | —          | Edmundo Spohr | maintenance |
| 0011 | [UTC vs Peru time skew in date inference](./0011-utc-peru-time-skew.md) | open     | medium   | 2026-04-25 | —          | Edmundo Spohr | correctness |
| 0012 | [Latency budget on summary-trigger turns](./0012-latency-budget-summary-turns.md) | open     | medium   | 2026-04-25 | —          | Edmundo Spohr | performance |
| 0013 | [Classifier override creates history divergence](./0013-classifier-override-history-divergence.md) | open     | low      | 2026-04-25 | —          | Edmundo Spohr | data-consistency |
| 0014 | [Regex preempt: tolerated false positives](./0014-regex-preempt-tolerated-false-positives.md) | open     | low      | 2026-04-25 | —          | Edmundo Spohr | precision/safety |
| 0015 | [Disclaimer flow reintegration](./0015-disclaimer-reintegration.md) | open | medium | 2026-04-26 | — | Edmundo Spohr | compliance/frontend |
| 0016 | [Gemini timeout tuning under sustained load](./0016-gemini-timeout-tuning.md) | partially-mitigated | medium | 2026-04-30 | — | Edmundo Spohr | backend/performance |
| 0017 | [Twilio async response pattern (messages.create)](./0017-twilio-async-pattern.md) | reverted | high | 2026-04-30 | 2026-04-30 | Edmundo Spohr | backend/architecture |
| 0018 | [Cloud Tasks migration](./0018-cloud-tasks-migration.md) | open | high | 2026-05-01 | — | Edmundo Spohr | backend/architecture |

## Notes

- Entry 0015 uses pre-template field names (`Created`/`Target resolution`/`Compliance impact`) rather than the standard `Detected`/`Resolved`/`Owner`/`Category` from `TEMPLATE.md`. No functional impact; normalize when convenient.
