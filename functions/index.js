/**
 * Pakumi WhatsApp webhook — async response architecture
 * ─────────────────────────────────────────────────────
 * Inbound flow: Twilio HTTP webhook → ack-fast 200 OK with empty
 * <Response/> → in-handler async pipeline → outbound messages.create
 * REST call back to the user. The 15s Twilio webhook timeout (which
 * was the binding latency constraint in the prior synchronous TwiML
 * architecture) no longer applies to user-visible reply latency. See
 * docs/debt/0017-twilio-async-pattern.md for the migration rationale.
 *
 * Why await-after-send rather than detached fire-and-forget:
 *   Cloud Functions Gen-1 may reap the function instance once the
 *   handler returns. Detached promises started after res.send() can
 *   be silently dropped. Awaiting inside the same handler keeps the
 *   instance alive while still flushing the webhook ack first, which
 *   gives us the same observable property (fast ack, async-feeling
 *   reply) without the reaping risk. See debt 0017 §"Pattern choice".
 *
 * Latency budget — informational, no longer a hard ceiling:
 *   - Webhook ack: ~100–500ms (synchronous res.send before the await).
 *   - Gemini reply generation: variable, normally 2–6s, can spike.
 *   - Capa 2 safety classifier (post-reply): ≤2.5s, fail-open.
 *   - Twilio messages.create: usually 200–600ms; retried 3× on
 *     network errors and 5xx (1s/2s/4s exponential backoff).
 *
 * Intermediate "still thinking" message:
 *   If the Gemini main reply has not returned within 5s of starting,
 *   we send "Estoy procesando tu consulta. Te respondo en un
 *   momento..." via messages.create, fire-and-forget at the
 *   message level (the main flow is not blocked on it). The
 *   intermediate is suppressed for the Capa 3 regex-preempt path
 *   because that short-circuits before the Gemini call. It is NOT
 *   suppressed for Capa 2 emergency overrides — by the time Capa 2
 *   runs the intermediate may already have fired; the user receives
 *   [intermediate] → [emergency template], which is acceptable
 *   (correct safety guidance, just preceded by a reassurance). See
 *   debt 0017 §"Capa 2 + intermediate ordering".
 *
 * Caps still in place as guardrails:
 *   - GEMINI_REPLY_TIMEOUT_MS (12s) — main reply hard cap.
 *   - CLASSIFIER_TIMEOUT_MS (2.5s) — Capa 2 hard cap, fail-open.
 *   - Cloud Function timeout: Gen-1 default 60s.
 *
 * Multi-layer safety architecture (unchanged):
 *   - Capa 1: system prompt with veterinary safety section
 *     (see SYSTEM_PROMPT).
 *   - Capa 2: post-response LLM classifier with override on
 *     emergency. Timeout: 2.5s, fail-open with structured logging.
 *   - Capa 3 (this file + safety/emergency-patterns.js): regex
 *     preempt for unambiguous emergency phrasings. Skips agent +
 *     classifier, responds instantly. Ultra-conservative — false
 *     positives unacceptable.
 *   - Plantillas: category-specific templates in
 *     safety/emergency-templates.js. Pending clinical validation
 *     per debt 0008.
 *
 * Delivery observability: each outbound messages.create includes a
 * statusCallback pointing at TWILIO_STATUS_CALLBACK_URL when set;
 * the twilioStatusCallback handler logs status transitions into the
 * twilio_delivery_status Firestore collection. Empty URL disables
 * the statusCallback attribute (Layer A observability off).
 *
 * Configuration & secrets via firebase-functions/params. Required
 * secrets (set once per environment via Secret Manager):
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   firebase functions:secrets:set TWILIO_ACCOUNT_SID
 *   firebase functions:secrets:set TWILIO_AUTH_TOKEN
 *   firebase functions:secrets:set TWILIO_FROM_NUMBER
 * (TWILIO_FROM_NUMBER must include the "whatsapp:" prefix, e.g.
 * "whatsapp:+14155238886".) Optional non-secret param:
 *   TWILIO_STATUS_CALLBACK_URL — set in functions/.env after first
 *   deploy reveals the function URL. Empty disables Layer A.
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { defineString, defineSecret } = require("firebase-functions/params");
const { matchEmergencyPattern } = require("./safety/emergency-patterns");
const { getEmergencyTemplate } = require("./safety/emergency-templates");

admin.initializeApp();
const db = admin.firestore();

// ── Timeout / fallback budget (see header comment) ──────────────────
const GEMINI_REPLY_TIMEOUT_MS = 12000;
const CLASSIFIER_TIMEOUT_MS = 2500; // Capa 2 classifier timeout (fail-open)

// Sent on any pipeline-internal failure that prevents delivering a real
// reply (Gemini timeout, Gemini error, top-level catch). Softened from
// the previous "problemas técnicos" wording per debt 0017.
const SOFT_FALLBACK_REPLY =
  "Lo siento, no pude procesar tu mensaje a tiempo. Por favor, ¿puedes repetirlo? Si era urgente, contacta directo a tu veterinario.";

// "Still thinking" message fired when Gemini main reply has not
// completed within INTERMEDIATE_THRESHOLD_MS of starting.
const INTERMEDIATE_REPLY =
  "Estoy procesando tu consulta, te respondo en un momento...";
const INTERMEDIATE_THRESHOLD_MS = 5000;

// Outbound replies travel via messages.create now, so the inbound
// webhook only ever returns this empty TwiML envelope as its ack.
const EMPTY_TWIML_RESPONSE =
  '<?xml version="1.0" encoding="UTF-8"?>\n<Response/>';

// messages.create retry policy — see sendWhatsAppWithRetry().
const TWILIO_RETRY_DELAYS_MS = [1000, 2000, 4000];

const VALID_SAFETY_CATEGORIES = [
  "EMERGENCIA_RESPIRATORIA",
  "EMERGENCIA_INTOXICACION",
  "EMERGENCIA_TRAUMA",
  "EMERGENCIA_NEUROLOGICA",
  "EMERGENCIA_OBSTETRICA",
  "URGENCIA",
  "NORMAL",
];

// ── Params (firebase-functions/params) ──────────────────────────────
// Non-secret config: resolved at deploy time, embedded in runtime env.
const TWILIO_STATUS_CALLBACK_URL = defineString("TWILIO_STATUS_CALLBACK_URL", {
  description:
    "Cloud Function URL for Twilio delivery status callbacks. Empty disables Layer A observability.",
  default: "",
});
// Secrets: resolved at runtime from Secret Manager. Must be bound to
// each function that consumes them via runWith({ secrets: [...] }).
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
// Must include the "whatsapp:" prefix (e.g. "whatsapp:+14155238886").
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");

// ── Lazy-loaded dependencies ────────────────────────────────────────
// @google/generative-ai is heavy at require() time. Defer to first
// invocation so the function passes the 10s cold-start gate.

let _genAI = null;
function getGenAI() {
  if (!_genAI) {
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

function getGeminiModel() {
  return getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
}

// Lazy-loaded for the same cold-start reason as @google/generative-ai
// above (see :96-97). Initialized on first invocation, then memoized
// for the lifetime of the function instance.
let _twilioClient = null;
function getTwilioClient() {
  if (!_twilioClient) {
    const sid = TWILIO_ACCOUNT_SID.value();
    const token = TWILIO_AUTH_TOKEN.value();
    if (!sid || !token) {
      throw new Error(
        "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set",
      );
    }
    const twilio = require("twilio");
    _twilioClient = twilio(sid, token);
  }
  return _twilioClient;
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractPhone(from) {
  if (!from) return null;
  return String(from).replace(/^whatsapp:/i, "").trim();
}

function shortHash(s) {
  if (!s) return null;
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
}

// ── Outbound delivery (Twilio messages.create) ──────────────────────
//
// Retry contract: at most TWILIO_RETRY_DELAYS_MS.length retries (3 by
// default, so up to 4 total attempts), with exponential backoff between
// attempts. We retry on:
//   - Network errors (no HTTP response — err.status undefined)
//   - 5xx responses from Twilio
// We do NOT retry on 4xx — those are client errors (bad number, invalid
// auth, exceeded daily limit) where retrying just burns budget.
//
// Throws on final failure so callers can decide whether to log+continue
// or bubble up. The high-level wrapper sendWhatsAppMessage swallows the
// throw and logs structured, since the function-level ack to Twilio has
// already happened and there is no point cascading the failure further.

async function sendWhatsAppWithRetry(params) {
  let lastErr;
  for (let attempt = 0; attempt <= TWILIO_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await getTwilioClient().messages.create(params);
    } catch (err) {
      lastErr = err;
      const httpStatus =
        err && typeof err.status === "number" ? err.status : null;
      const isRetryable = httpStatus === null || httpStatus >= 500;
      const isLastAttempt = attempt === TWILIO_RETRY_DELAYS_MS.length;
      if (!isRetryable || isLastAttempt) throw err;
      const delayMs = TWILIO_RETRY_DELAYS_MS[attempt];
      functions.logger.warn("twilio.send_retry", {
        attempt: attempt + 1,
        willRetryAfterMs: delayMs,
        httpStatus,
        twilioCode: err && err.code ? err.code : null,
        errMessage: err && err.message ? err.message.slice(0, 200) : null,
      });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

/**
 * Send a WhatsApp message via Twilio messages.create with retries and
 * structured logging. Never throws — on final failure logs and returns
 * null so the surrounding pipeline keeps going.
 *
 * @param {Object} opts
 * @param {string} opts.toPhone        Recipient phone, "+51..." (no "whatsapp:" prefix)
 * @param {string} opts.body           Message body
 * @param {string} [opts.conversationId]
 * @param {string} [opts.petId]
 * @param {string} [opts.userMessageHash]
 * @returns {Promise<Object|null>}     Twilio message instance on success, null on failure
 */
