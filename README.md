# Pakumi

Pet health platform — AI veterinary assistant via WhatsApp and emergency QR profiles.

## What it does

1. **Register your pet** — sign in with Google or email, accept the data protection disclaimer, fill in your pet's details.
2. **AI vet on WhatsApp** — message the Twilio sandbox number and get AI-powered health advice (Google Gemini) tailored to your pet.
3. **Emergency QR** — print a QR code for your pet's collar. Anyone who scans it sees emergency contact info and can reach you via WhatsApp.

## Project structure

```
pakumi/
├── web/                         React 19 + TypeScript + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── main.tsx             Entry point
│   │   ├── App.tsx              React Router (/, /register, /dashboard/:petId, /emergency/:petId)
│   │   ├── firebase.ts          Firebase modular SDK init
│   │   ├── index.css            Tailwind v4 theme (brand green, alert red)
│   │   ├── routes/
│   │   │   ├── Landing.tsx      Auth + hero + disclaimer gate
│   │   │   ├── Register.tsx     Pet registration form
│   │   │   ├── Dashboard.tsx    Pet info + WhatsApp + QR
│   │   │   └── Emergency.tsx    Public emergency page (no auth)
│   │   ├── components/
│   │   │   ├── AuthForm.tsx     Google + email/password auth
│   │   │   ├── PetForm.tsx      Pet registration with date picker + phone
│   │   │   ├── QRCode.tsx       QR SVG + PNG download
│   │   │   ├── Layout.tsx       Header, footer, policy link
│   │   │   └── Disclaimer.tsx   Data protection modal (Ley 29733)
│   │   ├── hooks/
│   │   │   ├── useAuth.ts       Firebase auth state
│   │   │   ├── useDisclaimer.ts Disclaimer acceptance check
│   │   │   └── useRole.ts       RBAC role from Firestore
│   │   ├── lib/
│   │   │   └── firestore.ts     Firestore read/write helpers
│   │   └── types/
│   │       └── index.ts         Pet, UserProfile, EmergencyProfile, UserRole
│   ├── dist/                    Build output (served by Firebase Hosting)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── functions/                   Cloud Functions (Node.js) — WhatsApp webhook
├── public/                      Legacy static HTML (kept for reference)
├── firebase.json                Hosting → web/dist, SPA rewrite, function rewrite
├── firestore.rules              Role-based security rules
├── DEPLOY_CHECKLIST.md          Full pre/post-deploy checklist
└── CLAUDE.md                    Developer guide for Claude Code
```

## Getting started

```bash
# Install dependencies
cd web && npm install
cd ../functions && npm install

# Start React dev server
cd web && npm run dev

# Or run Firebase emulators (hosting + functions + firestore)
firebase emulators:start
```

## Build & deploy

```bash
cd web && npm run build          # TypeScript check + Vite build → web/dist/
firebase deploy                  # Deploy hosting + functions + rules
```

See [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) for the full pre/post-deploy verification list.

## Stack

| Layer    | Tech                                           |
| -------- | ---------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4    |
| Backend  | Firebase Cloud Functions (Node.js, JavaScript)  |
| Database | Cloud Firestore                                 |
| Auth     | Firebase Auth (Google + email/password)          |
| RBAC     | Firestore-based roles (owner, partner, admin, superadmin) |
| AI       | Google Gemini via `@google/generative-ai`        |
| Messaging| Twilio WhatsApp Sandbox                          |
| Hosting  | Firebase Hosting                                 |

## Firebase project

Active project: **`pakumi-poc`**. See `.firebaserc`.

## Environment variables

Cloud Functions require a `functions/.env` file (gitignored) with Gemini and Twilio credentials. See `CLAUDE.md` for details.
