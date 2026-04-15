require("dotenv").config();

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

function extractPhone(from) {
  if (!from) return null;
  return String(from).replace(/^whatsapp:/i, "").trim();
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function twiml(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${escapeXml(message)}</Message></Response>`;
}

function buildPrompt(pet, messageBody) {
  return `You are a friendly, knowledgeable veterinary AI assistant called "Pakumi". You provide helpful guidance about pet health, but always remind users to consult a real veterinarian for serious concerns.

Patient profile:
- Name: ${pet.name}
- Species: ${pet.species}
- Breed: ${pet.breed || "No especificada"}
- Age: ${pet.age}
- Weight: ${pet.weight || "No especificado"}
- Known conditions/allergies: ${pet.condition || "Ninguna reportada"}
- Owner: ${pet.ownerName}

The owner is asking you the following question. Respond in Spanish, be concise (max 300 words), warm, and helpful. If the question suggests an emergency, strongly recommend visiting a vet immediately.

Owner's message: ${messageBody}`;
}

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  res.set("Content-Type", "text/xml");

  try {
    // Twilio sends application/x-www-form-urlencoded. Firebase parses this
    // automatically, but fall back to URLSearchParams if we ever get a raw body.
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

    const snap = await db
      .collection("pets")
      .where("ownerPhone", "==", phone)
      .limit(1)
      .get();

    if (snap.empty) {
      return res
        .status(200)
        .send(
          twiml(
            "No encontramos una mascota registrada con este número. Regístrate en pakumi-poc.web.app para comenzar."
          )
        );
    }

    const pet = snap.docs[0].data();

    let reply;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(buildPrompt(pet, messageBody));
      reply = result.response.text();
      if (!reply || !reply.trim()) throw new Error("Empty Gemini response");
    } catch (err) {
      functions.logger.error("Gemini error", err);
      reply =
        "Disculpa, estoy teniendo problemas técnicos. Intenta de nuevo en unos minutos.";
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
