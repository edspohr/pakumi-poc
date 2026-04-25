# ADR-001: Pakumi Platform — Stack & Infrastructure Choices

- **Status:** Accepted
- **Date:** 2026-04-25
- **Deciders:** Edmundo Spohr
- **Supersedes:** —
- **Superseded by:** —

## Context

Pakumi is a proof-of-concept (POC) platform for the veterinary HealthTech
space. Its goal is to validate a concept around pet health management,
emergency profiles accessible via QR, and an AI-assisted WhatsApp channel for
owners to interact with their pet's record.

The work is governed by **Adenda N°1** to the client agreement, signed on
**2026-04-09**, which scopes an **8-week** delivery window with three Hitos
(milestones). Production is currently live at
**https://pakumi-poc.web.app** (Firebase project `pakumi-poc`, created
2026-04-15).

The guiding principle for the POC is **speed over polish**: ship the happy
path, validate the concept with real users, and defer hardening, refactors,
and infrastructure migrations until after concept validation. This ADR
captures the platform choices made under that constraint so that future
contributors understand both what is in place and why each piece is provisional.

## Decision

We adopt the following stack for the duration of the POC:

### Frontend

- **React 19** with **TypeScript**, bundled with **Vite**.
- **Tailwind CSS v4** for styling.
- Application source under `web/`, deployed build artifacts from `web/dist/`.
- Client-side routing via React Router; SPA catch-all rewrite handled by
  Firebase Hosting.

### Backend

- **Firebase Cloud Functions** (Node.js, JavaScript, Gen-2 HTTPS) in
  `functions/`.
- Region: **`us-central1`** for all functions.
- No TypeScript or ESLint on the functions side — kept intentionally minimal
  for POC iteration speed.

### Data & Auth

- **Cloud Firestore** (Native mode) for all persistent state.
- **Firebase Authentication** (Google + email/password providers).
- Two-collection pattern for emergency profiles: `pets/{petId}` (owner-only)
  and `emergency_profiles/{petId}` (world-readable subset). Documented in
  `CLAUDE.md`.
- Deny-by-default Firestore security rules.

### Hosting

- **Firebase Hosting** serves the React build from `web/dist/`.
- A single function rewrite for the WhatsApp webhook (`/api/whatsapp`) is
  declared **before** the SPA catch-all so it is not swallowed by routing.

### Messaging

- **Twilio WhatsApp Sandbox** for the inbound webhook used during the POC.
- Migration to a **production WhatsApp Business sender** is planned for
  **Hito 3** of Adenda N°1.

### AI

- **Google Gemini 2.5 Flash** via the **Google AI (Generative Language) API**
  using the `@google/generative-ai` SDK.
- We are **not** using Vertex AI Gemini at this time. This is recorded as
  technical debt for later evaluation (see Alternatives).

### Secrets

- For local emulators and current Gen-2 HTTPS functions, credentials live in
  `functions/.env` (gitignored).
- Migration to `firebase functions:secrets:set` is planned before any public
  launch.

## Consequences

### Positive

- **Low operational burden.** Firebase covers auth, hosting, database,
  functions, and TLS in a single managed surface — no infrastructure to
  provision, no VMs to patch, no separate identity provider to integrate.
- **Fast iteration.** Vite + React 19 + Tailwind v4 give sub-second HMR; a
  full deploy of hosting + functions takes minutes from a single CLI.
- **Single billing surface** during the POC (Firebase + Twilio + Google AI),
  which is straightforward to forecast and reconcile against Adenda N°1.
- **Path to production exists** for every component without architectural
  rewrites: Twilio Sandbox → WhatsApp Business, Google AI API → Vertex AI,
  `.env` → Firebase Secrets, Functions Gen-2 already in place.

### Negative

- **Twilio Sandbox limitations.** Recipients must opt in by sending a join
  code; numbers and templates are constrained. Cannot be used by external
  test users without onboarding friction. Resolves at Hito 3.
- **Google AI API rate limits and quotas** are lower and less predictable
  than Vertex AI's project-level quotas, with no enterprise SLA. Suitable for
  POC traffic, not for sustained production load.
- **Region lock-in to `us-central1`** means added latency for end users in
  LATAM/EU. Acceptable for POC; revisit if expansion targets a specific
  geography.
- **No CI, no automated tests, no lint config.** Intentional for POC speed,
  but each contributor must self-discipline around manual verification before
  deploy.
- **`functions/.env` is not the long-term secret store.** Acceptable for
  emulators and the current scope, but blocks any public launch as-is.

### Risks

- **Google AI API service changes or quota tightening** could degrade the
  WhatsApp assistant. Mitigated by the planned Vertex AI evaluation.
- **Twilio Sandbox sender restrictions** could block a real-user demo if not
  migrated in time for Hito 3.
- **Firestore rules drift.** New collections that miss an explicit `match`
  block fail silently due to deny-by-default. Mitigated by treating rules
  changes as part of any data-model change.
- **Node engine mismatch** (`functions/package.json` declares Node 20, dev
  machine runs Node 22). Tracked in `CLAUDE.md`; must be reconciled
  deliberately before first production deploy.

## Alternatives Considered

### Monorepo migration to pnpm workspaces

A pnpm-based monorepo would unify dependency management between `web/` and
`functions/` and make shared types (e.g. `Pet`, `EmergencyProfile`) trivial
to share. **Deferred to Sprint 3+** because the current two-package layout is
not yet painful enough to justify the migration cost during the validation
phase, and because monorepo tooling churn would compete with feature work
inside the 8-week window.

### Vertex AI Gemini (instead of Google AI API)

Vertex AI offers higher quotas, project-level IAM, regional deployment,
private networking, and an enterprise SLA — all of which we will eventually
need. **Deferred until cost and/or latency justify the migration.** The
Google AI API SDK is sufficient for POC traffic and lets us iterate on
prompts without provisioning a Vertex endpoint. Recorded as **technical
debt** to be re-evaluated once we have real usage data from Hito 2/3.

### Self-hosted backend (Node + Postgres on a VPS or container platform)

Would give us more control over the data model, schema migrations, and
non-Firestore-shaped queries. **Rejected for the POC** because it would
multiply ops burden (TLS, auth, backups, monitoring) at the exact moment we
need to be moving fastest on product validation.

### Next.js (instead of Vite + React Router)

Server components and built-in routing are attractive, but the POC has no
SSR requirements (the only public page is `/emergency/:petId`, which reads
directly from Firestore). Vite's faster cold starts and simpler mental model
won out for a small SPA.

## Follow-ups

- [ ] **Hito 3:** Migrate Twilio Sandbox → production WhatsApp Business sender.
- [ ] **Pre-public-launch:** Migrate `functions/.env` → `firebase functions:secrets:set`.
- [ ] **Pre-public-launch:** Reconcile Node engine field in `functions/package.json` (20 vs 22) and lock the deployed runtime deliberately.
- [ ] **Post-validation:** Re-evaluate Google AI API → Vertex AI Gemini against real usage and cost data.
- [ ] **Sprint 3+:** Re-evaluate pnpm monorepo migration once shared types between `web/` and `functions/` create real friction.
