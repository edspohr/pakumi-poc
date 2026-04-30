# Pakumi team update — 2026-04-30 async migration

To send to the Pakumi team WhatsApp group **after** smoke tests
confirm the deploy worked. Tone is calm and forward-looking because
the team has already been told that maintenance is happening.

---

*Mejora desplegada · 30 de abril · 18:00 aproximado*

Equipo, ya está desplegada la mejora estructural del agente. Pueden
retomar las pruebas con tranquilidad.

Lo que cambió por dentro: el agente ahora procesa cada consulta sin
el límite de tiempo que imponía WhatsApp por mensaje. Si una respuesta
toma más de 5 segundos, el agente envía un mensaje intermedio
("Estoy procesando tu consulta, te respondo en un momento...") para
que sepan que está trabajando. La respuesta completa llega cuando
esté lista, sin perderse.

Las consultas elaboradas que antes fallaban (como la pregunta de
Betsy sobre la correa de Kira) ahora deberían responderse correctamente.
Si detectan algún comportamiento raro, me avisan.
