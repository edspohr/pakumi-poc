# 0018 — Cloud Tasks migration

| Field         | Value                                              |
| ------------- | -------------------------------------------------- |
| **Status**    | resolved                                           |
| **Priority**  | high                                               |
| **Detected**  | 2026-05-01                                         |
| **Resolved**  | 2026-05-01                                         |
| **Owner**     | Edmundo Spohr                                      |
| **Category**  | backend / architecture                             |

## Context

Pakumi webhook processing faces a 15-second hard ceiling from Twilio. If the response exceeds this, Twilio times out, producing ErrorCode 11200 and causing retries that duplicate processing. A previous attempt to resolve this via an async await-after-send pattern on Cloud Functions Gen-1 (see 0017) failed because the platform freezes the process when the HTTP response is sent.

## Impact

When the webhook timeout is exceeded, the user either gets no response or delayed/duplicated responses due to Twilio retries. This affects the core user experience precisely on the most elaborate prompts where generative AI provides the most value. 

## Proposed fix

Migrate the background processing to **Cloud Tasks**. This approach is structurally correct because a Cloud Tasks queue gives at-least-once delivery semantics independent of the webhook HTTP lifecycle. The webhook will simply enqueue the payload and return a 200 OK immediately. A separate queue worker will handle the long-running interaction without risk of being frozen by the Cloud Functions runtime.

*Note: The complete architectural design will be filed in a follow-up document.*

## References

- Related debt: `docs/debt/0017-twilio-async-pattern.md` (the reverted attempt)

## History

- **2026-05-01** — Implemented the queue worker, refactored the webhook to enqueue payloads using `@google-cloud/tasks`, and added idempotency checks in Firestore. Resolved.
