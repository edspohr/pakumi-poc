# 0014 — Regex preempt: tolerated false positives

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | low                                |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | Edmundo Spohr                      |
| **Category**  | precision / safety                 |

## Context

The **Capa 3 regex preempt** module
(`functions/safety/emergency-patterns.js`) was designed
**ultra-conservative**: 7 patterns only, accepting some false positives
in exchange for **zero false negatives** on unambiguous emergency
phrasings. When a pattern matches, the webhook skips both the main
agent Gemini call and the Capa 2 classifier and immediately responds
with `EMERGENCY_TEMPLATE_INLINE`.

Two specific false-positive classes were identified during pattern
design and **consciously accepted**:

### Pattern P6 (inconsciencia / desmayo)

```
/\b(se\s+)?(desmay[óoa]|perdi[óo]\s+el\s+conocimiento|no\s+reacciona)\b/
```

Cannot distinguish between **active** fainting ("se desmayó hace 5
minutos") and **historical** reports ("se desmayó cuando era cachorro",
"se desmayó hace meses"). Both trigger the emergency template — the
regex sees only `desmay[óoa]` and has no temporal awareness.

**Why we accepted it:** tightening to present-tense only
(`desmay(a|an)`) would eliminate the FP but lose past-tense recent
emergencies, which ARE actionable ("se desmayó hace 30 segundos" is a
true emergency that the present-tense-only regex would miss).

### Pattern P3 (intoxicación clásica)

```
/\b(comi[óo]|trag[óo]|ingiri[óo]|se\s+comi[óo])\s+(chocolate|veneno|...)\b/
```

Triggers on any past-tense ingestion of a listed toxin, **even when the
user adds mitigating context** ("comió chocolate pero ya lo vomitó y
está bien", "comió chocolate hace una semana sin problemas"). The regex
sees only verb + toxin and has no narrative-context awareness.

**Why we accepted it:** chocolate toxicity (and several other listed
toxins) can have **delayed symptoms** (24–72 h depending on dose and
animal weight). Conservative derivation to a vet is clinically
appropriate even when the owner believes the situation is resolved.

## Impact

Some users will receive the emergency template when they were:

- Reporting **historical** events (P6).
- Adding **mitigating context** that the regex can't see (P3).

**UX cost:** visible friction — the user may react with "no, eso fue
antes, no es urgente." Pakumi looks over-eager.

**Clinical cost: none.** Over-derivation to a vet is safer than
under-derivation. The emergency template recommends professional
evaluation, which is never harmful guidance.

**Estimated frequency:** unknown until production data accumulates.
Likely **rare** relative to true positives — most users describing
genuine emergencies use present tense without temporal qualifiers
("convulsiona", "no respira", "vomita sangre"). The FP-prone patterns
are P3 and P6, not the other five.

## Current workaround

None. Documented in two places:

- **Inline comments** at the affected patterns in
  `functions/safety/emergency-patterns.js` (P3 around line 49, P6
  around lines 113–126) explain the trade-off at the source.
- **Filosofía de diseño** comment block at the end of the module
  generalizes the FP-vs-FN trade-off philosophy.

The Capa 2 classifier *would* provide downstream context awareness for
cases the regex preempts incorrectly — but **only when preempt does NOT
fire**. Preempt skips Capa 2 by design (that's the latency win). So
Capa 2 is not a backstop here.

## Proposed fix

Two evidence-driven options. **Both deferred until production data is
available.**

### (a) Tighten regex with negative look-aheads

Exclude common temporal qualifiers and mitigating phrases:
`(?!.*\bhace\s+(?:un[ao]?s?\s+)?(?:semana|mes|año))`,
`(?!.*\b(?:pero|aunque)\s+(?:ya|sin problema|está bien))`, etc.
Expand the self-test battery to cover the new exclusions.

- Effort: **~2 hours** including expanded self-test cases.
- Trade-off: regex grows in complexity, harder to reason about; new
  exclusion phrases require recurring maintenance as Spanish phrasing
  varies.

### (b) Add a post-preempt context check

A tiny Gemini call (separate from Capa 2's full classifier) that
evaluates **only** whether the regex match was contextually
appropriate. Returns a yes/no with brief reasoning. Adds ~1 s latency
to the preempt path but preserves the ultra-conservative pattern
design.

- Effort: **~3 hours.**
- Trade-off: erases part of Capa 3's latency win, but only on the
  preempt path (rare).

## Trigger for revisiting

Wait for production signal before choosing (a) vs. (b):

- When `safety_classifications` has **≥50 entries with
  `classifierStatus = "preempt_regex"`**, manually audit a sample:
  - Use `userMessageHash` to correlate with raw messages logged in
    `twilio_delivery_status` (or Cloud Logging).
  - Assess the false-positive rate for that sample.
- **If FP rate exceeds 20% →** prioritize fix (a) or (b).
- **If FP rate is below 10% →** defer indefinitely; the trade-off is
  working.
- Between 10–20% → judgment call, look at whether the FPs are
  clustered in P3 vs. P6.

## References

- Code: `functions/safety/emergency-patterns.js` — the philosophy
  block at the end of the file, plus inline comments at patterns P3
  (around line 49) and P6 (around lines 113–126).
- Identified during C.3 implementation by Claude Code, recorded in the
  C.3 verification report ("Step 8 — Things to flag").
- Related debt:
  - [0008 — Emergency templates clinical validation](./0008-emergency-templates-clinical-validation.md)
    — the clinical partner can also help calibrate "what FP rate is
    acceptable" once they review the templates and triggering patterns.
  - [0013 — Classifier override creates history divergence](./0013-classifier-override-history-divergence.md)
    — preempt path also persists a placeholder turn rather than the
    template body, so divergence consideration applies here too.

## History

- **2026-04-25** — Created during C.3 verification by Edmundo Spohr.
  Documented as a known, accepted-by-design limitation of the
  ultra-conservative regex preempt.
