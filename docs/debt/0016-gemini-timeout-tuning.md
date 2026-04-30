# 0016 — Gemini timeout tuning under sustained load

| Field        | Value                              |
| ------------ | ---------------------------------- |
| **Status**   | partially-mitigated                |
| **Priority** | medium                             |
| **Detected** | 2026-04-30                         |
| **Resolved** | —                                  |
| **Owner**    | Edmundo Spohr                      |
| **Category** | backend / performance              |

## Context

Pakumi team testing on 2026-04-30 (post Sprint Review #2 on 2026-04-27)
surfaced intermittent agent failures on the WhatsApp pipeline. Multiple
team members (Mily, Betsy, Patty) reported that the agent occasionally
"didn't respond" or returned a generic technical-error fallback instead
of the expected reply.

Cloud Function logs traced this to two timeout caps in the request
pipeline:

- `GEMINI_REPLY_TIMEOUT_MS` (main reply) — set at 8000ms.
- `CLASSIFIER_TIMEOUT_MS` (Capa 2 safety classifier, fail-open) — set
  at 3000ms.

Under sustained load, Gemini 2.5 Flash response latency exceeded the
8000ms cap with sufficient frequency to be user-visible, triggering
`Gemini fallback triggered (timeout)` log events. The Capa 2 classifier
also occasionally exceeded its 3000ms cap, logged as
`safety.classifier_timeout` (fail-open behaviour — the original reply
goes through unchanged in that case).

Total function execution time was reaching 14–16 seconds in the worst
cases, brushing against Twilio's 15-second webhook timeout.

## Impact

- User-visible: agent appears to "not respond" or returns the generic
  fallback message. Erodes confidence in the product during the very
  testing phase that should be building it.
- Operational: at 14–16s function execution we are one Gemini latency
  spike away from a Twilio webhook timeout (ErrorCode 11200), which
  would cause Twilio retries and duplicated processing.
- Trigger conditions: complex/long user prompts and concurrency from
  multiple testers exercising the agent simultaneously.

## Current workaround

Mitigation applied 2026-04-30:

- `GEMINI_REPLY_TIMEOUT_MS`: **8000 → 12000** (`functions/index.js:69`)
- `CLASSIFIER_TIMEOUT_MS`: **3000 → 2500** (`functions/index.js:70`)

Combined ceiling: 14.5s, still under Twilio's 15s webhook timeout with
margin for I/O and TwiML response serialization. The classifier cap was
tightened deliberately so the budget redistribution favours the main
reply (where user-visible value is) rather than the post-response
safety check (which fails open and so a tighter cap is low-risk).

This is mitigation, not a fix. Under heavy concurrency or particularly
long prompts, timeouts can still occur.

## Proposed fix

Long-term: migrate the WhatsApp webhook from synchronous TwiML response
to asynchronous Twilio `messages.create` REST API. This decouples the
agent's thinking time from the 15s webhook response window entirely,
removing the structural source of these timeouts rather than tuning
around them. Tracked as a Sprint 3 candidate.

Closure criteria — either of:

- Zero `Gemini fallback triggered (timeout)` and
  `safety.classifier_timeout` events in a 7-day window of normal usage;
  **OR**
- Migration to the async response pattern (which makes this debt
  obsolete by removing the constraint entirely).

## References

- Code: `functions/index.js:16-17` and `:25` (header docstring),
  `:69-70` (constants)
- Post-mortem: `docs/post-mortem/2026-04-30-gemini-timeout.md`
- Related debt: `0009-fallback-message-recovery.md` — downstream UX
  consequence of the fallback path being hit at all
- Related debt: `0012-latency-budget-summary-turns.md` — the latency
  budget breakdown this tuning operates within

## History

- **2026-04-30** — Detected by Pakumi team during post-Sprint-Review
  testing. Constants tuned (8000→12000, 3000→2500) and deployed to
  production at 18:33 UTC. Documentation entry filed retroactively
  in this commit; see post-mortem for the temporal-anomaly note.
