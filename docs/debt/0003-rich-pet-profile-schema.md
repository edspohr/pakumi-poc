# 0003 — Rich pet profile schema

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | high                               |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | unassigned                         |
| **Category**  | data                               |

## Context

The current `Pet` profile (see `web/src/types/index.ts` and the form in
`web/src/components/PetForm.tsx`) captures only the minimum needed for the
emergency QR flow: name, species, age, condition, owner phone, owner name.

The WhatsApp assistant reads this same record to ground its replies via
Gemini. With only the emergency-shaped fields available, the model has no
veterinary depth to draw on — it cannot reason about vaccination status,
chronic conditions, current medications, the treating vet's contact, the
animal's temperament, or feeding protocol.

This is a **product-level** gap: any serious veterinary HealthTech use case
(triage, reminders, owner education, vet handoff) needs a richer schema
than what we have today.

## Impact

- **Limits assistant quality.** The LLM cannot give clinically meaningful
  guidance without history; replies are generic and risk feeling unhelpful
  to real owners.
- **Blocks Hito 2/3 demos.** Any demo that goes beyond "owner messages and
  gets a polite reply" will expose the missing fields.
- **Forces rework later.** Every week we keep the thin schema, more
  downstream code (rendering, prompts, emergency-profile copy logic) hardens
  around the wrong shape.

This is the highest-priority debt item currently registered.

## Current workaround

The assistant works with whatever fields are present and degrades gracefully
when context is thin. There is no synthetic enrichment.

## Proposed fix

Schema work must be **clinically validated** — we should not invent fields
ourselves. The unblocking step is:

1. **Engage a clinical veterinarian validation partner** to define the
   minimum responsible schema for a pet profile in a primary-care context.
2. From that, design Firestore document shapes for `pets/{petId}` (full
   record) and decide which subset, if any, additionally lands in
   `emergency_profiles/{petId}` — keeping in mind the public visibility
   constraint documented in `CLAUDE.md`.
3. Update `PetForm.tsx`, the type definitions, and the WhatsApp prompt
   construction in `functions/index.js` together.
4. Plan a backfill / re-prompt path for pets registered under the thin
   schema.

Effort: **L**. Schema is the biggest decision; implementation is moderate.

**Status note:** Currently **blocked on partner**. Track the partner
engagement separately; this entry stays `open` until the schema is defined.

## References

- ADR: [`docs/decisions/ADR-001-pakumi-platform.md`](../decisions/ADR-001-pakumi-platform.md)
- Code: `web/src/types/index.ts`, `web/src/components/PetForm.tsx`,
  `web/src/lib/firestore.ts`, `functions/index.js`
- Related debt: [0001 — Vertex AI migration](./0001-vertex-ai-migration.md)
  (richer prompts will increase token volume; informs Vertex evaluation timing)

## History

- **2026-04-25** — Detected by Edmundo Spohr. Flagged as the highest-priority
  open debt item; blocked on clinical veterinarian validation partner.
