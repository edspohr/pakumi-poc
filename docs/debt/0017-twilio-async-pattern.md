# 0017 — Twilio async response pattern (messages.create)

| Field        | Value                              |
| ------------ | ---------------------------------- |
| **Status**   | implemented                        |
| **Priority** | high                               |
| **Detected** | 2026-04-30                         |
| **Resolved** | 2026-04-30                         |
| **Owner**    | Edmundo Spohr                      |
| **Category** | backend / architecture             |

## Context

Pakumi team testing on 2026-04-30 surfaced a structural ceiling that
debt 0016 (timeout tuning) only partially mitigated. Even after raising
`GEMINI_REPLY_TIMEOUT_MS` to 12000ms, complex elaborate user queries
were still failing intermittently. Investigation of Twilio sandbox CSV
logs confirmed the failure pattern: the inbound webhook was occasionally
exceeding Twilio's 15-second hard ceiling and Twilio was returning
ErrorCode 11200 ("HTTP retrieval failure") — at which point Twilio
retries the webhook, producing duplicated processing on our end and a
generic "technical error" message visible to the user.

The example reproducer was three consecutive attempts of the same
elaborate prompt from a team member (Betsy, asking for a leash
recommendation for her German Shepherd Kira) — all three failed despite
the recently raised timeout.

The synchronous TwiML response pattern coupled Gemini latency directly
to Twilio's 15s webhook ceiling. Tuning timeouts could buy margin but
could not address the structural coupling.

## Impact (before this fix)

- User-visible: agent appeared to fail or returned a generic technical
  error for the very queries (long, multi-context) where it would be
  most valuable.
- Operational: ErrorCode 11200 events in Twilio logs, with retries
  causing duplicated Cloud Function executions and duplicate Firestore
  writes on the conversation document.
- Trust: failures correlated with the most ambitious user prompts —
  precisely the cases that demonstrate the agent's value when working.
  Erodes confidence during the testing phase that should be building it.

## Resolution

Migrated the WhatsApp webhook from synchronous TwiML response to
asynchronous Twilio `messages.create` REST API. New flow:

1. Inbound webhook → parse body → 200 OK with empty `<Response/>`
   immediately (~100–500ms).
2. Same handler awaits `processAndRespond()` which runs the existing
   pipeline (Capa 3 regex preempt → Gemini main reply → Capa 2 safety
   classifier → final delivery).
3. Outbound replies — including the Capa 3 emergency template, the
   Capa 2 override, the intermediate "still thinking" message, and
   all soft-fallback paths — go via `messages.create` with the
   existing `TWILIO_STATUS_CALLBACK_URL` for Layer A delivery
   observability.

Code changes are concentrated in `functions/index.js` (refactor of
`whatsappWebhook` + new `processAndRespond` + `sendWhatsAppMessage` +
retry helper + lazy-loaded `getTwilioClient`).

### Specific behavior decisions

#### Pattern choice — await-after-send, not detached fire-and-forget

The migration spec described "fire and forget" conceptually. We
implemented it as **await-after-send**: the handler flushes
`res.status(200).send(...)` first, then `await`s `processAndRespond()`
inside the same handler.

**Why:** Cloud Functions Gen-1 may reap the function instance once the
handler returns. Truly detached promises (started without `await` after
`res.send()`) can be silently dropped — exactly the failure mode this
debt is supposed to prevent. The await pattern delivers the same
observable property (Twilio gets its ack within ~100–500ms, agent
delivers reply asynchronously thereafter) while keeping the instance
alive via the platform's standard guarantee that the instance lives
until the handler returns. No reaping risk.

#### Capa 2 + intermediate ordering — known acceptable behavior

The intermediate "still thinking" message fires at `T+5s` if Gemini
main has not yet returned. Capa 2 runs **after** Gemini main returns,
so its emergency-override verdict can only land **after** the
intermediate has either fired or been canceled. Concretely:

- Gemini fast (<5s) → intermediate never fires → Capa 2 override (if
  any) lands cleanly.
- Gemini slow (5–12s) → intermediate fires at T+5s → Capa 2 may then
  override at roughly T+(Gemini latency)+(classifier latency).

In the slow + override case, the user receives `[intermediate] →
[emergency template]`. This is **acceptable**: the user still ends up
with the correct safety guidance, just preceded by a reassuring
"we're processing your message" message. Trying to suppress the
intermediate retroactively is not possible (WhatsApp messages cannot
be unsent), and trying to defer the intermediate until after Capa 2
would defeat its UX purpose (telling the user we're working during
the slow window). The migration spec's literal rule "do not send the
intermediate if Capa 2 overrides" is therefore not implementable
without restructuring; we honor its spirit by suppressing on Capa 3
(where suppression is clean) and accepting the rare doubled-message
sequence in the Capa 2 + slow case.

