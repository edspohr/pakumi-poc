/*
 * PLANTILLAS DE RESPUESTA DE EMERGENCIA — DISEÑO Y LIMITACIONES
 *
 * Estas plantillas se envían al usuario cuando Capa 2 (clasificador LLM)
 * o Capa 3 (regex preempt) detectan una emergencia veterinaria.
 *
 * LIMITACIÓN CLÍNICA IMPORTANTE
 * Las plantillas son DELIBERADAMENTE GENÉRICAS en cuanto a información
 * médica. NO contienen:
 *  - Nombres ni dosis de medicamentos.
 *  - Instrucciones específicas de tratamiento (ej: inducir vómito,
 *    aplicar presión, administrar X).
 *  - Diagnósticos ("esto es probablemente intoxicación por chocolate").
 *
 * Solo contienen:
 *  - Reconocimiento de la urgencia.
 *  - Información de PROCESO (qué llevar al vet, cómo trasladar, qué
 *    anotar).
 *  - Derivación clara a atención veterinaria.
 *  - Reconocimiento explícito del límite de Pakumi.
 *
 * Esta limitación es CONSCIENTE y está documentada en docs/debt/0008.
 * Las plantillas serán enriquecidas con instrucciones clínicas
 * validadas cuando Pakumi integre un partner veterinario clínico
 * (ver Adenda Hito 3 / Sprint 4).
 *
 * Para agregar nuevas plantillas o modificar existentes:
 *  1. Mantener el límite de 320 caracteres (WhatsApp).
 *  2. Iniciar con emoji visible (🚨 emergencia, ⚠️ urgencia).
 *  3. NO agregar información médica sin firma de veterinario clínico.
 *  4. Mantener tono empático pero accionable, sin alarmismo excesivo.
 *  5. Referenciar siempre el límite de Pakumi al final.
 */

const EMERGENCY_TEMPLATES = {
  EMERGENCIA_RESPIRATORIA:
    "🚨 Esto es una emergencia veterinaria. Mantén a tu mascota lo más calmada posible y evita que se mueva en exceso. Lleva a tu mascota de inmediato a una clínica veterinaria de urgencia. Pakumi no puede reemplazar la atención veterinaria de emergencia.",
  EMERGENCIA_INTOXICACION:
    "🚨 Esto es una emergencia veterinaria por posible intoxicación. Lleva a tu mascota de inmediato a una clínica veterinaria de urgencia. Si es posible, lleva una muestra o el envase de la sustancia ingerida. Pakumi no puede reemplazar la atención veterinaria de emergencia.",
  EMERGENCIA_TRAUMA:
    "🚨 Esto es una emergencia veterinaria por traumatismo. Manipula a tu mascota lo menos posible y traslada con cuidado para no agravar lesiones. Lleva a tu mascota de inmediato a una clínica veterinaria de urgencia. Pakumi no puede reemplazar la atención veterinaria de emergencia.",
  EMERGENCIA_NEUROLOGICA:
    "🚨 Esto es una emergencia veterinaria neurológica. No intentes contener ni alimentar a tu mascota. Lleva a tu mascota de inmediato a una clínica veterinaria de urgencia. Si tienes registro del momento en que comenzó, compártelo con el veterinario. Pakumi no puede reemplazar la atención veterinaria de emergencia.",
  EMERGENCIA_OBSTETRICA:
    "🚨 Esto es una emergencia veterinaria obstétrica. Anota la hora del último nacimiento si lo hubo y cualquier signo que hayas observado. Lleva a tu mascota de inmediato a una clínica veterinaria de urgencia. Pakumi no puede reemplazar la atención veterinaria de emergencia.",
  URGENCIA:
    "⚠️ Esto puede requerir atención veterinaria pronta, aunque no es una emergencia inmediata. Te recomiendo contactar a tu veterinario tratante en las próximas horas para una evaluación. Si los síntomas empeoran o aparecen nuevos, busca atención de urgencia. Pakumi no reemplaza la evaluación veterinaria.",
};

// If category is unknown but the override fired, default to the most
// generic process-only template. EMERGENCIA_TRAUMA is the safest
// fallback because its only specific guidance is "manipula con
// cuidado, ve al vet" — applicable in nearly any acute situation.
// EMERGENCIA_INTOXICACION would be a worse fallback because the
// "lleva una muestra del tóxico" guidance is irrelevant most of the
// time.
const FALLBACK_EMERGENCY_TEMPLATE = EMERGENCY_TEMPLATES.EMERGENCIA_TRAUMA;

function getEmergencyTemplate(category) {
  if (!category || typeof category !== "string") {
    return FALLBACK_EMERGENCY_TEMPLATE;
  }
  return EMERGENCY_TEMPLATES[category] || FALLBACK_EMERGENCY_TEMPLATE;
}

module.exports = {
  EMERGENCY_TEMPLATES,
  FALLBACK_EMERGENCY_TEMPLATE,
  getEmergencyTemplate,
};

// ── Self-test (runs at module load) ─────────────────────────────────
// Verify each template respects design constraints. Failures log to
// console.error at module load so they surface in cold-start logs
// rather than waiting for a real emergency to expose them. Cost: zero
// when templates are healthy, one log line per cold start when broken.
for (const [category, template] of Object.entries(EMERGENCY_TEMPLATES)) {
  if (template.length > 320) {
    console.error(
      `TEMPLATE_TEST_FAIL: ${category} exceeds 320 chars (${template.length})`,
    );
  }
  if (!template.match(/^(🚨|⚠️)/)) {
    console.error(
      `TEMPLATE_TEST_FAIL: ${category} does not start with emergency emoji`,
    );
  }
  if (!template.includes("Pakumi") && category.startsWith("EMERGENCIA_")) {
    console.error(
      `TEMPLATE_TEST_FAIL: ${category} does not mention Pakumi limit`,
    );
  }
  // Forbidden medical-instruction terms. Not exhaustive — first line of
  // defense; the real safety net is the "no medical instructions"
  // editorial rule documented at the top of this file plus eventual
  // clinical review (debt 0008).
  const forbiddenTerms =
    /\b(induce|administra|aplica\s+presi[óo]n|dale\s+\d+\s*ml|dosis|miligramos?|mg\b|cc\b)/i;
  if (forbiddenTerms.test(template)) {
    console.error(
      `TEMPLATE_TEST_FAIL: ${category} contains forbidden medical term`,
    );
  }
}
