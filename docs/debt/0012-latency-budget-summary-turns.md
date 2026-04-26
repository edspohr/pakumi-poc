# 0012 — Latency budget on summary-trigger turns

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | medium                             |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | Edmundo Spohr                      |
| **Category**  | performance / reliability          |

## Context

The `whatsappWebhook` critical path has accumulated latency from multiple
sequential operations:

| Step                                    | Budget                                |
| --------------------------------------- | ------------------------------------- |
| Cold start (Gen-2 HTTPS)                | ~3 s                                  |
| Firestore reads (pet doc + conversation) | ~0.5 s                               |
| Main agent Gemini call                  | capped at `GEMINI_REPLY_TIMEOUT_MS` = 8 s |
| Capa 2 safety classifier Gemini call    | capped at `CLASSIFIER_TIMEOUT_MS` = 3 s |
| TwiML serialization + response          | ~0.1 s                                |
| **Total worst case**                    | **~14.6 s**                           |

That sits **just under Twilio's ~15 s webhook deadline.** The margin is
thin but in principle workable.

There is, however, **one more synchronous Gemini call on the critical
path that is not bounded by any timeout cap**:

- `generateSummary` is invoked from inside `saveConversation` whenever
  the message count crosses `SUMMARY_INTERVAL` (every 10 messages).
- This call is `await`ed in the request flow.
- It has **no `AbortController`/`Promise.race` cap** — it inherits only
  the function-level 60 s ceiling.

On a turn that coincides with the summary trigger **and** a slow Gemini
response, the cumulative latency can exceed 15 s. Twilio then considers
the inbound webhook failed and never delivers the agent's response —
even though the function eventually returns 200.

## Impact

**Silent message-delivery failures on summary-trigger turns.** Hard to
reproduce because both conditions must align (1-in-10 message AND a
Gemini latency spike).

The user-visible symptom is *exactly* what motivated HC-01 (B.2 commit
6192ba1): "the agent did not respond." This is a different root cause
hiding behind the same symptom.

**Layer A observability** (Twilio status callbacks → `twilio_delivery_status`
collection, also from B.2) is the diagnostic surface. We will know whether
this fires in production by filtering for `failed` / `undelivered` events
and correlating with `messageCount % 10 === 0` on the conversation doc.

## Current workaround

None. Accepted for the POC because:

- Summary trigger is **1 in 10 messages** — bounded incidence.
- Gemini is fast most of the time — the spike is the exceptional case.
- HC-01's `FALLBACK_REPLY` helps but only fires when the **main reply**
  Gemini call exceeds 8 s. It does **not** cover the case where main
  reply succeeds but cumulative latency (main reply + summary) blows the
  Twilio budget.

## Proposed fix

Three options, escalating in complexity. Pick after Layer A data shows
whether the bug actually fires in production.

### (a) Cap `generateSummary` with its own timeout

Wrap the summary call in the same `AbortController` + `Promise.race`
pattern used elsewhere, with a 4 s budget. On expiry, skip summary on
this turn and let the next summary trigger pick it up.

- Effort: **~30 min.**
- Trade-off: occasionally skipped summary turns (acceptable — summary is
  best-effort context).

### (b) Move `generateSummary` to fire-and-forget

Run summary in the background. Persist on the next request or via a
Firestore-trigger Cloud Function that fires on `conversations/{id}` writes.

- Effort: **2–3 hours.**
- Trade-off: summary is up to 1 turn stale when read.

### (c) Move `generateSummary` to Cloud Tasks / Pub/Sub

True async pipeline: enqueue a "summarize this conversation" task,
process out-of-band, write back to the conversation doc.

- Effort: **4–6 hours.**
- Most correct, most plumbing.

**Recommendation:** wait for production data. If the bug fires
materially in Layer A logs, do **(a)** first as a quick patch, then
plan **(b)** or **(c)** based on traffic shape.

## References

- Identified during C.2 (Capa 2 classifier) verification by Claude Code.
- Related: **HC-01** (B.2 commit `6192ba1`) — same user-visible symptom,
  different root cause; HC-01 covers main-reply timeout, this covers
  cumulative-budget overrun.
- Related: [0009 — Fallback message recovery](./0009-fallback-message-recovery.md)
  — also concerns recovery from Twilio-side delivery failure.
- Code: `functions/index.js` — `whatsappWebhook` happy-path latency
  budget; `saveConversation` → `generateSummary` call site;
  `SUMMARY_INTERVAL` constant.

## History

- **2026-04-25** — Created during C.2 verification by Edmundo Spohr.
  Surfaced as a known limitation of the cumulative critical-path budget
  after Capa 2 added a second timed Gemini call.
