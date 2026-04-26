// ── Capa 3: regex preempt for unambiguous veterinary emergencies ────
//
// This module is loaded once per Cloud Function cold start. The self-test
// at the bottom runs at module-load time and writes to console.error if a
// pattern's behavior diverges from its declared examples — see "filosofía
// de diseño" comment block below for why this matters.

const EMERGENCY_PATTERNS = [
  // 1. Convulsiones explícitas
  {
    pattern: /\b(est[áa]\s+)?convulsion(a|ando)\b/iu,
    category: "EMERGENCIA_NEUROLOGICA",
    description: "Convulsiones activas explícitamente reportadas",
    examplesMatched: [
      "mi perro convulsiona",
      "está convulsionando",
      "convulsiona desde hace rato",
    ],
    examplesNotMatched: [
      "antes tuvo convulsiones",
      "tomó algo para las convulsiones",
      "el medicamento previene convulsiones",
    ],
  },

  // 2. No respira / dificultad respiratoria explícita
  // Note: regex extended from spec's `respira(r)?` to `respira(r|ba)?` so
  // that the user-specified examplesMatched entry "no respiraba" passes
  // the self-test. Past-imperfect ("respiraba") is rare in panic
  // messages but the spec called for it.
  {
    pattern: /\bno\s+(puede\s+)?respira(r|ba)?\s*(bien)?\b/iu,
    category: "EMERGENCIA_RESPIRATORIA",
    description: "Dificultad respiratoria aguda explícita",
    examplesMatched: [
      "no respira",
      "no puede respirar",
      "no respira bien",
      "no respiraba",
    ],
    examplesNotMatched: [
      "antes le costaba respirar",
      "tose pero respira normal",
      "respira raro",
    ],
  },

  // 3. Ingesta confirmada de tóxicos clásicos (verb-anchored)
  // Verb anchoring (comió/tragó/ingirió/se comió) is what prevents
  // educational queries like "el chocolate es tóxico para perros" from
  // false-positiving. We accept "comió chocolate" as a true positive
  // even when intent is ambiguous — the user said it happened.
  {
    pattern:
      /\b(comi[óo]|trag[óo]|ingiri[óo]|se\s+comi[óo])\s+(chocolate|veneno|raticida|matarratas|cebolla|uvas?|pasas?|paracetamol|ibuprofeno|aspirina)\b/iu,
    category: "EMERGENCIA_INTOXICACION",
    description:
      "Ingesta confirmada de sustancia tóxica clásica para mascotas",
    examplesMatched: [
      "comió chocolate",
      "se comió veneno",
      "tragó raticida",
      "ingirió cebolla",
      "comió uvas",
      "se comió paracetamol",
    ],
    examplesNotMatched: [
      "el chocolate es tóxico para perros",
      "le doy chocolate a veces",
      "qué pasa si come chocolate",
      "evita que coma chocolate",
    ],
  },

  // 4. Atropello explícito (recente, no condicional/hipotético)
  {
    // Trailing `\b` replaced with a Unicode-property negative lookahead
    // because JS `\b` is ASCII-only — it does not fire between `ó` and a
    // following space/EOF, which would silently break "la atropelló un auto".
    pattern: /\b(lo|la|me|nos)\s+atropell(ó|aron|aban)(?![\p{L}\p{N}_])/iu,
    category: "EMERGENCIA_TRAUMA",
    description: "Atropello explícitamente reportado",
    examplesMatched: [
      "lo atropellaron",
      "la atropelló un auto",
      "me lo atropellaron",
    ],
    examplesNotMatched: [
      "casi lo atropellan",
      "tengo miedo que lo atropellen",
      "el vecino fue atropellado",
    ],
  },

  // 5. Sangrado activo abundante
  {
    pattern: /\bsangra\s+(mucho|sin\s+parar|abundante|much[íi]simo)\b/iu,
    category: "EMERGENCIA_TRAUMA",
    description: "Sangrado activo abundante",
    examplesMatched: [
      "sangra mucho",
      "sangra sin parar",
      "sangra muchísimo",
      "sangra abundante",
    ],
    examplesNotMatched: [
      "antes sangraba",
      "sangra un poco",
      "no para de sangrar",
    ],
  },

  // 6. Inconsciencia / desmayo activo
  // Regex extended from spec's `desmay[óo]` to `desmay[óoa]` so that the
  // user-specified examplesMatched entry "se desmaya" (present 3sg)
  // passes the self-test.
  //
  // Known FP risk (see Step 8 of the C.3 implementation report and the
  // filosofía de diseño block below): no simple regex can distinguish
  // "se desmayó" (recent emergency) from "se desmayó hace meses"
  // (history). Both share the same `desmay[óoa]` prefix; the temporal
  // suffix is the only differentiator. We accept this FP as the cost of
  // catching genuine recent emergencies; tightening to present-tense
  // only (`desmay(a|an)`) would eliminate the FP but lose past-tense
  // recent ("se desmayó hace 30 segundos"). Re-evaluate when production
  // data arrives.
  {
    pattern:
      // Trailing `\b` replaced with a Unicode-property negative lookahead
      // for the same reason as pattern 4: `desmay[óoa]` can end in `ó`,
      // and ASCII-only `\b` does not fire between `ó` and following
      // whitespace/EOF.
      /\b(se\s+)?(desmay[óoa]|perdi[óo]\s+el\s+conocimiento|no\s+reacciona)(?![\p{L}\p{N}_])/iu,
    category: "EMERGENCIA_NEUROLOGICA",
    description: "Pérdida de conciencia activa o reciente",
    examplesMatched: [
      "se desmayó",
      "perdió el conocimiento",
      "no reacciona",
      "se desmaya",
    ],
    examplesNotMatched: [
      "tengo miedo que se desmaye",
      "le dieron pastillas para los desmayos",
      "tiene tendencia a desmayarse",
    ],
  },

  // 7. Vómito con sangre (hematemesis activa)
  // Verb-anchored to vomit(a|ó|ando) so noun "vómito" + "sangre" in the
  // same sentence (without an active verb) does not trigger.
  {
    pattern: /\bvomit(a|ó|ando)\s+sangre\b/iu,
    category: "EMERGENCIA_TRAUMA",
    description: "Hematemesis activa",
    examplesMatched: [
      "vomita sangre",
      "vomitó sangre",
      "está vomitando sangre",
    ],
    examplesNotMatched: [
      "antes vomitó algo de sangre",
      "vomita pero sin sangre",
      "su vómito tenía un poco de sangre",
    ],
  },
];

