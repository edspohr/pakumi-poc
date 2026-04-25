# 0006 — Twilio Sandbox only

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | high                               |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | unassigned                         |
| **Category**  | product                            |

## Context

The WhatsApp inbound webhook is wired to the **Twilio WhatsApp Sandbox**, a
shared development number provided by Twilio for prototyping. To message it,
recipients must first send a join code (e.g. `join <sandbox-keyword>`) from
their own WhatsApp; only then will subsequent messages reach the webhook.

The migration to a **production WhatsApp Business sender on the client's own
number** is **planned for Hito 3** of Adenda N°1. This entry exists for
**visibility** — it is tracked debt, not unplanned debt.

## Impact

- **No real-world demo to external users without onboarding friction.**
  Every test recipient must opt in via the join code; this is acceptable for
  internal testing but not for client showcases or pilot end-users.
- **Sender restrictions.** The sandbox enforces template / format
  restrictions and is not on the client's brand. Any deliverable that needs
  to feel like the client's product cannot ship from the sandbox.
- **Account constraints.** Sandbox numbers are shared and rate-limited and
  cannot be relied on for any sustained traffic.
- **High priority because of milestone coupling.** Hito 3 cannot close on
  the sandbox; the migration is a release-blocker for that milestone.

## Current workaround

Internal testers join the sandbox by sending the join code, then test
normally. Demo scripts include the join step.

## Proposed fix

Hito 3 plan, in order:

1. Coordinate with the client to provision the WhatsApp Business sender
   (number, display name, business verification) on their Twilio account or
   ours, per the Adenda agreement.
2. Submit and get approval for any required message templates.
3. Update the inbound webhook URL on the new sender to point at the existing
   Cloud Function (`/api/whatsapp` rewrite).
4. Rotate Twilio credentials in `functions/.env` (or the Firebase Secrets
   store, depending on whether [related debt on secrets] has been addressed).
5. Smoke-test owner → assistant round-trip from the production sender.
6. Decommission the sandbox configuration once the production sender is
   confirmed working.

Effort: **M**, but most of the calendar time is external (verification,
approvals).

**Trigger:** Hito 3 kickoff per Adenda N°1.

## References

- ADR: [`docs/decisions/ADR-001-pakumi-platform.md`](../decisions/ADR-001-pakumi-platform.md) — Hito 3 follow-up
- Code: `functions/index.js` (Twilio webhook handler), `firebase.json`
  (`/api/whatsapp` rewrite)

## History

- **2026-04-25** — Detected by Edmundo Spohr. Registered for visibility;
  resolution scheduled for Hito 3 of Adenda N°1.
