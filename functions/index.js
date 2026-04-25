/**
 * Pakumi WhatsApp webhook — timeout architecture
 * ──────────────────────────────────────────────
 * Twilio's inbound webhook gives us roughly 15 seconds to return TwiML
 * before it considers the webhook failed and the user sees nothing. Our
 * Cloud Function timeout is the much looser default of 60s, so the binding
 * constraint is Twilio's, not ours.
 *
 * Inside that 15s budget we must cover:
 *   - Cold start (~1–3s on Gen-2 HTTPS)
 *   - Firestore reads (pet doc + conversation doc): typically <500ms
 *   - Gemini reply generation: variable, normally 2–6s but can spike
 *   - TwiML serialization + response: <100ms
 *
 * The Gemini call is the only step that can blow the budget, so we cap it
 * at GEMINI_REPLY_TIMEOUT_MS (8s) using AbortController + Promise.race. On
 * timeout we return FALLBACK_REPLY (Spanish, mentions vet for emergencies)
 * and persist the user's incoming message so the next exchange retains
 * context (the assistant turn is left empty by design).
 *
 * Delivery observability: the TwiML <Message> includes a statusCallback
 * pointing at the twilioStatusCallback endpoint (separate handler, minimal
 * logic), which logs each Twilio status transition into the
 * twilio_delivery_status Firestore collection for post-mortem.
 *
 * Status callback URL must be set via environment before deploy:
 *   firebase functions:config:set twilio.status_callback_url=...
 * (or as TWILIO_STATUS_CALLBACK_URL in functions/.env for emulators)
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// ── Timeout / fallback budget (see header comment) ──────────────────
const GEMINI_REPLY_TIMEOUT_MS = 8000;
const FALLBACK_REPLY =
  "Estoy procesando tu consulta, dame un momento más y te respondo en breve. Si es una emergencia, contacta directamente a tu veterinario.";

// ── Lazy-loaded dependencies ────────────────────────────────────────
// dotenv and @google/generative-ai are heavy at require() time.
// Defer them to first invocation so the function passes the 10s cold-start gate.

let _envLoaded = false;
function ensureEnv() {
  if (_envLoaded) return;
  require("dotenv").config();
  _envLoaded = true;
}

let _genAI = null;
function getGenAI() {
  if (!_genAI) {
    ensureEnv();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

function getGeminiModel() {
  return getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractPhone(from) {
  if (!from) return null;
  return String(from).replace(/^whatsapp:/i, "").trim();
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function twiml(message) {
  ensureEnv();
  const callbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL || "";
  const cbAttr = callbackUrl
    ? ` statusCallback="${escapeXml(callbackUrl)}"`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message${cbAttr}>${escapeXml(message)}</Message></Response>`;
}

function shortHash(s) {
  if (!s) return null;
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
}

// ── Prompt builders ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a friendly, knowledgeable veterinary AI assistant called "Pakumi". You provide helpful guidance about pet health, but always remind users to consult a real veterinarian for serious concerns.

Greeting policy:
- If this is the FIRST message in the conversation, introduce yourself briefly: "Hola [ownerName]! Soy Pakumi, tu asistente veterinario de cabecera 🐾". Then answer their question.
- If this is a FOLLOW-UP message (there is conversation history), do NOT re-introduce yourself. Just greet casually with "Hola [ownerName]!" or skip the greeting entirely if the conversation is flowing naturally, and go straight to answering their question. Give continuity to the conversation.`;

function buildPetProfile(pet) {
  return `Patient profile:
- Name: ${pet.name}
- Species: ${pet.species}
- Breed: ${pet.breed || "No especificada"}
- Age: ${pet.age || "No especificada"}
- Weight: ${pet.weight || "No especificado"}
- Known conditions/allergies: ${pet.condition || "Ninguna reportada"}
- Owner: ${pet.ownerName}`;
}

function buildConversationPrompt(pet, history, summary, messageBody, isFirstMessage) {
  let prompt = SYSTEM_PROMPT + "\n\n" + buildPetProfile(pet);

  if (summary) {
    prompt += `\n\nHealth summary from previous conversations:\n${summary}`;
  }

  if (history.length > 0) {
    prompt += "\n\nRecent conversation:";
    for (const msg of history) {
      const label = msg.role === "user" ? "Owner" : "Pakumi";
      prompt += `\n${label}: ${msg.content}`;
    }
  }

  if (isFirstMessage) {
    prompt += `\n\nConversation stage: FIRST message — introduce yourself per the greeting policy.`;
  } else {
    prompt += `\n\nIMPORTANTE: Esta NO es la primera interacción de la conversación. NO uses saludos de apertura como 'Hola', 'Buenos días', '¡Hola!', '¿Cómo estás?' u otras fórmulas de bienvenida. Responde directamente al contenido del mensaje del usuario.`;
  }

  prompt += `\n\nThe owner is asking you the following question. Respond in Spanish, be concise (max 300 words), warm, and helpful. If the question suggests an emergency, strongly recommend visiting a vet immediately.

Owner's message: ${messageBody}`;

  return prompt;
}

// ── Conversation persistence ────────────────────────────────────────

/**
 * Find or create a conversation doc for the given phone + petId.
 * Doc ID is the phone number (one conversation per phone/pet pair).
 */
