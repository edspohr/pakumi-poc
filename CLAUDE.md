# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pakumi — a POC pet health platform. **Speed over polish.** Ship the happy path; defer hardening until after the concept is validated.

Active Firebase project: **`pakumi-poc`** (see `.firebaserc`). Created fresh on 2026-04-15.

## Stack

- **Frontend (active)**: React 19 + TypeScript + Vite + Tailwind CSS v4 in `web/`. Firebase Hosting serves the built output from `web/dist`. Run `cd web && npm run dev` for local dev (Vite on port 5173).
- **Frontend (legacy)**: static HTML/CSS/JS in `public/`. No longer served by Firebase Hosting (see `firebase.json`), but kept for reference during migration. Will be removed once React app reaches parity.
- **Backend**: Firebase Cloud Functions in `functions/` (Node.js, JavaScript, no ESLint, no TypeScript). Entry: `functions/index.js`.
- **DB**: Firestore (Native mode). Rules in `firestore.rules`.
- **External APIs**: Twilio (WhatsApp webhook inbound) + Google Gemini (`@google/generative-ai`) for replies. Keys live in `functions/.env` (gitignored, loaded via `dotenv`).

## Commands

All from repo root unless noted.

```bash
# --- React app (web/) ---
cd web && npm install          # Install deps
cd web && npm run dev          # Vite dev server (localhost:5173)
cd web && npm run build        # Production build → web/dist/
cd web && npx tsc --noEmit     # Type-check without emitting

# --- Cloud Functions ---
cd functions && npm install

# --- Firebase ---
firebase emulators:start       # Emulators (Hosting + Functions + Firestore)
firebase deploy --only hosting # Deploy web/dist to Firebase Hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase functions:log         # Tail deployed function logs
firebase use                   # Show current project
firebase use pakumi-poc        # Set project
```

No test suite, no lint config, no CI. Don't add them unless asked.

## Web app structure (`web/src/`)

```
main.tsx                     Entry point
App.tsx                      React Router (/, /register, /dashboard/:petId, /emergency/:petId)
firebase.ts                  Modular v10 SDK init
index.css                    Tailwind v4 theme (brand green, alert red)
types/index.ts               Pet & EmergencyProfile interfaces
hooks/useAuth.ts             Auth state hook: { user, loading, signOut }
lib/firestore.ts             Firestore read/write helpers (getPet, getEmergencyProfile, registerPet)
routes/Landing.tsx            Auth page → redirects to /register when logged in
routes/Register.tsx           Pet form → redirects to / when not authed
routes/Dashboard.tsx          Pet info + WhatsApp + QR → redirects to / when not authed
routes/Emergency.tsx          Public emergency profile (NO auth required)
components/AuthForm.tsx       Google + email/password (register/login toggle)
components/PetForm.tsx        Pet registration with country-code phone picker
components/QRCode.tsx         QR SVG via qrcode.react + PNG download
components/Layout.tsx         Shared header + sign-out
```

### Routing and auth guards

- `/emergency/:petId` is the **only** public route (no auth). All others redirect unauthenticated users to `/`.
- `firebase.json` has a SPA catch-all rewrite (`** → /index.html`) so that React Router handles all paths. The `/api/whatsapp` function rewrite is listed **before** the catch-all so it still hits the Cloud Function.

## Node version mismatch (known)

`functions/package.json` declares `"engines": { "node": "20" }` but the dev machine runs Node 22. npm prints an `EBADENGINE` warning on install — ignore locally. Before first deploy, either install Node 20 (`nvm use 20`) or bump the engines field to `"22"`. Don't silently change it to match whatever's installed; pick deliberately because it locks the deployed runtime.

## Architecture — what's non-obvious

### The two-collection pattern for emergency profiles

There are **two** Firestore collections holding pet data, and this split is load-bearing:

- **`pets/{petId}`** — the full record. Owner-only read/write (enforced by `userId == request.auth.uid` in `firestore.rules`). Can contain medical history, vet notes, anything sensitive.
- **`emergency_profiles/{petId}`** — a **world-readable** subset, written by the owner. Must only ever contain: `name`, `species`, `age`, `condition`, `ownerPhone`, `ownerName`. This is what the public `emergency.html` page reads (no auth — someone scans a QR on a lost pet's tag).

**Never** expose `pets/{petId}` publicly, even field-filtered — Firestore rules can't restrict which fields are returned on a read, only whether the read is allowed at all. That's why the subset is copied into a separate collection. When adding anything to `pets`, decide whether it also belongs in `emergency_profiles` (and write both in the same client call or a Cloud Function).

### Data flow

1. User signs in at `/` → redirected to `/register` → registers pet → writes `pets/{petId}` + `emergency_profiles/{petId}` (batched) → redirected to `/dashboard/:petId`.
2. `/dashboard/:petId` shows pet info, WhatsApp instructions, and a QR code linking to `/emergency/:petId`.
3. Public scanner lands on `/emergency/:petId`, which reads `emergency_profiles/{petId}` directly from Firestore (no auth).
4. Separately, owner messages a Twilio WhatsApp number → Twilio webhook hits a Cloud Function → function fetches pet context from Firestore, asks Gemini, replies via Twilio.

The WhatsApp webhook and the web app share Firestore but are otherwise independent. Don't couple them.

### WhatsApp webhook async response pattern

The webhook does **not** return TwiML message bodies. Inbound flow:

1. Twilio POST → handler parses body, validates `From`/`Body`.
2. Handler responds 200 OK with empty `<Response/>` immediately.
3. Same handler then awaits `processAndRespond()` which runs the full pipeline (Capa 3 → Gemini main → Capa 2 → reply delivery via `twilioClient.messages.create`).

This decouples Gemini latency from Twilio's 15s webhook timeout. If Gemini takes >5s, an intermediate "Estoy procesando tu consulta..." message is sent via `messages.create` while the agent finishes thinking. Suppressed for the Capa 3 regex-preempt path; not suppressed for Capa 2 emergency overrides (the override happens after Gemini returns, so the intermediate may have already fired). See `docs/debt/0017-twilio-async-pattern.md` for the migration rationale and trade-offs.

Why **await-after-send**, not detached fire-and-forget: Cloud Functions Gen-1 may reap the instance once the handler returns; detached promises started after `res.send()` can be silently dropped. Awaiting inside the handler keeps the instance alive while still flushing the ack first.

### Security rules: deny-by-default

`firestore.rules` ends with a catch-all `match /{document=**} { allow read, write: if false; }`. Any new collection needs an explicit `match` block above that line or all access fails silently in the client. When adding a collection, update the rules in the same change.

## Secrets

`functions/.env` holds live Gemini + Twilio credentials and is gitignored. Never commit it, never echo its contents into responses, never copy values into `functions/index.js` as literals. For production deploys, migrate these to `firebase functions:secrets:set` before going public — `.env` works for local emulators and Gen-2 HTTPS functions but is not the long-term home.

## Technical debt tracking

Architectural decisions live in `docs/decisions/` (ADRs) and known technical debt lives in `docs/debt/` — one numbered file per item, indexed in `docs/debt/README.md`, structured per `docs/debt/TEMPLATE.md`.

At the end of each coding session, evaluate whether new technical debt was introduced or existing debt was resolved. Update `docs/debt/` accordingly with new numbered files following the `TEMPLATE.md` structure. Resolved items keep their file (mark as resolved, do not delete) for audit trail.
