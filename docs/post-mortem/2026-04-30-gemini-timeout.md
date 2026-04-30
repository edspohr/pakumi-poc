# Post-mortem — Gemini timeout intermittency (2026-04-30)

| Field           | Value                                          |
| --------------- | ---------------------------------------------- |
| **Severity**    | medium (user-visible, partial degradation)     |
| **Detected**    | 2026-04-30, during Pakumi team testing         |
| **Mitigated**   | 2026-04-30 18:33 UTC (production deploy)       |
| **Documented**  | 2026-04-30 (this file, retroactive)            |
| **Related debt**| `docs/debt/0016-gemini-timeout-tuning.md`      |

## Process note — temporal anomaly (read first)

The mitigation was deployed to production at 2026-04-30 18:33 UTC
ahead of any corresponding git commit. The fix was applied directly
to the deployed function under time pressure during active testing,
and the git history was reconciled afterwards by the same commit
that introduces this post-mortem and debt 0016. **Production
preceded source control by several hours.**

This is recorded honestly because the audit trail matters more than
appearances. The process gap to close: future urgent production
patches should be committed locally first and deployed from the
committed state, even when the urgency feels like it justifies a
shortcut. We did not follow that rule today, and this paragraph
exists so the next person reading the git history understands why
the deploy timestamp does not match the commit timestamp.

## What happened

**Timeline (all times Chile, UTC-4 unless noted):**

- **2026-04-27** — Sprint Review #2. Pakumi team begins extended
  testing of the WhatsApp agent.
- **2026-04-30, morning–afternoon** — Multiple team members (Mily,
  Betsy, Patty) report intermittent "technical errors" or no
  response from the agent on WhatsApp.
- **2026-04-30, afternoon** — Cloud Function log review identifies
  the pattern: `Gemini fallback triggered (timeout)` events
  correlated with the user-reported failures, plus occasional
  `safety.classifier_timeout` events. Total function execution
  time was reaching 14–16s on the slowest invocations, brushing
  against Twilio's 15s webhook timeout.
- **2026-04-30, ~14:33 Chile (18:33 UTC)** — Mitigation deployed
  directly to production: raised `GEMINI_REPLY_TIMEOUT_MS` from
  8000 to 12000ms; lowered `CLASSIFIER_TIMEOUT_MS` from 3000 to
  2500ms.
- **2026-04-30, evening** — This documentation written and
  committed to close the audit-trail gap. Source-control state
  caught up to production state.

## What we observed

The relevant structured log events (event names as emitted from
`functions/index.js`):

- `Gemini fallback triggered (timeout)` — emitted from the main
  reply path when the AbortController + Promise.race pair fires
  before Gemini returns. Each event carries `geminiLatencyMs`,
  `conversationId`, `userMessageHash`, `triggeredFallback: true`.
  On 2026-04-30 these landed at values clustered right around the
  8000ms cap, indicating the cap (not Gemini failure) was the
  bottleneck.
- `safety.classifier_timeout` — emitted by the Capa 2 classifier
  fail-open path when the 3000ms cap was exceeded. Carries
  `petId`, `conversationId`, `userMessageHash`, `latencyMs`.
  Fail-open semantics mean the user did receive the original reply;
  the missing piece was the post-response safety check, which is
  acceptable degradation by design.

User-message bodies are not in logs — only short SHA-256 prefixes
via `shortHash()` at `functions/index.js:138`. Phone numbers in any
operator-side log inspections are anonymized in writing as
`+51XXXX` (last four digits redacted) per repo convention.

## What we changed

| Constant                  | Before | After |
| ------------------------- | ------ | ----- |
| `GEMINI_REPLY_TIMEOUT_MS` | 8000   | 12000 |
| `CLASSIFIER_TIMEOUT_MS`   | 3000   | 2500  |

Combined ceiling: 14.5s. JSDoc header at `functions/index.js:16-17`
and `:25` was also updated to reflect the new values for internal
consistency.

## What we did NOT change, and why

- **Gemini model version** (`gemini-2.5-flash`). The latency we
  observed sits in the model's normal distribution, not an anomaly —
  switching models would trade one latency profile for another
  without solving the structural webhook-timeout coupling.
- **Capa 2 classifier prompt and fail-open behaviour.** The
  fail-open semantics are intentional and remain unchanged: when in
  doubt, deliver the agent's reply rather than block it on a
  late-arriving safety verdict. We tightened its time budget but
  did not change what it does or how it fails.
- **Structured logging format.** Existing event names
  (`Gemini fallback triggered (timeout)`,
  `safety.classifier_timeout`, etc.) are unchanged so existing log
  filters and any downstream tooling continue to work.

## Open questions for future review

- **Should we move to the async messaging pattern?** The fundamental
  problem is that Gemini latency is coupled to a 15s webhook timeout
  we don't control. Tuning constants buys margin but cannot solve
  this structurally. Tracked as a Sprint 3 candidate; debt 0016's
  closure criteria explicitly accept this migration as an
  alternative to "zero timeout events for 7 days".
- **Per-conversation rate limiting?** Concurrency from multiple
  team-member testers may have contributed. Worth quantifying before
  productizing the agent for clinical reviewers in Sprint 3.
- **Should the user-facing fallback message be less alarmist?**
  "Disculpa, estoy teniendo problemas técnicos. Intenta de nuevo en
  unos minutos." (current text in `functions/index.js`) is honest
  but scary. A softer phrasing that asks the user to retry would
  preserve information while reducing the perception of failure.
  See debt 0009 for related context.
