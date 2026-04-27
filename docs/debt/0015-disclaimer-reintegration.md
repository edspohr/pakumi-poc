# Debt 0015 — Disclaimer flow reintegration

**Status:** open
**Priority:** medium
**Created:** 2026-04-26
**Target resolution:** Sprint 3 (semana 1, antes de testing con clínicos)
**Compliance impact:** Ley N°29733 (Perú) — Protección de Datos Personales

## Context

The Disclaimer flow was originally integrated in Landing.tsx and required users
to accept the data protection disclaimer (per Peru's Ley 29733) before
registering a pet. During Sprint 2 we hit a redirect-loop bug where:

1. User signs in → Landing
2. Landing fires ensureUserProfile + getUserPets in parallel useEffects
3. Disclaimer modal appears
4. User accepts → re-render → useEffects fire again under React StrictMode
5. Pet lookup races with profile creation → intermittent loop back to /register
   even when a pet existed

Rather than ship a half-fixed flow under time pressure for Hito 2 cierre, we
deferred reintegration. Commit 3909dc0 simplified the routing to:

- Landing: auth-only state machine (no disclaimer, no pet lookup)
- Register: pet lookup + redirect to existing pet's dashboard if found
- PetForm: ensureUserProfile call moved here (uses merge:true now)

The Disclaimer.tsx component and useDisclaimer.ts hook remain in the codebase
intact — they are not dead code, they are deferred wiring.

## Why this matters

Ley 29733 requires explicit informed consent for processing personal data of
Peruvian users. Pakumi collects:

- Pet health data (sensitive by association — owner identification possible)
- Owner WhatsApp number, name, email
- Conversational data with the AI agent (medical context)

Without the disclaimer flow active, we are technically out of compliance for
public production use. We are NOT out of compliance for current state because:

- App is in sandbox/testing only (no public users)
- Current testers are the Pakumi team itself (Betsy, Patty, Mily) — owners,
  not third parties
- Pakumi is aware and has accepted this temporarily (via Sprint Review #2,
  2026-04-27)

Before any of these triggers, the disclaimer MUST be reintegrated:

1. Public access to pakumi-poc.web.app for non-Pakumi users
2. Onboarding of clinical reviewers / non-team testers
3. Production deploy on registered Twilio number (Hito 3)

## Resolution plan

### Phase 1: Diagnose the redirect loop (estimated: 2-3h)

The original bug was likely caused by:

- React StrictMode double-mounting useEffects
- ensureUserProfile and disclaimer accept both writing to users/{uid}
  without merge:true → race condition overwrites
- getUserPets returning stale empty array on first call

The merge:true fix (commit 3909dc0) addresses the second issue. The first
should be diagnosed with explicit logging in StrictMode.

### Phase 2: Rewire disclaimer correctly (estimated: 3-4h)

Recommended architecture:

- Disclaimer modal lives in Register.tsx (not Landing) — single source of
  truth for new-user onboarding
- Block PetForm submission until accepted=true
- Persist disclaimer acceptance via existing acceptDisclaimer() in firestore.ts
- Add E2E test: sign-up → disclaimer modal → accept → form unlocks → submit

### Phase 3: Add periodic re-acceptance check (estimated: 1-2h, optional)

Per Ley 29733 best practice, re-prompt acceptance annually or when terms
change. Implementation: add `disclaimerVersion` field to users/{uid} and
compare against current version constant in code.

## Acceptance criteria

- [ ] Disclaimer modal blocks pet registration for users without
      acceptedDisclaimer=true
- [ ] No redirect loop on sign-up → accept → register flow
- [ ] StrictMode-safe (test by enabling and verifying single fetch)
- [ ] Disclaimer version field present for future re-prompts
- [ ] Manual test passes for: new user, returning user with acceptance,
      returning user without acceptance (legacy data)
- [ ] Documented in commit message that ties back to this debt item

## Related

- Original integration commit: (Sprint 1, prior to migration to React)
- Deferral commit: 3909dc0
- Disclaimer.tsx: web/src/components/Disclaimer.tsx (intact, not used)
- useDisclaimer.ts: web/src/hooks/useDisclaimer.ts (intact, not called by
  any current route)
