# 0008 — Emergency response templates: clinical validation

| Field         | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| **Status**    | open                                                                                   |
| **Priority**  | high — **BLOCKER for Hito 3 production migration**                                     |
| **Detected**  | 2026-04-25                                                                             |
| **Resolved**  | —                                                                                      |
| **Owner**     | Edmundo Spohr (Growth Buddies) + clinical veterinary partner (TBD, Pakumi responsibility) |
| **Category**  | safety / clinical                                                                      |

> **Placeholder.** This file reserves ID 0008 for the emergency-templates
> clinical-validation track scheduled for **Bloque C.4 of the development
> weekend (2026-04-26)**. The fields below are the working brief; concrete
> template content, partner identity, and validation artifacts will be
> attached as that work lands.

## Context

Pakumi's WhatsApp agent will include **emergency response templates** for
veterinary urgencies, covering at minimum:

- Poisoning / toxin ingestion
- Respiratory distress
- Trauma (vehicular, falls, bite wounds)
- Neurological events (seizures, sudden ataxia, loss of consciousness)
- Obstetric complications (dystocia, post-partum emergencies)

These templates instruct pet owners on **immediate actions** ("do not induce
vomiting," "keep the animal warm and immobile," etc.) and direct them to
**seek emergency veterinary attention**. They are triggered when the
WhatsApp agent classifies an inbound message as one of the above categories.

Implementation is scheduled for **Bloque C.4** of the current development
weekend (2026-04-26). The expected code location is
`functions/safety/emergency-templates.js`.

## Impact

Without clinical veterinary validation, emergency templates may contain
**incorrect or harmful guidance** — both as a matter of patient safety and
as a matter of legal liability. Specific failure modes:

- Wrong first-aid instruction (e.g. inducing vomiting for a corrosive
  ingestion, which compounds the injury).
- Omitted contraindication relevant to a specific species or breed.
- Underplaying urgency on a presentation that needs immediate vet contact
  versus monitoring at home.
- Jurisdictional liability under Peru consumer-protection / health-services
  rules.

**Production deployment with the client's public WhatsApp number (Hito 3)
is BLOCKED until clinical validation is complete and signed off.** This is
the gating constraint, not a "nice to have."

## Current workaround

- **Templates currently authored by software engineers based on general
  knowledge.** Treat them as placeholders pending clinical sign-off.
- **POC environment uses Twilio Sandbox** ([0006](./0006-twilio-sandbox-only.md)),
  which means only explicitly opted-in users can reach the agent. This
  caps blast radius during the validation window.
- **All templates include an explicit "consulta a tu veterinario tratante"
  reminder** as a baseline mitigation, on top of the emergency-direction
  instruction itself.

## Proposed fix

1. **Engage a clinical veterinarian** (DVM-equivalent qualification) under
   Pakumi's responsibility, with experience in primary-care / emergency
   small-animal practice in **Peru jurisdiction** (matching the deployment
   geography for liability purposes).
2. **Review pass:** veterinarian reviews each emergency template for
   accuracy, completeness, and legal liability. Comments captured per
   template.
3. **Revision pass:** integrate the veterinarian's edits into
   `functions/safety/emergency-templates.js` (or whatever path Bloque C.4
   lands on).
4. **Sign-off:** veterinarian signs a validation document covering the
   reviewed templates and the date / version range that sign-off applies
   to. Document attached to this debt item.
5. **Re-validation cadence:** decide a re-review trigger (e.g. any change
   to a template, plus an annual refresh).

Effort: **L** in calendar time (mostly external partner availability);
implementation effort once feedback is in hand is **S–M**.

**Trigger to start:** Bloque C.4 ships the placeholder templates →
veterinary partner engagement begins immediately after.

**Resolution criteria:** signed validation document attached to this file,
all templates in `functions/safety/emergency-templates.js` reflect
veterinarian-approved wording, status flips to `resolved`. Until then,
Hito 3 cannot proceed.

## References

- ADR: [`docs/decisions/ADR-001-pakumi-platform.md`](../decisions/ADR-001-pakumi-platform.md) — overall safety architecture rationale
- Related debt:
  - [0003 — Rich pet profile schema](./0003-rich-pet-profile-schema.md) — also blocked on a clinical partner; same engagement may cover both tracks
  - [0006 — Twilio Sandbox only](./0006-twilio-sandbox-only.md) — limits public exposure during the validation window
- Prior art: ConectApp engaged Juan Pablo and Erika as clinical partners
  for equivalent human-safety templates. The same engagement pattern
  (review pass → revisions → signed sign-off) should be reused here, scoped
  to veterinary practice instead of human medicine.
- Future code: `functions/safety/emergency-templates.js` (does not yet
  exist; created in Bloque C.4)

## History

- **2026-04-25** — Created as placeholder by Edmundo Spohr, reserving ID
  0008 for the emergency-templates work scheduled in Bloque C.4 of the
  weekend plan. Status `open`, priority `high` from inception because the
  gap is a known Hito 3 blocker.
- **2026-04-25** — Anexo agregado con 5 instrucciones específicas
  consideradas y excluidas durante C.4 (ver sección al final del
  archivo). Input directo para la futura conversación con el partner
  clínico.

---

### Anexo: Información médica específica considerada y NO incluida (2026-04-25)

Durante la implementación de C.4 (`functions/safety/emergency-templates.js`,
commit pendiente), las siguientes instrucciones específicas fueron
consideradas y deliberadamente excluidas hasta validación clínica.
Esta lista es input directo para la conversación con el partner
veterinario cuando esta deuda se aborde:

**EMERGENCIA_INTOXICACION:**
- Considerado: "no induzcas vómito"
- Razón de exclusión: error contra-indicativo común que vale la pena
  prevenir, pero la decisión "inducir vs no inducir vómito" depende del
  tóxico específico, tiempo desde ingestión y especie. Requiere lógica
  clínica que excede plantilla genérica.
- Pregunta para partner clínico: ¿hay un subset de tóxicos donde "no
  inducir vómito" sea universalmente correcto y se pueda mencionar?

**EMERGENCIA_TRAUMA:**
- Considerado: "si hay sangrado, aplica presión limpia"
- Razón de exclusión: "aplica presión" es instrucción médica explícita,
  bloqueada por self-test de plantillas (palabra prohibida).
- Pregunta para partner clínico: ¿debería incluirse first-aid básico
  para sangrado externo? ¿Cómo distinguir cuándo SÍ aplicar presión
  (heridas externas) vs cuándo NO (potencial fractura abierta)?

**EMERGENCIA_NEUROLOGICA:**
- Considerado: "intenta cronometrar la duración del episodio"
- Razón de exclusión: limítrofe — observación pasiva vs instrucción
  clínica. Versión incluida es softer: "Si tienes registro del momento
  en que comenzó, compártelo con el veterinario."
- Pregunta para partner clínico: ¿la observación de duración es
  información que un dueño puede registrar sin riesgo? ¿Vale la pena
  ser más explícito sobre cronometrar?

**EMERGENCIA_OBSTETRICA:**
- Considerado: "si el cachorro está atorado, no lo extraigas tú"
- Razón de exclusión: instrucción específica que un veterinario debería
  dar telefónicamente caso por caso, no una plantilla genérica.
- Pregunta para partner clínico: ¿hay protocolo escrito de "qué NO
  hacer" en distocia que pueda incluirse?

**EMERGENCIA_RESPIRATORIA:**
- Considerado: "verifica si las encías están azules o moradas (cianosis)"
- Razón de exclusión: observación clínica que ayuda al veterinario en
  triaje telefónico, pero la versión actual no la incluye por
  conservadurismo.
- Pregunta para partner clínico: ¿las observaciones de signos vitales
  visibles (color de encías, ritmo respiratorio) son seguras de
  instruir a dueños? Probablemente sí — es candidato fuerte para
  inclusión post-validación.

---

Cuando el partner clínico esté engaged, esta lista debe ser revisada
ítem por ítem para decidir incorporación. Las plantillas aprobadas
luego deben pasar el self-test de palabras prohibidas — si la
incorporación genera necesidad de relajar ese guard, esa decisión
también requiere sign-off clínico.
