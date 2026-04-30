# Post-mortem — WhatsApp async migration (2026-04-30)

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| **Severity**     | high (user-visible failures on complex queries) |
| **Detected**     | 2026-04-30, during Pakumi team testing         |
| **Mitigated**    | 2026-04-30 (same-day, post-debt-0016 deploy)   |
| **Documented**   | 2026-04-30 (this file, with code)              |
| **Related debt** | `docs/debt/0017-twilio-async-pattern.md`       |
| **Predecessor**  | `docs/post-mortem/2026-04-30-gemini-timeout.md` (partial fix) |

## What happened

This is the second incident on 2026-04-30 in a sequence. The first
(see predecessor post-mortem) was the timeout-tuning fix that raised
`GEMINI_REPLY_TIMEOUT_MS` from 8000 to 12000ms. The Pakumi team
resumed testing afterward and quickly hit a second class of failure:
elaborate prompts (long, multi-context queries) were still failing
even with the tighter budget.

**Timeline (Chile time, UTC-4):**

- **2026-04-30, ~14:33 (post timeout-tuning deploy)** — Team resumes
  testing. Short queries work. Complex queries still fail intermittently.
- **2026-04-30, afternoon** — Investigation pivots from Cloud Function
  logs to **Twilio sandbox CSV logs**. Pattern identified: `ErrorCode
  11200` ("HTTP retrieval failure") on the inbound webhook for the
  failing queries — Twilio's webhook timeout (15s hard cap) being
  exceeded, followed by Twilio retries.
- **Reproducer:** Betsy's leash query for Kira (German Shepherd, 3
  years, 39kg) — three consecutive attempts, all failed despite the
  raised Gemini cap. The query is the kind of multi-context request
  ("recommend the best leash given X, Y, Z, in Lima, Peru…") that
  drives Gemini latency into its tail distribution.
- **2026-04-30, late afternoon** — Async-migration design agreed.
  Decision: ack-fast + outbound via `messages.create`, fire-and-forget
  at the in-handler level, NOT Cloud Tasks (see decision rationale
  below).
- **2026-04-30, evening** — Team notified by the operator that
  maintenance is happening: *"Gracias por las pruebas equipo. Voy a
  aplicar una mejora adicional ahora mismo así que no se asusten si
  en las próximas 2 horas Pakumi parece no estar disponible."*
- **2026-04-30, evening** — Implementation completed, committed
  locally, deployed via `firebase deploy --only
  functions:whatsappWebhook`, smoke-tested, and a follow-up
  notification sent to the team via WhatsApp confirming the fix.
- **2026-04-30, post-deploy** — This post-mortem and debt 0017
  written and committed alongside the code.

## Evidence

The relevant Twilio log signals (from the sandbox CSV export):

- Direction: `inbound`, ErrorCode `11200`, To `+51XXXX` (last four
  redacted per repo convention), Status `failed`. These were the
  webhook-timeout events.
- Cloud Function `whatsappWebhook` logs (structured) for the same
  invocations: `Gemini fallback triggered (timeout)` events with
  `geminiLatencyMs` clustered near the 12000ms cap — i.e. Gemini was
  exceeding even the raised cap, not just the prior 8000ms one. This
  is what made it clear that timeout tuning was not going to be
  sufficient and a structural change was needed.
- Twilio retries of the failed inbound visible as duplicated webhook
  invocations a few seconds apart, each with the same `MessageSid`
  prefix and User message body. The retries were also failing because
  Gemini was still slow on the retry attempt — just produced
  duplicate Firestore writes on the conversation document.

User-message bodies are not in logs — only short SHA-256 prefixes
via `shortHash()`. Operator-side log inspections referred to phone
numbers in writing as `+51XXXX` (last four redacted).

## Decision rationale

### Why async pattern, not "more timeout tuning"

The structural issue is that synchronous TwiML couples Gemini latency
to a 15s ceiling we don't control. Tuning constants buys margin but
not headroom — it only delays the next outage. Async response
(`messages.create`) decouples them: webhook ack and Gemini completion
become independent in time. The constraint that was binding (15s
ceiling) becomes a non-constraint.

### Why fire-and-forget at the function level, not Cloud Tasks/Pub-Sub

We chose to keep the agent pipeline inline within the Cloud Function
rather than enqueueing it. Specifically: ack the webhook, then `await`
`processAndRespond()` inside the same handler.

**Pro of inline:** much simpler. Zero additional infrastructure
(queue config, IAM, retries, idempotency, dead letters). One commit
and a deploy is enough.

**Con of inline:** if the function process crashes or is reaped
between webhook ack and reply delivery, the user receives no reply —
no built-in retry. Cloud Tasks would give us at-least-once delivery,
at the cost of significant additional plumbing.

**Why the trade-off is right today:** current volume is the Pakumi
team itself (<10 messages/day across all testers). Probability of
in-flight crash + lost reply is tiny, and lost replies are
user-recoverable by re-sending. Implementing Cloud Tasks correctly
takes days; implementing the async pattern took an evening. The boundary
between the two is clean — `processAndRespond()` is already an
isolated function — so a Sprint 4 migration to Cloud Tasks (if UAT
under load shows non-trivial loss) is a re-platforming, not a
rewrite.