async function sendWhatsAppMessage(opts) {
  const { toPhone, body, conversationId, petId, userMessageHash } = opts;
  const fromNumber = TWILIO_FROM_NUMBER.value();
  if (!fromNumber) {
    functions.logger.error("twilio.from_number_missing", {
      petId: petId || null,
      conversationId: conversationId || null,
    });
    return null;
  }
  const callbackUrl = TWILIO_STATUS_CALLBACK_URL.value() || "";
  const params = {
    from: fromNumber,
    to: `whatsapp:${toPhone}`,
    body,
  };
  if (callbackUrl) params.statusCallback = callbackUrl;

  try {
    const message = await sendWhatsAppWithRetry(params);
    functions.logger.info("twilio.send_ok", {
      messageSid: message && message.sid ? message.sid : null,
      to: shortHash(toPhone),
      petId: petId || null,
      conversationId: conversationId || null,
      bodyLen: body ? body.length : 0,
    });
    return message;
  } catch (err) {
    functions.logger.error("twilio.send_failed_after_retries", {
      to: shortHash(toPhone),
      petId: petId || null,
      conversationId: conversationId || null,
      userMessageHash: userMessageHash || null,
      replyPreview: (body || "").slice(0, 200),
      httpStatus: err && typeof err.status === "number" ? err.status : null,
      twilioCode: err && err.code ? err.code : null,
      errMessage: err && err.message ? err.message.slice(0, 300) : null,
    });
    return null;
  }
}