function matchEmergencyPattern(userMessage) {
  if (!userMessage || typeof userMessage !== "string") return null;
  const normalized = userMessage.trim();
  if (normalized.length === 0) return null;

  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.pattern.test(normalized)) {
      return {
        category: pattern.category,
        description: pattern.description,
        matchedPattern: pattern.pattern.source,
      };
    }
  }
  return null;
}

module.exports = { EMERGENCY_PATTERNS, matchEmergencyPattern };

// ── Self-test (runs at module load) ─────────────────────────────────
// Catching pattern regressions at function load beats discovering them
// in production. Cost: one log line per cold start when something is
// broken; zero overhead when patterns are healthy.
for (const p of EMERGENCY_PATTERNS) {
  for (const example of p.examplesMatched) {
    if (!p.pattern.test(example)) {
      console.error(
        `PATTERN_TEST_FAIL: pattern ${p.pattern.source} should match "${example}" but did not`,
      );
    }
  }
  for (const example of p.examplesNotMatched) {
    if (p.pattern.test(example)) {
      console.error(
        `PATTERN_TEST_FAIL: pattern ${p.pattern.source} should NOT match "${example}" but did`,
      );
    }
  }
}

/*
 * PATRONES DE EMERGENCIA — FILOSOFÍA DE DISEÑO
 *
 * Estos patrones existen para acelerar la respuesta en emergencias
 * INEQUÍVOCAS, NO para detectar todas las emergencias posibles. Esa
 * cobertura amplia es trabajo del clasificador LLM (Capa 2).
 *
 * Reglas para agregar nuevos patrones:
 *  1. El patrón debe coincidir SOLO en frases donde un humano lector
 *     confirmaría inmediatamente que es una emergencia activa.
 *  2. Verbos en presente o pasado reciente. Evitar futuro, condicional,
 *     habitual, hipotético.
 *  3. Anclar con verbo + objeto cuando aplique (ej: "comió chocolate"
 *     no solo "/chocolate/").
 *  4. Antes de agregar, escribir mínimo 5 examplesMatched y 5
 *     examplesNotMatched. El patrón debe pasar TODOS los
 *     examplesMatched sin matchear NINGUNO de los examplesNotMatched.
 *  5. Ante duda: NO agregar. La Capa 2 cubre los casos ambiguos.
 *
 * Falsos positivos en preempt son visibles e incómodos para el usuario
 * (le mandamos plantilla de emergencia a quien no la pidió). Falsos
 * negativos son recuperables (Capa 1 + Capa 2 actúan después).
 *
 * Cualquier modificación a estos patrones requiere correr el self-test
 * embedido en este módulo (la sección inmediatamente arriba) antes de
 * commit. Para correrlo manualmente desde la raíz del repo:
 *   node -e "require('./functions/safety/emergency-patterns.js')"
 * Si no aparece ningún PATTERN_TEST_FAIL en stderr, los patrones están
 * sanos.
 */