### Why await-after-send, not detached fire-and-forget

The migration spec described "fire and forget" conceptually. We
implemented it as **await-after-send**:

```js
res.status(200).send(EMPTY_TWIML_RESPONSE); // flush ack
await processAndRespond(body);              // continue, await keeps instance alive
```

The textbook "detached" pattern would have been:

```js
res.status(200).send(EMPTY_TWIML_RESPONSE);
processAndRespond(body).catch(/* log */);   // handler returns immediately
```

On Cloud Functions Gen-1, the handler returning is the signal for the
platform to potentially reap the instance. Detached promises started
after `res.send()` can be silently dropped — exactly the failure mode
this migration is supposed to prevent.

The `await` keeps the handler alive (and therefore the instance
alive) until the reply has been delivered. From Twilio's perspective
it sees no difference — the ack was flushed before the await. From
the user's perspective the reply still feels async (Twilio is no
longer waiting for the function to finish before the user sees the
ack).

### Why 5000ms threshold for the intermediate

- Below 5s, the intermediate would fire on the median Gemini reply
  (2–6s normal range), which is noisy.
- Above 5s, users start to feel the silence as a problem rather than
  a normal AI wait.
- Gemini's tail latency lands in the 8–15s range, so 5s gives the
  intermediate a meaningful window in which to fire when it would
  actually help.
- Empirical: informal Pakumi team feedback during testing was that
  3–4s feels normal but 6–7s feels stalled. 5s sits at the boundary.

Not currently env-var-configurable. Will revisit if tuning becomes a
recurring need.

## What we changed

- `functions/index.js` — refactored `whatsappWebhook` to ack-fast
  pattern; added `processAndRespond` containing the existing pipeline
  (Capa 3 → Gemini main → Capa 2 → delivery); added
  `sendWhatsAppMessage` + `sendWhatsAppWithRetry` for outbound
  delivery; added `getTwilioClient` (lazy-loaded); added 3 new
  `defineSecret`s for Twilio credentials; added intermediate "still
  thinking" timer racing the Gemini call; softened the
  `SOFT_FALLBACK_REPLY` text used on every internal-failure path;
  removed the now-unused `twiml()` and `escapeXml()` helpers;
  rewrote the file header docstring to describe the new architecture.
- `functions/.env.example` — added 3 new Twilio secret placeholders
  with comments matching the existing style.
- `docs/debt/0017-twilio-async-pattern.md` — new debt entry,
  status `implemented`.
- `docs/debt/README.md` — added 0017 index row + footer Notes
  section flagging the pre-existing 0015 format inconsistency.
- `CLAUDE.md` — added a "WhatsApp webhook async response pattern"
  subsection in the architecture section.
- `notifications/2026-04-30-pakumi-update-async.md` — new file with
  the Spanish team-update text for the operator to send post-deploy.

## What we did NOT change, and why

- **Capa 1/2/3 logic, prompts, and templates.** All safety layers
  remain functionally identical — we only changed how the reply is
  delivered, not what it says or when it overrides.
- **Gemini model version (`gemini-2.5-flash`).** The structural fix
  removes the latency-ceiling coupling; we don't need a faster model
  to fix the symptom.
- **Extraction pipeline.** Already runs background-detached from the
  reply path; unchanged.
- **`twilioStatusCallback` handler.** Continues to log delivery
  state transitions; the only change is its preamble comment, which
  was updated from "messages we returned via TwiML" to "outbound
  messages sent via messages.create" since that is now the source of
  delivery callbacks.
- **Conversation history when Capa 2 overrides.** Pre-existing
  divergence (debt 0013) preserved; not introduced or worsened by
  this migration.
- **Cloud Function timeout (60s) and memory (256MB).** Defaults
  remain. The pipeline plus retries fits comfortably.

## Open questions for future review

- **Cloud Tasks migration?** Sprint 4 candidate. The trigger is UAT
  under load (target: 167 leads from the marketing pipeline) showing
  non-trivial background message loss. The boundary is clean —
  `processAndRespond()` is already an isolated function — so the
  migration is mostly plumbing if it becomes necessary.
- **Per-conversation rate limiting?** Carried over from the prior
  post-mortem. Concurrency from multiple testers may have contributed
  to the original timeout incident. Worth quantifying before
  productizing the agent for clinical reviewers in Sprint 3.
- **Should `INTERMEDIATE_THRESHOLD_MS` be tunable via env?** Currently
  hard-coded at 5000ms. Promote to `defineString` only if we find we
  need to tune it in production without a redeploy.
- **24h reply window for Hito 3.** Out of scope for this migration;
  noted in debt 0017 §"24-hour reply window". When proactive reminders
  ship, push messages outside the 24h window will need approved
  Twilio Content templates.
- **Idempotency for replays.** If Twilio ever retries a webhook
  before our ack reaches it, we could process the same inbound twice.
  The ack-fast pattern minimizes this window dramatically (~100–500ms
  vs ~12+s previously), but does not eliminate it. Worth tracking if
  the 2026-04-30 incident recurs in any form post-deploy.
