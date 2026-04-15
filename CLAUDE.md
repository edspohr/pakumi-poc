# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pakumi — a POC pet health platform. **Speed over polish.** Ship the happy path; defer hardening until after the concept is validated.

Active Firebase project: **`pakumi-poc`** (see `.firebaserc`). Created fresh on 2026-04-15.

## Stack

- **Hosting**: plain static HTML/CSS/JS in `public/` served by Firebase Hosting. No build step, no framework, no bundler — edit files and refresh.
- **Backend**: Firebase Cloud Functions in `functions/` (Node.js, JavaScript, no ESLint, no TypeScript). Entry: `functions/index.js`.
- **DB**: Firestore (Native mode). Rules in `firestore.rules`.
- **External APIs**: Twilio (WhatsApp webhook inbound) + Google Gemini (`@google/generative-ai`) for replies. Keys live in `functions/.env` (gitignored, loaded via `dotenv`).

## Commands

All from repo root unless noted.

```bash
# Local dev — emulators (Hosting + Functions + Firestore)
firebase emulators:start

# Install / update functions deps
cd functions && npm install

# Deploy targets individually (don't "deploy all" without reason)
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules

# Tail deployed function logs
firebase functions:log

# Switch/verify active project
firebase use            # show current
firebase use pakumi-poc # set
```

No test suite, no lint config, no CI. Don't add them unless asked.

## Node version mismatch (known)

`functions/package.json` declares `"engines": { "node": "20" }` but the dev machine runs Node 22. npm prints an `EBADENGINE` warning on install — ignore locally. Before first deploy, either install Node 20 (`nvm use 20`) or bump the engines field to `"22"`. Don't silently change it to match whatever's installed; pick deliberately because it locks the deployed runtime.

## Architecture — what's non-obvious

### The two-collection pattern for emergency profiles

There are **two** Firestore collections holding pet data, and this split is load-bearing:

- **`pets/{petId}`** — the full record. Owner-only read/write (enforced by `userId == request.auth.uid` in `firestore.rules`). Can contain medical history, vet notes, anything sensitive.
- **`emergency_profiles/{petId}`** — a **world-readable** subset, written by the owner. Must only ever contain: `name`, `species`, `age`, `condition`, `ownerPhone`, `ownerName`. This is what the public `emergency.html` page reads (no auth — someone scans a QR on a lost pet's tag).

**Never** expose `pets/{petId}` publicly, even field-filtered — Firestore rules can't restrict which fields are returned on a read, only whether the read is allowed at all. That's why the subset is copied into a separate collection. When adding anything to `pets`, decide whether it also belongs in `emergency_profiles` (and write both in the same client call or a Cloud Function).

### Data flow

1. User signs in + registers pet on `index.html` → writes `pets/{petId}` + `emergency_profiles/{petId}`.
2. `dashboard.html` shows a QR code linking to `emergency.html?petId=...`.
3. Public scanner lands on `emergency.html`, which reads `emergency_profiles/{petId}` directly from Firestore (no auth).
4. Separately, owner messages a Twilio WhatsApp number → Twilio webhook hits a Cloud Function → function fetches pet context from Firestore, asks Gemini, replies via Twilio.

The WhatsApp webhook and the web app share Firestore but are otherwise independent. Don't couple them.

### Security rules: deny-by-default

`firestore.rules` ends with a catch-all `match /{document=**} { allow read, write: if false; }`. Any new collection needs an explicit `match` block above that line or all access fails silently in the client. When adding a collection, update the rules in the same change.

## Secrets

`functions/.env` holds live Gemini + Twilio credentials and is gitignored. Never commit it, never echo its contents into responses, never copy values into `functions/index.js` as literals. For production deploys, migrate these to `firebase functions:secrets:set` before going public — `.env` works for local emulators and Gen-2 HTTPS functions but is not the long-term home.