#### Background processing — fire-and-forget vs Cloud Tasks/Pub-Sub

We chose to keep the agent pipeline inline within the same Cloud
Function invocation rather than enqueueing it to Cloud Tasks or Pub/Sub.

**Trade-off accepted:** if the function process crashes or is reaped
between webhook ack and reply delivery, the user receives no reply —
no built-in redelivery. Cloud Tasks would give us at-least-once
delivery semantics with retry, at the cost of significantly more
infrastructure (queue config, IAM, idempotency keys for the agent
pipeline, dead-letter handling, additional Firestore writes for state
machine tracking).

**Why acceptable now:** current volume is the Pakumi team itself
(<10 messages/day across all testers). The probability of in-flight
crash + lost reply is tiny, and a lost reply is recoverable by the
user simply re-sending their message.

**Sprint 4 candidate:** if UAT under load (target: 167 leads from
the marketing pipeline) shows non-trivial background message loss,
revisit Cloud Tasks. The boundary is clean: `processAndRespond()` is
already an isolated function; moving it to a queue worker is mostly
plumbing.

#### 5000ms threshold for intermediate

Chosen because:

- Below 5s, the intermediate would fire on the median Gemini reply
  (2–6s normal range), which is noisy.
- Above 5s, users start to feel the silence as a problem rather than
  a wait — informal Pakumi team feedback during testing was that
  3–4s feels normal for an AI reply but 6–7s feels stalled.
- Gemini's tail latency (when it runs slow) typically lands in the
  8–15s range, so 5s gives the intermediate a meaningful window in
  which to fire when it would actually help.

Not currently configurable via env var. Could be promoted to a
`defineString` param if tuning becomes a recurring need.

#### Retry policy on messages.create

3 retries (4 attempts total) with 1s/2s/4s exponential backoff.
Retry on:

- Network errors (no HTTP response — Twilio SDK throws an error with
  no `status` field).
- 5xx responses from Twilio.

Do **not** retry on 4xx — those are client errors (invalid number,
bad auth, exceeded daily limit) where retrying just burns budget.

On final retry failure: log structured with `conversationId`,
`petId`, `userMessageHash`, `replyPreview` (200 chars), HTTP status,
Twilio error code, and message. Do **not** throw further — the
function ack already happened and there is no caller able to act on
the failure.

## Trade-offs and out-of-scope items

### 24-hour reply window

Twilio Sandbox WhatsApp has a 24-hour reply window for messages
without an approved Content SID template. Both the intermediate and
the final reply are sent within seconds of receiving an inbound — well
within 24h, so this assumption holds for current scope.

**Out of scope for this migration; will resurface in Hito 3** when
proactive reminders are implemented (push messages outside the 24h
reply window will require approved Twilio Content templates and a
different API path).

### Conversation history when Capa 2 overrides

Existing behavior preserved (see debt 0013): the conversation document
stores the Gemini-produced reply, not the Capa 2 emergency override
that the user actually saw. This is a divergence between persisted
history and lived experience. Not introduced by this migration; the
divergence existed before and is not made worse by it.

### "problemas técnicos" alarmist phrasing

Replaced with `SOFT_FALLBACK_REPLY` ("Lo siento, no pude procesar tu
mensaje a tiempo. Por favor, ¿puedes repetirlo? Si era urgente,
contacta directo a tu veterinario.") on every fallback path. The
prior text was being seen by users in the failure cases this migration
is fixing; preserving it post-fix would mean it'd still be seen
whenever the rare residual failure case hits.

## Closure criteria

- Zero ErrorCode 11200 events in Twilio logs over a 7-day window of
  normal usage post-deploy.

(Single criterion, not "either/or" — the migration removes the
structural cause; the closure criterion is empirical confirmation
that the cause is gone in production.)

## References

- Code: `functions/index.js` — header docstring, `processAndRespond`,
  `sendWhatsAppMessage`, `sendWhatsAppWithRetry`, `getTwilioClient`,
  `whatsappWebhook` handler.
- Post-mortem: `docs/post-mortem/2026-04-30-async-migration.md`
- Related debt: `docs/debt/0016-gemini-timeout-tuning.md` — the
  partial mitigation this migration supersedes.
- Related debt: `docs/debt/0009-fallback-message-recovery.md` — the
  UX consequence of the fallback path being hit at all.
- Related debt: `docs/debt/0013-classifier-override-history-divergence.md`
  — pre-existing divergence between persisted history and Capa 2
  override; preserved by this migration.
- Twilio docs: ErrorCode 11200 (webhook HTTP retrieval failure).

## History

- **2026-04-30** — Detected during Pakumi team testing. Investigated
  via Twilio CSV logs. Migration designed, implemented, and deployed
  same day. This entry filed as part of the implementation commit.
