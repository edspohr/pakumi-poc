# 0011 — UTC vs Peru time skew in date inference

| Field         | Value                              |
| ------------- | ---------------------------------- |
| **Status**    | open                               |
| **Priority**  | medium                             |
| **Detected**  | 2026-04-25                         |
| **Resolved**  | —                                  |
| **Owner**     | Edmundo Spohr                      |
| **Category**  | correctness / timezone             |

## Context

The `today` anchor used for relative-date inference in `extractHealthData`
(`functions/index.js`) is computed in **UTC**:

```js
const today = new Date();
const todayIso = today.toISOString().slice(0, 10);
```

This anchor is injected into the Gemini extraction prompt and used both to
resolve implicit-year references ("15 de diciembre") and to give Gemini a
reference point for relative dates ("ayer", "la semana pasada").

Pakumi operates in **Peru (UTC-5, no DST)**. The UTC date rolls over five
hours earlier than the Lima calendar date. For messages sent in the
evening Lima time, the function sees a date that is already one day ahead
of what the user perceives as "today."

## Impact

Health events extracted from messages with **relative dates** may be
stored with dates **one day earlier than intended**, when the message is
sent between roughly **7 PM and midnight Lima time**.

Concretely:

- Message at 22:00 Lima on April 25 → function sees UTC date April 26 →
  Gemini is told "today is 2026-04-26" → "ayer" resolves to 2026-04-25
  (which the user *did* mean — actually fine in this direction).
- The skew bites the *opposite* direction near boundaries the user thinks
  in: e.g. user sends "ayer" at 22:00 Lima on Sunday Jan 4 thinking of
  Saturday Jan 3, but the function's UTC clock already says Monday Jan 5,
  so "ayer" resolves to Sunday Jan 4 — wrong.

Bounded blast radius:

- **Does NOT affect explicit dates** ("15 de enero", "el 3 de febrero").
  Those go through the same year-clamp logic but are not anchored to "today."
- **Does NOT affect events with `eventDateConfidence: "high"`.** Only the
  `"medium"` (relative) and `"low"` (defaulted-to-today) branches are
  affected.
- Maximum error magnitude: **±1 day**.
- Likely most messages arrive during business hours (well inside the safe
  window), so the practical incidence is low.

## Current workaround

None. Tolerated for the POC phase. The error is bounded to ±1 day and
mostly affects late-evening messaging, which is the minority of traffic
based on expected usage.

## Proposed fix

Compute the `today` anchor in **`America/Lima`** timezone instead of UTC.
Two options:

**(a) `Intl.DateTimeFormat` with `timeZone`:**

```js
const todayIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
// "en-CA" gives YYYY-MM-DD format without manual stitching.
```

Robust to any future tzdata revisions (e.g. if Peru ever adopts DST).
Slightly more verbose. Requires deriving `currentYear` and `yesterdayIso`
the same way (or once we have the local date string, parse it back).

**(b) Hardcode `UTC-5` offset:**

```js
const today = new Date(Date.now() - 5 * 60 * 60 * 1000);
const todayIso = today.toISOString().slice(0, 10);
```

Simpler, fewer characters, but baked-in assumption that Peru's offset
never changes. Peru has not observed DST in over a century, so this is
*reasonable* but not future-proof.

**Recommendation:** option **(a)**. The robustness is worth the few extra
lines, and `Intl.DateTimeFormat` is built into Node 22 with no
dependency cost.

Effort: **S** (~1 hour including a manual test exercising the
late-evening case against the emulator).

**Trigger to start:** any future touch to the extraction date logic, or
the first observed misattribution incident in the
`extraction.low_confidence` audit log (added in HC-05a).

## References

- Code: `functions/index.js` — `extractHealthData()` function, the
  `today` / `todayIso` / `currentYear` / `yesterdayIso` block.
- Identified by Claude Code during B.3 (HC-05a fix) verification
  walk-through. Discussed in chat with Edmundo on **2026-04-25**.
- Related fix: HC-05a (multi-event date assignment) — the change that
  introduced the explicit `today` anchor in the first place.
- Related debt: [0009 — Fallback message recovery](./0009-fallback-message-recovery.md)
  (also surfaced via in-flight production-reasoning during a fix).

## History

- **2026-04-25** — Created by Edmundo Spohr during HC-05a fix
  verification. Surfaced as a known limitation of the UTC-based `today`
  anchor introduced by that fix, with bounded ±1 day impact.