async function getConversation(phone, petId) {
  const snap = await db
    .collection("conversations")
    .where("ownerPhone", "==", phone)
    .where("petId", "==", petId)
    .limit(1)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
}

function getLastNPairs(messages, n) {
  // Return the last n user+assistant pairs (2n messages).
  // Messages are in chronological order.
  const pairs = n * 2;
  if (messages.length <= pairs) return messages;
  return messages.slice(-pairs);
}

async function saveConversation(convId, phone, petId, messages, summary) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const data = {
    petId,
    ownerPhone: phone,
    messages,
    summary: summary || "",
    lastMessageAt: now,
    messageCount: messages.length,
  };

  if (convId) {
    await db.collection("conversations").doc(convId).set(data, { merge: true });
    return convId;
  } else {
    const ref = await db.collection("conversations").add(data);
    return ref.id;
  }
}

// ── Summary generation ──────────────────────────────────────────────

async function generateSummary(model, pet, messages) {
  const transcript = messages
    .map((m) => {
      const label = m.role === "user" ? "Dueño" : "Pakumi";
      return `${label}: ${m.content}`;
    })
    .join("\n");

  const prompt = `Analyze this veterinary conversation about ${pet.name} (${pet.species}) and extract key health information. Create a concise summary in Spanish including: reported symptoms, medications mentioned, vet visits, behavioral changes, and any concerns.

Conversation:
${transcript}

Respond with the summary only, no headers or formatting. Be concise (max 150 words).`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text && text.trim() ? text.trim() : "";
  } catch (err) {
    functions.logger.error("Summary generation error", err);
    return "";
  }
}

// ── Smart extraction pipeline ───────────────────────────────────────

const VALID_EVENT_TYPES = [
  "symptom",
  "medication",
  "vaccine",
  "vet_visit",
  "weight",
  "diet_change",
  "behavior",
];
const VALID_SEVERITIES = ["low", "medium", "high"];
const VALID_REMINDER_TYPES = ["vaccine", "medication", "vet_visit"];
const VALID_GROOMING_TYPES = ["bath", "haircut", "nails", "dental", "other"];

function parseExtractionJSON(raw) {
  let text = (raw || "").trim();
  // Strip markdown code fences if present.
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(text);
}

function sanitizeEvent(evt) {
  if (!evt || typeof evt !== "object") return null;
  const type = VALID_EVENT_TYPES.includes(evt.type) ? evt.type : null;
  if (!type) return null;
  const description =
    typeof evt.description === "string" && evt.description.trim()
      ? evt.description.trim()
      : null;
  if (!description) return null;

  const severity = VALID_SEVERITIES.includes(evt.severity)
    ? evt.severity
    : null;
  const date =
    typeof evt.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(evt.date)
      ? evt.date
      : null;

  return { type, description, severity, date };
}

