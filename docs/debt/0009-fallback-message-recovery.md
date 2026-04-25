# 0009 — Fallback message recovery

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | medium                             |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | unassigned                         |
| **Category**  | backend                            |

## Context

The WhatsApp webhook caps the user-facing Gemini call at
`GEMINI_REPLY_TIMEOUT_MS` (currently 8s) so that we always return TwiML
inside Twilio's ~15s webhook deadline. On timeout we return a Spanish
fallback acknowledgment ("Estoy procesando tu consulta, dame un momento
más…") and we **persist the user's incoming message** to the conversation
history with no assistant turn.

This is option (b) from the HC-01 design: "leave the user's message in
conversation history so the next user message naturally re-prompts." It is
the simpler of the two options we considered, accepted as a UX degradation
for the POC phase.

## Impact

When the fallback fires:

- The user gets a holding message instead of the real answer.
- The user must send a follow-up to actually receive the substantive
  response. The follow-up triggers a fresh Gemini call that has the
  unanswered prior message in context, so the eventual reply can address
  both — but the user has to take the action.
- We have no *push* recovery: if the user does not follow up, they never
  get the real answer.

Today we have no production data on how often this fires. Status callbacks
landed in the same change (collection `twilio_delivery_status`) but those
report Twilio-side delivery, not Gemini-side fallback rate — fallback
events are logged via `functions.logger.warn` with the payload
`{ conversationId, userMessageHash, geminiLatencyMs, triggeredFallback: true }`
and need to be aggregated from Cloud Logging.

## Current workaround

Option (b) above is the workaround: store the unanswered user message so
the next exchange retains context. The user is the one initiating recovery.

## Proposed fix

Option (a) from the HC-01 design — **push recovery via a delayed second
response**. Sketch:

1. On fallback, enqueue the user's message + conversation context to
   **Cloud Tasks** with a short delay (e.g. 10s).
2. A second Cloud Function consumes the task, calls Gemini *without* the
   8s cap (we already returned TwiML to Twilio so we are no longer racing
   the webhook timeout), and sends the reply to the user via the **Twilio
   REST API** (`messages.create`) — pattern (b) for this specific
   out-of-band message.
3. Persist both the user message and the (now-real) assistant reply in the
   conversation history.
4. Apply the same retry / error handling we'd want for any REST API send.

Effort: **M**. New surface (Cloud Tasks, Twilio REST send), and forces us
to take on a sliver of pattern (b) ownership for delivery — but only on
the rare fallback path, not the hot path.

**Trigger to start:** **blocked on production traffic data from status
callbacks and fallback logs.** Re-evaluate once we have ≥ 2 weeks of
deployed traffic and can quantify the fallback rate. If fallbacks are <1%,
this stays low priority. If they're material, it moves up.

## References

- Bug: HC-01 (WhatsApp delivery occasionally fails)
- Code: `functions/index.js` — see header comment block on the timeout
  architecture; fallback path is in the `whatsappWebhook` handler.
- Related: this depends on the `twilio` REST SDK we already declare as a
  dependency in `functions/package.json` but currently do not use.
- Related debt: [0006 — Twilio Sandbox only](./0006-twilio-sandbox-only.md)
  (REST sends from the sandbox have additional restrictions that may
  affect testing of option (a))

## History

- **2026-04-25** — Detected by Edmundo Spohr during HC-01 fix. Registered
  as deferred follow-up to the option (b) workaround that landed with the
  bug fix.