// ── Prompt builders ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a friendly, knowledgeable veterinary AI assistant called "Pakumi". You provide helpful guidance about pet health within the limits and rules defined in the '### Seguridad veterinaria' section below.

### Seguridad veterinaria

Estas reglas son la **Capa 1** de un sistema de seguridad de varias capas. Existe una **Capa 2** (clasificador de seguridad ejecutado después de tu respuesta) como respaldo, pero NUNCA debes depender de ella: tu respuesta debe ser segura por sí sola, sin asumir que algo posterior corregirá un error tuyo.

**Tu rol y tus límites**
- Pakumi es un compañero de salud para mascotas, NO una herramienta de diagnóstico veterinario.
- Pakumi NO diagnostica enfermedades, NO prescribe medicamentos, NO recomienda dosis y NO reemplaza al veterinario tratante de la mascota.
- Tus funciones específicas son: (1) registrar los eventos de salud que reporta el dueño, (2) recordar los cuidados programados (vacunas, desparasitaciones, controles veterinarios), (3) brindar información educativa general sobre el cuidado de mascotas, y (4) escalar a atención veterinaria de urgencia cuando corresponda.

**Aviso obligatorio en respuestas sobre síntomas o salud**
Cuando el dueño describa CUALQUIER síntoma o preocupación de salud, tu respuesta DEBE incluir, de manera natural y no como un pie de página mecánico, este recordatorio en español:
"Esta información es referencial. Te recomiendo consultar con tu veterinario tratante para una evaluación adecuada."
Puedes adaptar ligeramente la redacción al flujo de la conversación, pero el sentido (carácter referencial + recomendación de consultar al veterinario tratante) debe quedar claro.

**Manejo de emergencias**
Para posibles emergencias —intoxicación, dificultad para respirar, sangrado severo, convulsiones, traumatismos, pérdida de conciencia, parto complicado u otros cuadros graves— tu respuesta DEBE recomendar de forma clara y prioritaria atención veterinaria de urgencia inmediata. Aunque el dueño te pida indicaciones específicas sobre qué hacer, NO entregues acciones médicas concretas más allá de "buscar atención veterinaria de emergencia inmediatamente": cualquier instrucción más específica puede dañar a la mascota. La Capa 2 hará un chequeo posterior, pero esa es una red de seguridad, no una excusa para que tú falles aquí.

