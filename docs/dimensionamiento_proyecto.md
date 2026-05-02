# Análisis Técnico y Dimensionamiento de Esfuerzo: Proyecto Pakumi

## 1. Resumen Ejecutivo
Pakumi no es un simple prototipo o MVP ensamblado rápidamente. Es una **plataforma integral de salud para mascotas** construida bajo estándares de ingeniería de software profesional. La solución integra una aplicación web interactiva y un asistente veterinario basado en Inteligencia Artificial (IA) distribuido a través de WhatsApp. El valor principal del desarrollo radica en su robusta arquitectura asíncrona, sus estrictas medidas de seguridad (especialmente en el manejo de datos médicos generados por IA) y su metodología de desarrollo documentada.

---

## 2. Metodología y Calidad de Ingeniería (El Diferenciador Profesional)
Lo que separa a este proyecto de un código "amateur" es la disciplina arquitectónica aplicada, evidente en todo el repositorio:

*   **Gestión de Deuda Técnica (Tech Debt Tracking):** El proyecto cuenta con un registro exhaustivo de deuda técnica (18 documentos detallados en `docs/debt/`). Esto demuestra que cada decisión rápida ("speed over polish") fue calculada, documentada y tiene un plan de mitigación. Esto es estándar de equipos Senior.
*   **Registros de Decisiones Arquitectónicas (ADRs):** Decisiones críticas (como la migración a Cloud Tasks para manejar la latencia de Twilio) están formalmente documentadas (`docs/decisions/`), explicando el contexto, las opciones consideradas y las consecuencias.
*   **Separación de Preocupaciones (Separation of Concerns):** El frontend, la base de datos (Firestore) y el motor de IA en el backend están totalmente desacoplados. El webhook de WhatsApp opera de forma independiente a la web.

---

## 3. Frontend: Aplicación Web Interactiva
Desarrollada con herramientas de última generación, no con plantillas HTML estáticas.

*   **Stack Tecnológico:** React 19, TypeScript (para seguridad de tipos), Vite (para empaquetado ultra rápido) y Tailwind CSS v4 para diseño responsivo.
*   **Arquitectura de Rutas y Seguridad:** Implementación de guardias de ruta (Auth Guards). Existen rutas protegidas (Dashboard, Historial, Recordatorios) y rutas públicas específicas (Perfil de Emergencia), gestionadas a través de un enrutador estructurado (`react-router-dom`).
*   **Componentes Complejos (UI/UX):**
    *   Generación dinámica de códigos QR descargables para collares.
    *   Formularios modulares e interactivos (`PetForm`, `AddEventForm`) con validación de datos.
    *   Visualización de datos de salud a través de gráficos (`HealthChart`) y líneas de tiempo cronológicas (`HistoryTimeline`).
*   **Gestión de Estado y Hooks Personalizados:** Abstracción de lógica de negocio en hooks como `useAuth`, `useRole` y `useDisclaimer`, manteniendo los componentes visuales limpios.

---

## 4. Backend: IA y Procesamiento Asíncrono
El componente de mayor complejidad técnica. No es un simple "pasarela" de mensajes, sino un agente de IA orquestado.

*   **Arquitectura Asíncrona (Google Cloud Tasks):** Twilio exige respuestas en menos de 15 segundos. Dado que los LLMs (como Gemini) pueden ser lentos, se implementó una arquitectura avanzada basada en colas (`whatsapp-processing-queue`). El webhook recibe el mensaje, lo encola y responde inmediatamente a Twilio, mientras un "worker" procesa la IA en segundo plano, garantizando estabilidad y cero pérdida de mensajes.
*   **Sistema de Seguridad Veterinario de 3 Capas:**
    1.  **Capa 1 (Prompting):** Restricciones de sistema inyectadas en el LLM para evitar diagnósticos médicos y forzar la derivación al veterinario.
    2.  **Capa 2 (Post-Clasificador LLM):** Un segundo llamado a la IA (con un timeout estricto de 2.5s y diseño "fail-open") que evalúa la respuesta generada para detectar si la situación es una emergencia (Respiratoria, Intoxicación, etc.) y forzar un protocolo seguro.
    3.  **Capa 3 (Regex Pre-empt):** Patrones de expresiones regulares que interceptan emergencias obvias incluso antes de consultar a la IA, garantizando tiempo de respuesta cero en crisis.
*   **Extracción de Datos Estructurados (Data Mining):** El backend analiza la conversación en lenguaje natural y extrae un JSON estructurado de eventos de salud (síntomas, vacunas, peso), asignando fechas implícitas e insertándolos automáticamente en la base de datos de la mascota.
*   **Memoria Conversacional y Resumen:** El sistema cuenta la longitud de la conversación y utiliza la IA para generar resúmenes periódicos de las charlas, ahorrando costos de tokens y manteniendo el contexto del paciente.

---

## 5. Base de Datos y Seguridad (Cloud Firestore)
Modelado de datos diseñado específicamente para la privacidad y la escalabilidad.

*   **Patrón de Doble Colección (Load-bearing architecture):** 
    *   `pets/{petId}`: Contiene historial médico completo, solo accesible por el dueño (privado).
    *   `emergency_profiles/{petId}`: Un subconjunto mínimo de datos vitales (nombre, teléfono del dueño) legible públicamente para cuando alguien escanea el código QR de un perro perdido.
*   **Reglas de Seguridad (Firestore Rules):** Implementación estricta de `deny-by-default`. Las reglas incluyen Control de Acceso Basado en Roles (RBAC), distinguiendo permisos entre dueños, partners, administradores y superadministradores. Solo los Cloud Functions (que operan como Admin) pueden escribir el historial extraído por WhatsApp.

---

## 6. Conclusión de Esfuerzo (Sizing Estimation)
El nivel de abstracción (TypeScript), la gestión de concurrencia/asincronía (Cloud Tasks), el refinamiento de *prompts* para extracción estructurada de datos y la implementación de sistemas de seguridad tipo *fail-safe* para la IA, sitúan este desarrollo en la categoría de **Ingeniería de Software Senior**.

**Estimación de Inversión Tecnológica:**
Para replicar esta arquitectura fundacional con este nivel de robustez, documentación y preparación para escalar, se estima un esfuerzo de entre **120 y 160 horas efectivas de desarrollo Senior Full-Stack/IA**. 

Esta base no es un código desechable ("throwaway code"); es una infraestructura de grado de producción lista para recibir carga de usuarios y escalar funcionalidades sin necesidad de reescribir la arquitectura central.
