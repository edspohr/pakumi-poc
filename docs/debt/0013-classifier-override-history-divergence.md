# 0013 — Classifier override creates conversation-history divergence

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | low                                |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | Edmundo Spohr                      |
| **Category**  | data-consistency / UX              |

## Context

When the **Capa 2 safety classifier** (added in C.2) detects a
veterinary emergency, it triggers a **total override**: the user
receives `EMERGENCY_TEMPLATE_INLINE` instead of the agent's original
generated reply.

However, the agent's **original** reply is what gets persisted to the
`conversations` collection by `saveConversation`. The override happens
*after* persistence, on the way out to TwiML.

This creates a divergence:

| Where                            | Content                                  |
| -------------------------------- | ---------------------------------------- |
| `conversations/{id}.messages[]`  | The agent's original generated reply     |
| What the user actually saw       | `EMERGENCY_TEMPLATE_INLINE`              |

On the next turn, the agent reads the conversation history and may
reference its original reply as if the user had read it ("como te
mencioné antes sobre el tratamiento casero…"), even though the user
only saw "🚨 ve al veterinario de urgencia ya."

## Impact

Occasional confusing follow-up responses when the agent references
content the user never actually saw. Concretely:

- **Statistically rare** — only fires on detected `EMERGENCIA_*`
  classifications, which are themselves a small fraction of traffic.
- **Often self-corrects** — the user's next message tends to be in the
  context of the emergency template they actually saw, which re-grounds
  the agent organically on the next turn.
- **Worst case** — user follows up tangentially ("¿y cuánto cuesta esa
  consulta?"), the agent assumes shared context with its original reply
  about something else, and the conversation drifts off the rails.

Not a safety bug per se (the user did receive the emergency redirect),
but a coherence bug.

## Current workaround

None. Accepted as known behavior for the POC.

## Proposed fix

Two options.

### (a) Persist the override to history instead of the original

Replace the `assistant` turn in `messages[]` with
`EMERGENCY_TEMPLATE_INLINE`. The conversation history then matches what
the user saw.

- Trade-off: **loses the original reply.** Debt
  [0008](./0008-emergency-templates-clinical-validation.md) (clinical
  validation) will eventually need access to what the agent originally
  said before the override, to evaluate whether the agent's safety
  reasoning was correct. Throwing this away costs us audit data.

### (b) Persist BOTH (recommended)

- The user-facing override goes to `conversations` history (so the
  agent's future context matches what the user saw).
- The agent's **original** reply goes to `safety_classifications`
  alongside the existing classifier metadata, as a new `originalReply`
  field. This preserves the audit trail for clinical review.
- `saveConversation` signature gains an optional `displayedReply`
  parameter; the webhook passes the override there when it fires.

- Effort: **1–2 hours** including schema updates to the
  `safety_classifications` document shape (new `originalReply` field,
  optional, only present on override turns).

**Recommendation: (b)** when prioritized, because it keeps both the
coherence fix *and* the audit trail.

**Decision should be informed by production data:**

- How often does override actually fire? (Filter `safety_classifications`
  for `overrideTriggered: true`.)
- How often does the next-turn confusion manifest? (Harder — needs
  qualitative review of conversations where the prior turn was an
  override.)

If overrides are rare AND next-turn confusion is rarely visible, this
stays low priority. If overrides become more frequent (e.g., as the
classifier prompt is tuned to be more conservative), it moves up.

## References

- Identified during C.2 (Capa 2 classifier) verification by Claude
  Code, flagged in the verification report alongside the classifier
  implementation.
- Code: `functions/index.js` — `whatsappWebhook` happy path:
  `saveConversation(...)` runs *before* the Capa 2 override decision.
- Related: [0008 — Emergency templates clinical validation](./0008-emergency-templates-clinical-validation.md)
  — the clinical-validation track will need access to original
  pre-override replies, which option (b) preserves.

## History

- **2026-04-25** — Created during C.2 verification by Edmundo Spohr.
  Documented as a known consequence of the persist-then-override
  ordering chosen in the C.2 implementation.
