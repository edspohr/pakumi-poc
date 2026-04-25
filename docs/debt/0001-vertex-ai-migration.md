# 0001 — Vertex AI migration

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | medium                             |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | unassigned                         |
| **Category**  | backend                            |

## Context

The WhatsApp assistant currently calls **Google Gemini 2.5 Flash via the
Google AI (Generative Language) API**, using the `@google/generative-ai`
SDK from inside Cloud Functions. The API key lives in `functions/.env` and
is loaded via `dotenv`.

This is the lowest-friction integration path and was chosen deliberately for
POC speed. The alternative — **Vertex AI Gemini** — provides project-level
quotas, IAM-based authentication (no long-lived API keys), regional model
endpoints, private networking, and an enterprise SLA, but requires
provisioning a Vertex endpoint and adopting a different SDK / auth flow.

This trade-off is recorded in `docs/decisions/ADR-001-pakumi-platform.md`.

## Impact

Currently dormant. Pain points that will activate it:

- **Quota / rate-limit ceiling.** Google AI API quotas are lower and less
  predictable than Vertex's project-level quotas. A small spike in WhatsApp
  traffic (e.g. a real-user demo) could throttle the assistant.
- **No enterprise SLA.** Acceptable for POC, not for any client-facing
  production commitment.
- **API-key auth.** Long-lived key in `.env`; rotating it requires a
  redeploy. Vertex would let us use service-account / Workload Identity
  authentication instead.
- **Region control.** Google AI API does not let us pin the model region;
  Vertex does. Matters once we have a defined target geography for users.

## Current workaround

None — tolerated for the POC phase. POC traffic is well under the Google AI
free-tier limits and the API-key surface is acceptable while `functions/.env`
remains the secret store overall.

## Proposed fix

1. Provision a Vertex AI endpoint in the same region as the Cloud Functions
   (`us-central1`) under the `pakumi-poc` project (or its production successor).
2. Replace `@google/generative-ai` with the Vertex AI SDK call site
   (`@google-cloud/vertexai`) inside `functions/index.js`.
3. Drop the `GEMINI_API_KEY` env var; Cloud Functions get IAM credentials
   automatically via the runtime service account — grant it the
   `roles/aiplatform.user` role.
4. Validate the prompt and response shape have not regressed (manual test of
   the WhatsApp happy path).

Effort: **S–M**. Mostly mechanical once the endpoint is provisioned.

**Trigger to start:** first observed throttling event, or the move toward a
client-facing production deployment, whichever comes first.

## References

- ADR: [`docs/decisions/ADR-001-pakumi-platform.md`](../decisions/ADR-001-pakumi-platform.md) — alternatives section
- Code: `functions/index.js` (Gemini call site)

## History

- **2026-04-25** — Detected by Edmundo Spohr. Registered as debt at the same
  time as ADR-001 was accepted.
