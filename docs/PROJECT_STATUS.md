# NUMA — estado del MVP

Actualizado: 14 de noviembre de 2026. Esta lista describe ejecución real;
los detalles técnicos están en [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md).

| Bloque | Estado |
|---|---|
| Demo pública Modal + Vercel y acceso por nombre | Publicada y probada; memoria efímera |
| DAM aislado en CPU/Windows y Modal/Linux | Ejecutado con pesos reales |
| Filtro Silero VAD/calidad, mínimo 30 s de habla | Implementado y probado aisladamente |
| Audio de MediaRecorder Chromium | Generado realmente y aceptado por VAD en Modal; 19/19 casos |
| Safari/iPhone y micrófono físico | Usuario confirmó grabación, reproducción y revisión en la demo; archivo Safari por VAD/DAM pendiente |
| DAM/VAD dentro del flujo del diario | Pendiente, fase C |
| Historial versionado y evaluación técnica | Pendiente, fase D |
| Gemini y PostgreSQL/Aiven | Código preparado; conexión real pendiente, fase E |
| Backend conectado y recorrido público completo | Pendiente, cierre F/G |

Pruebas de código más recientes: **81 aprobadas, 2 omitidas**. La batería remota
más reciente pasó **19/19 casos**; las validaciones quedaron detenidas. Los tests
sintéticos comprueban ejecución técnica, no precisión clínica.

El usuario confirmó la prueba manual de grabación/reproducción/revisión en la demo.
Como la demo todavía no usa VAD/DAM, pasar esa prueba no acredita la inferencia
sobre un archivo real de Safari. Ese pendiente debe conservarse al integrar el
archivo/pipeline. Es un resultado comunicado por el usuario, no observado por el agente.

## Orden inmediato

1. Conservar el resultado manual Safari/iPhone y comprobar el archivo real con el
   pipeline alojado cuando se integre; la aceptación completa de audio sigue abierta.
2. Integrar el contrato de VAD/DAM en el backend y el historial, preservando que
   el diario se pueda guardar cuando no haya resultado de ML.
3. Conectar por separado Gemini y Aiven, comprobar persistencia y privacidad.
4. Desplegar el conjunto y probar el recorrido público desde móvil/ordenador.

Peticiones del usuario aplazadas: reproducir audio histórico (requiere revisar la
retención de audio) y reflejar los nuevos registros en la vista del psicólogo sin
exponer palabras o audio privados. No están resueltas por las pruebas aisladas.

El consumo se revisará al cerrar bloques. El saldo y sus diferencias se comunican
en el chat; son de toda la cuenta y pueden incluir otros chats. No se infiere un
porcentaje de proyecto terminado ni una fecha a partir de créditos disponibles.