**Conductas prohibidas (lista explícita)**
- NO nombres medicamentos específicos ni dosis, aunque el dueño te lo pida.
- NO diagnostiques enfermedades específicas por nombre.
- NO recomiendes remedios caseros para síntomas serios.
- NO minimices la preocupación del dueño (frases como "seguramente no es nada" están prohibidas).
- NO retrases la recomendación de atención veterinaria cuando los síntomas la justifiquen.

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

  prompt += `\n\nThe owner is asking you the following question. Respond in Spanish, be concise (max 300 words), warm, and helpful.

Owner's message: ${messageBody}`;

  return prompt;
}

// ── Capa 2: post-response safety classifier ─────────────────────────
//
// Runs on the happy path AFTER the agent reply is generated and BEFORE
// TwiML is sent. Total override on EMERGENCIA_*. Fail-open contract:
// the function NEVER throws — on timeout, parse error, or any network
// failure, it returns category="NORMAL" with a non-"ok" status so the
// caller leaves the original reply intact and the failure is logged.

function buildClassifierPrompt(userMessage) {
  return `Eres un clasificador de seguridad veterinaria. Tu única tarea es clasificar el mensaje del dueño de una mascota en exactamente UNA categoría. NO respondas al mensaje, NO des consejos: solo clasifica.

Categorías permitidas:
- EMERGENCIA_RESPIRATORIA: dificultad para respirar, ahogamiento, jadeo intenso, cianosis (encías azules/moradas).
- EMERGENCIA_INTOXICACION: ingesta de chocolate, veneno, raticida, cebolla, uvas/pasas, medicamentos humanos, productos de limpieza.
- EMERGENCIA_TRAUMA: atropello, caídas graves, fracturas, sangrado abundante o que no para, heridas profundas, vómito con sangre.
- EMERGENCIA_NEUROLOGICA: convulsiones, pérdida de conciencia, desmayo, parálisis, no puede levantarse, desorientación severa.
- EMERGENCIA_OBSTETRICA: complicaciones de parto, contracciones prolongadas sin nacimiento.
- URGENCIA: preocupante pero no inmediatamente amenazante (fiebre alta, vómitos persistentes, letargia marcada, imposibilidad de orinar — recuerda que en gatos la obstrucción urinaria puede ser emergencia).
- NORMAL: consulta no urgente, registro de evento rutinario, pregunta educativa o conversacional.

Regla de conservadurismo (importante):
- Si dudas entre una categoría EMERGENCIA_* y URGENCIA, elige URGENCIA.
- Si dudas entre URGENCIA y NORMAL, elige URGENCIA.
- Justificación: un falso positivo cuesta una consulta veterinaria; un falso negativo puede costar la vida del animal.

Responde SOLO con JSON válido, sin markdown ni texto adicional, con esta forma EXACTA:
{ "category": "<una de las categorías>", "confidence": "high" | "medium" | "low", "reasoning": "<≤100 caracteres en español>" }

Ejemplos:
- "Mi perro convulsiona desde hace 5 minutos" → { "category": "EMERGENCIA_NEUROLOGICA", "confidence": "high", "reasoning": "Convulsión activa de varios minutos" }
- "Mi gato lleva 12 horas sin orinar y se queja al ir a la caja" → { "category": "URGENCIA", "confidence": "high", "reasoning": "Posible obstrucción urinaria felina" }
- "¿Cada cuánto debo bañar a mi labrador?" → { "category": "NORMAL", "confidence": "high", "reasoning": "Pregunta educativa de cuidado" }
- "Mi perro tose un poco después de jugar" → { "category": "URGENCIA", "confidence": "medium", "reasoning": "Tos sin más síntomas; conservar por regla" }

Mensaje del dueño:
"${userMessage}"`;
}

