# ADR-002: Cloud Tasks for Asynchronous Webhook Processing

- **Status:** Proposed
- **Date:** 2026-05-01
- **Deciders:** Edmundo Spohr
- **Supersedes:** —
- **Superseded by:** —

## Context

Pakumi's WhatsApp integration relies on a Twilio webhook. Twilio enforces a hard 15-second timeout for the HTTP response. If the response exceeds 15 seconds, Twilio logs an ErrorCode 11200 ("HTTP retrieval failure") and retries the webhook, leading to duplicated AI processing and generic technical errors shown to the user.

Debt `0017` attempted to solve this by immediately returning a `200 OK` and using an `await` pattern for the background work. This failed in production because Cloud Functions Gen-1 freezes CPU allocation immediately upon sending the HTTP response (`res.send()`), pausing the background promise indefinitely.

We need a structurally sound way to acknowledge the webhook instantly while reliably executing the multi-step generative AI pipeline in the background.

## Decision

We will migrate background processing to **Google Cloud Tasks**.

1. **Webhook Handler (`/api/whatsapp`)**:
   - Parses and validates the incoming Twilio webhook (including signature validation).
   - Enqueues a task to a dedicated Cloud Tasks queue with the parsed payload.
   - Immediately returns a `200 OK` empty TwiML response.
2. **Queue Worker (`processWhatsAppTask`)**:
   - Implemented as an HTTP-triggered Cloud Function, specifically configured to receive Cloud Tasks.
   - Checks Firestore for idempotency (using Twilio's `MessageSid`) to handle at-least-once delivery duplicates.
   - Executes the existing Gemini pipeline (Capa 3 → Gemini → Capa 2).
   - Delivers all outbound messages (including the intermediate "still thinking" message) via the asynchronous `messages.create` API.

## Consequences

### Positive

- **Eliminates Twilio Timeouts:** The webhook acknowledges Twilio within milliseconds.
- **Reliable Execution:** Cloud Tasks provides robust at-least-once delivery, ensuring no messages are lost due to container reaping or CPU freezes.
- **Configurable Retries:** We can configure exponential backoff and maximum retry attempts for the worker pipeline.

### Negative

- **Infrastructure Complexity:** Requires provisioning a Cloud Tasks queue and managing its IAM permissions.
- **Idempotency Overhead:** Cloud Tasks guarantees "at-least-once" delivery, meaning the worker must track processed `MessageSid`s in Firestore to prevent sending duplicate replies if a task is delivered twice.

## Alternatives Considered

- **Fire-and-forget Promises:** Attempted in debt `0017` and failed due to Gen-1 CPU freeze behavior.
- **Cloud Pub/Sub:** Rejected because Pub/Sub is designed for event fan-out (many-to-many), whereas Cloud Tasks is optimized for targeted point-to-point execution with better rate-limiting and scheduling controls.
- **Cloud Functions Gen-2 "Always On" CPU:** Gen-2 allows configuring CPU to remain active after the response. Rejected because it incurs higher baseline costs and is an anti-pattern for handling long-running, retryable background jobs.

## Follow-ups

- [ ] **Infrastructure:** Provision the Cloud Tasks queue (`whatsapp-processing-queue`).
- [ ] **Implementation:** Refactor `functions/index.js` to split the webhook and worker functions.
- [ ] **State Tracking:** Implement `MessageSid` idempotency checks in the conversation document.
- [ ] **Index Update:** Update `docs/decisions/README.md` to include ADR-002.
