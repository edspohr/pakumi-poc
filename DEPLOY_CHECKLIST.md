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
- [ ] `functions/.env` filled with real keys ✅ (Gemini + Twilio already in place).
- [ ] Sandbox join code updated to `join suddenly-shelter` ✅ (live in
      `public/dashboard.html`).

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

## Post-deploy

- [ ] Twilio Sandbox webhook — set "When a message comes in" to:
      `https://pakumi-poc.web.app/api/whatsapp` (method: HTTP POST)
      at https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
- [ ] Smoke-test: register a pet on the landing page.
- [ ] Smoke-test: send "join suddenly-shelter" to `+1 (415) 523-8886`, then
      ask a pet health question and confirm Gemini replies in Spanish.
- [ ] Smoke-test: scan the dashboard QR and confirm the emergency page loads
      with the right pet + working WhatsApp contact button.

## Known caveats

- **Node engines**: `functions/package.json` declares `"node": ">=20"`. If
  `firebase deploy` rejects the range, pin it to a supported exact version
  (`"20"` or `"22"`).
- **Functions env vars**: `.env` is loaded via `dotenv` at function cold
  start. For long-term prod, migrate secrets to
  `firebase functions:secrets:set GEMINI_API_KEY` and read via
  `defineSecret()` — `.env` works for POC but is not the right home for
  production credentials.
- **QR domain**: dashboard QR encodes `https://pakumi-poc.web.app/...`. If
  you ever point a custom domain at this project, update the QR URL or old
  printed QRs will continue to point to the `web.app` subdomain.