async function classifyEmergency(model, userMessage, conversationId, petId) {
  const startedAt = Date.now();
  const failOpen = (status, reasoning) => ({
    category: "NORMAL",
    confidence: "low",
    reasoning,
    latencyMs: Date.now() - startedAt,
    status,
  });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    CLASSIFIER_TIMEOUT_MS,
  );

  try {
    const prompt = buildClassifierPrompt(userMessage);
    const generatePromise = model.generateContent(prompt, {
      signal: controller.signal,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("CLASSIFIER_TIMEOUT")),
        CLASSIFIER_TIMEOUT_MS,
      ),
    );
    const result = await Promise.race([generatePromise, timeoutPromise]);
    const text = result.response.text();

    let parsed;
    try {
      parsed = parseExtractionJSON(text);
    } catch (parseErr) {
      functions.logger.warn("safety.classifier_parse_failed", {
        petId,
        conversationId: conversationId || null,
        rawSnippet: (text || "").slice(0, 300),
        error: parseErr && parseErr.message ? parseErr.message : String(parseErr),
      });
      return failOpen(
        "error",
        `parse: ${(parseErr && parseErr.message ? parseErr.message : "unknown").slice(0, 180)}`,
      );
    }

    const category = VALID_SAFETY_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : "NORMAL";
    const confidence = ["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "low";
    const reasoning =
      typeof parsed.reasoning === "string" && parsed.reasoning.trim()
        ? parsed.reasoning.trim().slice(0, 200)
        : "";

    return {
      category,
      confidence,
      reasoning,
      latencyMs: Date.now() - startedAt,
      status: "ok",
    };
  } catch (err) {
    controller.abort();
    const isTimeout =
      err && (err.message === "CLASSIFIER_TIMEOUT" || err.name === "AbortError");
    if (isTimeout) {
      functions.logger.warn("safety.classifier_timeout", {
        petId,
        conversationId: conversationId || null,
        timeoutMs: CLASSIFIER_TIMEOUT_MS,
      });
      return failOpen("timeout", "timeout");
    }
    functions.logger.warn("safety.classifier_error", {
      petId,
      conversationId: conversationId || null,
      error: err && err.message ? err.message : String(err),
    });
    return failOpen(
      "error",
      (err && err.message ? err.message : "unknown").slice(0, 200),
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
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
const VALID_DATE_CONFIDENCE = ["high", "medium", "low"];

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

  // Per HC-05a: missing/invalid confidence metadata must NOT drop the event.
  // Default to low confidence with an explanatory source so reviewers can
  // tell "model omitted the field" apart from "model genuinely uncertain".
  const eventDateConfidence = VALID_DATE_CONFIDENCE.includes(
    evt.eventDateConfidence,
  )
    ? evt.eventDateConfidence
    : "low";
  const eventDateSource =
    typeof evt.eventDateSource === "string" && evt.eventDateSource.trim()
      ? evt.eventDateSource.trim()
      : "campo no provisto por el modelo";

  return {
    type,
    description,
    severity,
    date,
    eventDateConfidence,
    eventDateSource,
  };
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

async function extractHealthData(
  model,
  pet,
  userMessage,
  assistantResponse,
  petId,
  conversationId,
) {
  // Anchor "today" so Gemini can resolve implicit years and "ayer"-style
  // relative dates. Computed in UTC; for a POC we accept the up-to-5h skew
  // vs. Peru local time near midnight.
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const currentYear = today.getUTCFullYear();
  const yesterdayIso = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const prompt = `You are a veterinary data extraction system. Analyze this veterinary conversation exchange about ${pet.name} (${pet.species}) and extract structured health data. Respond ONLY with valid JSON, no other text.

Today's date: ${todayIso}
Owner's message: "${userMessage}"
Assistant's response: "${assistantResponse}"

Extract:
{
  "events": [
    {
      "type": "symptom" | "medication" | "vaccine" | "vet_visit" | "weight" | "diet_change" | "behavior",
      "description": "brief description in Spanish",
      "severity": "low" | "medium" | "high" | null,
      "date": "YYYY-MM-DD",
      "eventDateConfidence": "high" | "medium" | "low",
      "eventDateSource": "short Spanish explanation of how the date was determined"
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

Rules specific to events[] and date assignment (HC-05a):
- A single message may contain MULTIPLE distinct events with DIFFERENT dates. Each event must be paired with its OWN date based on textual proximity in the message — the date closest to an event description is the date of that event. Do NOT assign the same date to multiple distinct events unless the message explicitly says they happened on the same day.
- Year inference: if a date is mentioned without a year, default to the current year (today is ${todayIso}, so the current year is ${currentYear}). If applying the current year would place the date in the future relative to today, assume the date is from the previous year instead (e.g., a message in January mentioning "15 de diciembre" refers to December of the previous year).
- "eventDateConfidence":
  * "high" — explicit date in the message ("15 de enero", "el 3 de febrero").
  * "medium" — relative date inferred from the message ("ayer", "la semana pasada", "hace dos días").
  * "low" — no date present in the message; in this case set "date" to today (${todayIso}).
- "eventDateSource" must be a short Spanish string explaining the basis (e.g., "explícita: '15 de enero'", "inferida: 'ayer'", "no encontrada, default a timestamp del mensaje").

Examples for events[] (multi-event date handling):
- "Le di la vacuna el 15 de enero" → events: [{type:"vaccine", description:"Vacuna aplicada", severity:null, date:"${currentYear}-01-15", eventDateConfidence:"high", eventDateSource:"explícita: '15 de enero'"}]
- "Le di antibióticos ayer" → events: [{type:"medication", description:"Antibióticos administrados", severity:null, date:"${yesterdayIso}", eventDateConfidence:"medium", eventDateSource:"inferida: 'ayer'"}]
- "Le di la vacuna el 15 de enero y el desparasitante el 3 de febrero" → events: [{type:"vaccine", description:"Vacuna aplicada", severity:null, date:"${currentYear}-01-15", eventDateConfidence:"high", eventDateSource:"explícita: '15 de enero'"}, {type:"medication", description:"Desparasitante administrado", severity:null, date:"${currentYear}-02-03", eventDateConfidence:"high", eventDateSource:"explícita: '3 de febrero'"}]
- "Mi perro está vomitando" → events: [{type:"symptom", description:"Vómitos", severity:"medium", date:"${todayIso}", eventDateConfidence:"low", eventDateSource:"no encontrada, default a timestamp del mensaje"}]

Other examples (envelope shape, unchanged behavior for grooming/reminder):
- "Llevé a mi gato a bañar hoy en PetClean" → events: [], grooming: {type:"bath", notes:"Baño en peluquería", date:"${todayIso}", provider:"PetClean"}
- "Le cortaron las uñas y le hicieron limpieza dental" → events: [], grooming: {type:"nails", notes:"Corte de uñas y limpieza dental", date:null, provider:null}
- "Hola, quería preguntar algo" → events: [], shouldRemind: {type:null}, grooming: {type:null}`;

  let parsed;
  let rawResponseText = "";
  try {
    const result = await model.generateContent(prompt);
    rawResponseText = result.response.text();
    parsed = parseExtractionJSON(rawResponseText);
  } catch (err) {
    // Truncate raw to keep the log line bounded; full text is rarely needed
    // and Cloud Logging caps fields anyway.
    functions.logger.warn("Health data extraction failed to parse", {
      error: err && err.message ? err.message : String(err),
      rawResponseSnippet: (rawResponseText || "").slice(0, 500),
      petId,
      conversationId: conversationId || null,
    });
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
      eventDateConfidence: evt.eventDateConfidence,
      eventDateSource: evt.eventDateSource,
      reportedAt: now,
      source: "whatsapp",
    });
    writes++;

    // Surface low-confidence date assignments so we can audit whether the
    // model is hallucinating dates in production. Reviewable via Cloud
    // Logging filter on jsonPayload.message="extraction.low_confidence".
    if (evt.eventDateConfidence === "low") {
      functions.logger.warn("extraction.low_confidence", {
        petId,
        conversationId: conversationId || null,
        userMessageHash: shortHash(userMessage),
        event: {
          type: evt.type,
          description: evt.description,
          date: evt.date,
          eventDateSource: evt.eventDateSource,
        },
      });
    }
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

/**
 * Run the full reply pipeline (Capa 3 → Gemini main → Capa 2 → delivery)
 * for a parsed Twilio inbound body. Awaited from the webhook handler
 * AFTER the 200 OK ack has been flushed; see header note for why we use
 * await-after-send rather than detached fire-and-forget.
 *
 * Never throws — top-level catch attempts a soft-fallback delivery if
 * we still have a recipient phone, then resolves.
 */
async function processAndRespond(body) {
  const from = body.From;
  const messageBody = body.Body;
  const phone = extractPhone(from);
  const userMessageHash = shortHash(messageBody);

  functions.logger.info("Incoming WhatsApp", {
    phone,
    profileName: body.ProfileName,
  });

  try {
    // Find the pet for this phone number.
    const petSnap = await db
      .collection("pets")
      .where("ownerPhone", "==", phone)
      .limit(1)
      .get();

    if (petSnap.empty) {
      await sendWhatsAppMessage({
        toPhone: phone,
        body:
          "No encontramos una mascota registrada con este número. Regístrate en pakumi-poc.web.app para comenzar.",
        userMessageHash,
      });
      return;
    }

    const petDoc = petSnap.docs[0];
    const pet = petDoc.data();
    const petId = petDoc.id;

    // Load existing conversation.
    const conv = await getConversation(phone, petId);
    const conversationIdForLog = conv ? conv.id : null;
    const existingMessages = conv ? conv.messages || [] : [];
    const existingSummary = conv ? conv.summary || "" : "";
    const isFirstMessage = existingMessages.length === 0;

    // Build history: last 5 pairs (10 messages).
    const history = getLastNPairs(existingMessages, 5);

    // ── Capa 3: regex preempt ────────────────────────────────────────
    // For unambiguous emergency phrasings, skip the agent + classifier
    // and respond immediately with the emergency template. The
    // intermediate "still thinking" message is suppressed on this path
    // because we never start the Gemini call (see header note on
    // intermediate suppression).
    const regexMatch = matchEmergencyPattern(messageBody);
    if (regexMatch) {
      functions.logger.info("safety.preempt_regex_hit", {
        petId,
        conversationId: conversationIdForLog,
        category: regexMatch.category,
        matchedPattern: regexMatch.matchedPattern,
        userMessageHash,
      });

      // Persist to safety_classifications for unified audit trail.
      // Fire-and-forget — the user-facing response must not wait on it.
      db.collection("safety_classifications")
        .add({
          petId,
          conversationId: conversationIdForLog,
          userMessageHash,
          category: regexMatch.category,
          confidence: "high",
          reasoning: `regex preempt: ${regexMatch.description}`,
          classifierStatus: "preempt_regex",
          classifierLatencyMs: 0,
          overrideTriggered: true,
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((err) =>
          functions.logger.warn("safety_classification.persist_failed", {
            err: err && err.message ? err.message : String(err),
          }),
        );

      // Save user message + placeholder assistant turn so future context
      // reflects what actually happened. Fire-and-forget per spec.
      const preemptIso = new Date().toISOString();
      const placeholder =
        "[Pakumi: derivó a urgencia veterinaria por regex preempt]";
      const messagesWithPreempt = [
        ...existingMessages,
        { role: "user", content: messageBody, timestamp: preemptIso },
        { role: "assistant", content: placeholder, timestamp: preemptIso },
      ];
      saveConversation(
        conv ? conv.id : null,
        phone,
        petId,
        messagesWithPreempt,
        existingSummary,
      ).catch((err) =>
        functions.logger.error("conversation.save_failed_after_preempt", {
          err: err && err.message ? err.message : String(err),
        }),
      );

      await sendWhatsAppMessage({
        toPhone: phone,
        body: getEmergencyTemplate(regexMatch.category),
        conversationId: conversationIdForLog,
        petId,
        userMessageHash,
      });
      return;
    }
    // ─── End Capa 3 ──────────────────────────────────────────────────

    // Call Gemini with conversation context, capped at
    // GEMINI_REPLY_TIMEOUT_MS. While the call is in flight, race a 5s
    // intermediate "still thinking" message — sent only if Gemini has
    // not returned by then.
    let reply;
    let model;
    let intermediateSent = false;
    let geminiDone = false;
    const geminiStartedAt = Date.now();
    const controller = new AbortController();
    const hardTimeoutHandle = setTimeout(
      () => controller.abort(),
      GEMINI_REPLY_TIMEOUT_MS,
    );
    const intermediateTimerHandle = setTimeout(() => {
      if (geminiDone) return;
      intermediateSent = true;
      functions.logger.info("intermediate.fired", {
        petId,
        conversationId: conversationIdForLog,
        userMessageHash,
        thresholdMs: INTERMEDIATE_THRESHOLD_MS,
      });
      // Fire-and-forget at the message level. sendWhatsAppMessage never
      // throws (it logs on final retry failure), so no .catch needed,
      // but we keep one defensively in case the future shape changes.
      sendWhatsAppMessage({
        toPhone: phone,
        body: INTERMEDIATE_REPLY,
        conversationId: conversationIdForLog,
        petId,
        userMessageHash,
      }).catch((err) =>
        functions.logger.warn("intermediate.send_failed", {
          err: err && err.message ? err.message : String(err),
        }),
      );
    }, INTERMEDIATE_THRESHOLD_MS);

    try {
      model = getGeminiModel();
      const prompt = buildConversationPrompt(
        pet,
        history,
        existingSummary,
        messageBody,
        isFirstMessage,
      );
      // Belt and suspenders: pass signal to the SDK (best-effort cancel
      // of the underlying fetch) AND race against a manual timeout so
      // we always free the promise inside the budget regardless of SDK
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
        err &&
        (err.message === "GEMINI_TIMEOUT" || err.name === "AbortError");
      if (isTimeout) {
        const latencyMs = Date.now() - geminiStartedAt;
        functions.logger.warn("Gemini fallback triggered (timeout)", {
          conversationId: conversationIdForLog,
          userMessageHash,
          geminiLatencyMs: latencyMs,
          triggeredFallback: true,
          intermediateSent,
        });
        // Persist the user message with no assistant reply so the next
        // exchange has context (UX degradation: user must re-prompt).
        // Future improvement tracked in debt 0009.
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
        await sendWhatsAppMessage({
          toPhone: phone,
          body: SOFT_FALLBACK_REPLY,
          conversationId: conversationIdForLog,
          petId,
          userMessageHash,
        });
        return;
      }
      functions.logger.error("Gemini error", err);
      // Don't persist a failed exchange — just notify the user softly.
      await sendWhatsAppMessage({
        toPhone: phone,
        body: SOFT_FALLBACK_REPLY,
        conversationId: conversationIdForLog,
        petId,
        userMessageHash,
      });
      return;
    } finally {
      geminiDone = true;
      clearTimeout(hardTimeoutHandle);
      clearTimeout(intermediateTimerHandle);
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

    let finalMessages = updatedMessages;
    if (updatedMessages.length > MAX_MESSAGES) {
      if (model) {
        summary = await generateSummary(model, pet, updatedMessages);
      }
      finalMessages = updatedMessages.slice(-MAX_MESSAGES);
    } else if (shouldSummarize && model) {
      summary = await generateSummary(model, pet, updatedMessages);
    }

    // Persist conversation. Note: stored reply is the Gemini output, not
    // any Capa 2 override — see debt 0013 for the rationale.
    const conversationId = await saveConversation(
      conv ? conv.id : null,
      phone,
      petId,
      finalMessages,
      summary,
    );

    // Smart extraction pipeline in background (don't block delivery).
    if (model) {
      extractHealthData(
        model,
        pet,
        messageBody,
        reply,
        petId,
        conversationId,
      ).catch((err) =>
        functions.logger.error("Extraction pipeline background error", err),
      );
    }

    // ── Capa 2: post-response safety classifier ─────────────────────
    // Awaited (blocks final delivery). Fail-open: on timeout/error the
    // original `reply` is sent through unchanged. Persist of the
    // classification record is fire-and-forget.
    let finalReply = reply;
    if (model) {
      const classification = await classifyEmergency(
        model,
        messageBody,
        conversationId,
        petId,
      );

      db.collection("safety_classifications")
        .add({
          petId,
          conversationId: conversationId || null,
          userMessageHash,
          category: classification.category,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          classifierStatus: classification.status,
          classifierLatencyMs: classification.latencyMs,
          overrideTriggered:
            classification.category.startsWith("EMERGENCIA_"),
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((err) =>
          functions.logger.warn("safety_classification.persist_failed", {
            err: err && err.message ? err.message : String(err),
          }),
        );

      if (classification.category.startsWith("EMERGENCIA_")) {
        finalReply = getEmergencyTemplate(classification.category);
        functions.logger.info("safety.emergency_override", {
          petId,
          conversationId: conversationId || null,
          category: classification.category,
          confidence: classification.confidence,
          classifierLatencyMs: classification.latencyMs,
          intermediateSent,
        });
      }
    }

    await sendWhatsAppMessage({
      toPhone: phone,
      body: finalReply,
      conversationId,
      petId,
      userMessageHash,
    });
  } catch (err) {
    functions.logger.error("processAndRespond top-level error", {
      err: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack.slice(0, 1000) : null,
    });
    if (phone) {
      // Best-effort soft fallback. sendWhatsAppMessage swallows its own
      // errors, so this resolves regardless.
      await sendWhatsAppMessage({
        toPhone: phone,
        body: SOFT_FALLBACK_REPLY,
        userMessageHash,
      });
    }
  }
}

exports.whatsappWebhook = functions
  .runWith({
    secrets: [
      GEMINI_API_KEY,
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_FROM_NUMBER,
    ],
  })
  .https.onRequest(async (req, res) => {
    res.set("Content-Type", "text/xml");

    let body;
    try {
      body = req.body;
      if (typeof body === "string") {
        body = Object.fromEntries(new URLSearchParams(body));
      } else if (Buffer.isBuffer(body)) {
        body = Object.fromEntries(new URLSearchParams(body.toString("utf8")));
      }
      body = body || {};
    } catch (parseErr) {
      functions.logger.error("Webhook body parse failed", parseErr);
      return res.status(200).send(EMPTY_TWIML_RESPONSE);
    }

    const from = body.From;
    const messageBody = body.Body;

    if (!from || !messageBody) {
      functions.logger.warn("Missing From or Body", {
        hasFrom: !!from,
        hasBody: !!messageBody,
      });
      return res.status(200).send(EMPTY_TWIML_RESPONSE);
    }

    // Ack-fast: flush 200 OK + empty <Response/> immediately so Twilio
    // closes its end of the webhook within ~100–500ms. We then continue
    // processing inside the same handler; awaiting keeps the function
    // instance alive until processAndRespond resolves (Gen-1 only reaps
    // after the handler returns). See header note on pattern choice.
    res.status(200).send(EMPTY_TWIML_RESPONSE);

    try {
      await processAndRespond(body);
    } catch (err) {
      // processAndRespond has its own top-level catch, but we keep this
      // outer guard so an unexpected throw never crashes the function.
      functions.logger.error("Webhook handler unhandled error", err);
    }
  });

// ── Twilio status callback ──────────────────────────────────────────
// Receives delivery state transitions (queued, sent, delivered, failed,
// undelivered, read) for outbound messages sent via messages.create.
// Minimal logic: parse, persist, ack. Always returns 200 — Twilio retries
// non-2xx and we don't want callback failures to compound into webhook
// noise.

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
