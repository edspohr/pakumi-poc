# Architectural Decision Records (ADRs)

This directory contains the architectural decision records for **Pakumi**.

An ADR captures a single architecturally significant decision: the context
in which it was made, the decision itself, the consequences (both positive
and negative), and the alternatives considered. ADRs are immutable once
**Accepted** — if a decision later changes, write a new ADR that
**Supersedes** the old one rather than rewriting history.

## Index

| ID  | Title                                          | Status   | Date       |
| --- | ---------------------------------------------- | -------- | ---------- |
| 001 | [Pakumi Platform — Stack & Infrastructure Choices](./ADR-001-pakumi-platform.md) | Accepted | 2026-04-25 |
| 002 | [Cloud Tasks for Asynchronous Webhook Processing](./ADR-002-cloud-tasks-webhook.md) | Proposed | 2026-05-01 |

## Conventions

- **Filename:** `ADR-NNN-short-kebab-title.md` (zero-padded three-digit ID).
- **IDs are sequential** and never reused. The next ADR is `ADR-002-…`.
- **Status** is one of: `Proposed`, `Accepted`, `Deprecated`, `Superseded`.
- **Dates** are absolute (ISO `YYYY-MM-DD`), never relative.
- A decision that replaces an earlier one fills in the
  `Superseded by` / `Supersedes` cross-links in both ADRs.

## Template

Each ADR should follow the structure of `ADR-001`:

1. **Header** — Status, Date, Deciders, Supersedes / Superseded by.
2. **Context** — what is true at the time of the decision.
3. **Decision** — what we chose.
4. **Consequences** — positive, negative, and risks.
5. **Alternatives Considered** — what we looked at and why we rejected it.
6. **Follow-ups** — explicit debt or migrations the decision implies.