function sanitizeGrooming(g) {
  if (!g || typeof g !== "object") return null;
  const type = VALID_GROOMING_TYPES.includes(g.type) ? g.type : null;
  if (!type) return null;
  const notes =
    typeof g.notes === "string" && g.notes.trim() ? g.notes.trim() : "";
  const date =
    typeof g.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.date)
      ? g.date
      : null;
  const provider =
    typeof g.provider === "string" && g.provider.trim()
      ? g.provider.trim()
      : null;
  return { type, notes, date, provider };
}

function sanitizeReminder(rem) {
  if (!rem || typeof rem !== "object") return null;
  const type = VALID_REMINDER_TYPES.includes(rem.type) ? rem.type : null;
  if (!type) return null;
  const description =
    typeof rem.description === "string" && rem.description.trim()
      ? rem.description.trim()
      : null;
  if (!description) return null;

  const suggestedDate =
    typeof rem.suggestedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(rem.suggestedDate)
      ? rem.suggestedDate
      : null;

  return { type, description, suggestedDate };
}

async function extractHealthData(model, pet, userMessage, assistantResponse, petId) {
  const prompt = `You are a veterinary data extraction system. Analyze this veterinary conversation exchange about ${pet.name} (${pet.species}) and extract structured health data. Respond ONLY with valid JSON, no other text.

Owner's message: "${userMessage}"
Assistant's response: "${assistantResponse}"

Extract:
{
  "events": [
    {
      "type": "symptom" | "medication" | "vaccine" | "vet_visit" | "weight" | "diet_change" | "behavior",
      "description": "brief description in Spanish",
      "severity": "low" | "medium" | "high" | null,
      "date": "YYYY-MM-DD or null if not mentioned"
    }
  ],
  "shouldRemind": {
    "type": "vaccine" | "medication" | "vet_visit" | null,
    "description": "what to remind about in Spanish",
    "suggestedDate": "YYYY-MM-DD or null"
  },
  "grooming": {
    "type": "bath" | "haircut" | "nails" | "dental" | "other" | null,
    "notes": "brief description in Spanish",
    "date": "YYYY-MM-DD or null",
    "provider": "groomer/salon name or null"
  }
}

Rules:
- Only extract real health data. Do not extract greetings, general questions, or small talk.
- "events" should be an empty array if nothing health-related was discussed.
- "shouldRemind" should have type: null if no reminder is needed.
- "grooming" should have type: null if no grooming activity was discussed.
- Grooming keywords: baño, bañar, peluquería, corte de pelo, uñas, limpieza dental, grooming, peluquero.
- severity: "high" for emergencies/urgent symptoms, "medium" for concerning but not urgent, "low" for routine/minor.
- Descriptions must be in Spanish.

Examples:
- "Mi perro vomitó 3 veces hoy" → events: [{type:"symptom", description:"Vómitos (3 episodios)", severity:"medium", date:null}], grooming: {type:null}
- "Llevé a mi gato a bañar hoy en PetClean" → events: [], grooming: {type:"bath", notes:"Baño en peluquería", date:null, provider:"PetClean"}
- "Le cortaron las uñas y le hicieron limpieza dental" → events: [], grooming: {type:"nails", notes:"Corte de uñas y limpieza dental", date:null, provider:null}
- "Hola, quería preguntar algo" → events: [], shouldRemind: {type:null}, grooming: {type:null}`;

  let parsed;
  try {
    const result = await model.generateContent(prompt);
    parsed = parseExtractionJSON(result.response.text());
  } catch (err) {
    functions.logger.warn("Health data extraction failed to parse", err);
    return;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  let writes = 0;

  // ── Health events ──
  const events = Array.isArray(parsed.events) ? parsed.events : [];
  const eventsRef = db
    .collection("health_events")
    .doc(petId)
    .collection("events");

  for (const raw of events) {
    const evt = sanitizeEvent(raw);
    if (!evt) continue;
    batch.set(eventsRef.doc(), {
      type: evt.type,
      description: evt.description,
      severity: evt.severity,
      date: evt.date,
      reportedAt: now,
      source: "whatsapp",
    });
    writes++;
  }

  // ── Reminder ──
  const reminder = sanitizeReminder(parsed.shouldRemind);
  if (reminder) {
    const remindersRef = db
      .collection("reminders")
      .doc(petId)
      .collection("pending");
    batch.set(remindersRef.doc(), {
      type: reminder.type,
      description: reminder.description,
      scheduledDate: reminder.suggestedDate,
      status: "pending",
      createdAt: now,
    });
    writes++;
  }

  // ── Grooming ──
  const grooming = sanitizeGrooming(parsed.grooming);
  if (grooming) {
    const groomingRef = db
      .collection("grooming_records")
      .doc(petId)
      .collection("sessions");
    batch.set(groomingRef.doc(), {
      petId,
      userId: pet.userId,
      type: grooming.type,
      notes: grooming.notes,
      date: grooming.date || new Date().toISOString().split("T")[0],
      provider: grooming.provider || null,
      source: "whatsapp",
      createdAt: now,
    });
    writes++;
  }

  if (writes > 0) {
    try {
      await batch.commit();
      functions.logger.info("Extraction pipeline saved", {
        petId,
        events: writes - (reminder ? 1 : 0) - (grooming ? 1 : 0),
        reminder: !!reminder,
        grooming: !!grooming,
      });
    } catch (err) {
      functions.logger.error("Extraction pipeline batch commit error", err);
    }
  }
}

// ── Main webhook ────────────────────────────────────────────────────

const MAX_MESSAGES = 20;
const SUMMARY_INTERVAL = 10;

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  res.set("Content-Type", "text/xml");

  try {
    let body = req.body;
    if (typeof body === "string") {
      body = Object.fromEntries(new URLSearchParams(body));
    } else if (Buffer.isBuffer(body)) {
      body = Object.fromEntries(new URLSearchParams(body.toString("utf8")));
    }
    body = body || {};

    const from = body.From;
    const messageBody = body.Body;

    if (!from || !messageBody) {
      functions.logger.warn("Missing From or Body", {
        hasFrom: !!from,
        hasBody: !!messageBody,
      });
      return res
        .status(200)
        .send(twiml("No recibimos tu mensaje correctamente. Intenta de nuevo."));
    }

    const phone = extractPhone(from);
    functions.logger.info("Incoming WhatsApp", {
      phone,
      profileName: body.ProfileName,
    });

    // Find the pet for this phone number.
    const petSnap = await db
      .collection("pets")
      .where("ownerPhone", "==", phone)
      .limit(1)
      .get();

    if (petSnap.empty) {
      return res
        .status(200)
        .send(
          twiml(
            "No encontramos una mascota registrada con este número. Regístrate en pakumi-poc.web.app para comenzar."
          )
        );
    }

    const petDoc = petSnap.docs[0];
    const pet = petDoc.data();
    const petId = petDoc.id;

    // Load existing conversation.
    const conv = await getConversation(phone, petId);
    const existingMessages = conv ? conv.messages || [] : [];
    const existingSummary = conv ? conv.summary || "" : "";
    const isFirstMessage = existingMessages.length === 0;

    // Build history: last 5 pairs (10 messages).
    const history = getLastNPairs(existingMessages, 5);

    // Call Gemini with conversation context, capped at GEMINI_REPLY_TIMEOUT_MS.
    let reply;
    let model;
    const geminiStartedAt = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      GEMINI_REPLY_TIMEOUT_MS,
    );
    try {
      model = getGeminiModel();
      const prompt = buildConversationPrompt(
        pet,
        history,
        existingSummary,
        messageBody,
        isFirstMessage,
      );
      // Belt and suspenders: pass signal to the SDK (best-effort cancel of
      // the underlying fetch) AND race against a manual timeout so we are
      // guaranteed to free our promise inside the budget regardless of SDK
      // behavior.
      const generatePromise = model.generateContent(prompt, {
        signal: controller.signal,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("GEMINI_TIMEOUT")),
          GEMINI_REPLY_TIMEOUT_MS,
        ),
      );
      const result = await Promise.race([generatePromise, timeoutPromise]);
      reply = result.response.text();
      if (!reply || !reply.trim()) throw new Error("Empty Gemini response");
    } catch (err) {
      controller.abort();
      const isTimeout =
        err && (err.message === "GEMINI_TIMEOUT" || err.name === "AbortError");
      if (isTimeout) {
        const latencyMs = Date.now() - geminiStartedAt;
        functions.logger.warn("Gemini fallback triggered (timeout)", {
          conversationId: conv ? conv.id : null,
          userMessageHash: shortHash(messageBody),
          geminiLatencyMs: latencyMs,
          triggeredFallback: true,
        });
        // Persist the user message with no assistant reply so the next
        // exchange has context (UX degradation: user must re-prompt).
        // Future improvement tracked in docs/debt/0009-fallback-message-recovery.md.
        const nowIso = new Date().toISOString();
        const messagesWithUser = [
          ...existingMessages,
          { role: "user", content: messageBody, timestamp: nowIso },
        ];
        try {
          await saveConversation(
            conv ? conv.id : null,
            phone,
            petId,
            messagesWithUser,
            existingSummary,
          );
        } catch (saveErr) {
          functions.logger.error(
            "saveConversation failed during fallback",
            saveErr,
          );
        }
        return res.status(200).send(twiml(FALLBACK_REPLY));
      }
      functions.logger.error("Gemini error", err);
      reply =
        "Disculpa, estoy teniendo problemas técnicos. Intenta de nuevo en unos minutos.";
      // Still return the reply — don't persist a failed exchange.
      return res.status(200).send(twiml(reply));
    } finally {
      clearTimeout(timeoutHandle);
    }

    // Append new messages.
    const now = new Date().toISOString();
    const updatedMessages = [
      ...existingMessages,
      { role: "user", content: messageBody, timestamp: now },
      { role: "assistant", content: reply, timestamp: now },
    ];

    // Summary: regenerate every SUMMARY_INTERVAL messages or when trimming.
    let summary = existingSummary;
    const shouldSummarize =
      updatedMessages.length >= SUMMARY_INTERVAL &&
      updatedMessages.length % SUMMARY_INTERVAL < 2;

    // Trim if over limit.
    let finalMessages = updatedMessages;
    if (updatedMessages.length > MAX_MESSAGES) {
      // Generate summary before trimming so we capture the old messages.
      if (model) {
        summary = await generateSummary(model, pet, updatedMessages);
      }
      // Keep last MAX_MESSAGES messages.
      finalMessages = updatedMessages.slice(-MAX_MESSAGES);
    } else if (shouldSummarize && model) {
      summary = await generateSummary(model, pet, updatedMessages);
    }

    // Persist conversation (fire-and-forget for speed, but await to be safe).
    await saveConversation(
      conv ? conv.id : null,
      phone,
      petId,
      finalMessages,
      summary
    );

    // Smart extraction pipeline in background (don't block response).
    if (model) {
      extractHealthData(model, pet, messageBody, reply, petId).catch((err) =>
        functions.logger.error("Extraction pipeline background error", err)
      );
    }

    return res.status(200).send(twiml(reply));
  } catch (err) {
    functions.logger.error("Webhook error", err);
    return res
      .status(200)
      .send(
        twiml(
          "Disculpa, estoy teniendo problemas técnicos. Intenta de nuevo en unos minutos."
        )
      );
  }
});

// ── Twilio status callback ──────────────────────────────────────────
// Receives delivery state transitions (queued, sent, delivered, failed,
// undelivered, read) for messages we returned via TwiML. Minimal logic:
// parse, persist, ack. Always returns 200 — Twilio retries non-2xx and we
// don't want callback failures to compound into webhook noise.

exports.twilioStatusCallback = functions.https.onRequest(async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === "string") {
      body = Object.fromEntries(new URLSearchParams(body));
    } else if (Buffer.isBuffer(body)) {
      body = Object.fromEntries(new URLSearchParams(body.toString("utf8")));
    }
    body = body || {};

    const messageSid = body.MessageSid || null;
    if (!messageSid) {
      return res.status(200).send("ok");
    }

    await db.collection("twilio_delivery_status").add({
      messageSid,
      status: body.MessageStatus || null,
      to: shortHash(body.To),
      from: body.From || null,
      errorCode: body.ErrorCode || null,
      errorMessage: body.ErrorMessage || null,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.status(200).send("ok");
  } catch (err) {
    functions.logger.error("twilioStatusCallback error", err);
    return res.status(200).send("ok");
  }
});
