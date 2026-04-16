# Pakumi — Deploy Checklist

Target Firebase project: **`pakumi-poc`** (see `.firebaserc`).

## Prerequisites (do these in the Firebase Console once)

- [ ] **Firestore**: create the database at
      https://console.firebase.google.com/project/pakumi-poc/firestore —
      choose **Production mode** and any region (e.g. `southamerica-east1` or
      `us-central1`). Without this step, Firestore reads/writes fail.
- [ ] **Auth providers**: enable **Email/Password** and **Google** at
      https://console.firebase.google.com/project/pakumi-poc/authentication/providers.
- [ ] **Blaze plan**: Cloud Functions require the pay-as-you-go Blaze plan.
      Confirm billing is enabled.
- [ ] `functions/.env` filled with real keys (Gemini + Twilio).

## Build

```bash
cd web && npm install && npm run build
```

Verify the build output:
- [ ] `web/dist/index.html` exists
- [ ] `web/dist/assets/` contains `.js` and `.css` bundles

## Deploy

Run from repo root:

```bash
firebase deploy
```

This pushes hosting + functions + firestore rules in one command. For
faster iteration, use per-target deploys:

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## Post-deploy verification

- [ ] **Landing page**: https://pakumi-poc.web.app loads, shows hero + auth form
- [ ] **Auth**: sign in with Google or email — disclaimer modal appears on first login
- [ ] **Disclaimer**: accept — redirects to /register
- [ ] **Registration**: fill in pet form, submit — redirects to /dashboard/{petId}
- [ ] **Dashboard**: pet info card, WhatsApp instructions, and QR code all render
- [ ] **QR download**: "Descargar QR" button downloads a PNG
- [ ] **Emergency page**: open https://pakumi-poc.web.app/emergency/{petId} in incognito — loads without auth, shows pet name + owner contact button
- [ ] **WhatsApp contact**: "Contactar al dueño" button on emergency page opens wa.me with pre-filled message
- [ ] **WhatsApp agent**: send "join suddenly-shelter" to `+1 (415) 523-8886`, then ask a pet health question — confirm Gemini replies in Spanish
- [ ] **Twilio webhook**: verify "When a message comes in" is set to `https://pakumi-poc.web.app/api/whatsapp` (HTTP POST) at https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
- [ ] **SPA routing**: navigate directly to https://pakumi-poc.web.app/register — should redirect to / if not logged in (not a 404)
- [ ] **Firestore rules**: confirm role-based access — owner can only read own pets, elevated roles can read all

## Known caveats

- **Node engines**: `functions/package.json` declares `"node": ">=20"`. If
  `firebase deploy` rejects the range, pin it to a supported exact version
  (`"20"` or `"22"`).
- **Functions env vars**: `.env` is loaded via `dotenv` at function cold
  start. For long-term prod, migrate secrets to
  `firebase functions:secrets:set GEMINI_API_KEY` and read via
  `defineSecret()`.
- **QR domain**: dashboard QR encodes `https://pakumi-poc.web.app/...`. If
  you point a custom domain at this project, update the QR URL or old
  printed QRs will continue to point to the `web.app` subdomain.
- **RBAC**: roles are checked client-side via Firestore reads. This is
  acceptable for POC but must be hardened with Firebase Custom Claims
  before production (Sprint 4 scope).
