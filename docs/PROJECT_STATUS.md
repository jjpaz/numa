# NUMA — estado del MVP

Actualizado para la integración de ramas del 14–15 de noviembre de 2026. Esta guía
separa el código integrado, los resultados históricos y las pruebas ejecutadas
durante la recuperación. El registro detallado está en
[IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md).

| Bloque | Estado |
|---|---|
| Portal del paciente | Buzón, revisión, My journal y My garden integrados en main mediante la PR #2; modo sencillo retirado de la interfaz |
| Portal del psicólogo y acceso por nombre | Incluidos en la integración; proyección clínica restringida y perfiles de presentación compartidos |
| Gemini y PostgreSQL/Aiven | Conexión real, transcripción/resumen, persistencia y controles de privacidad registrados en `8b6859b`; no repetidos contra producción en esta recuperación |
| API pública Modal | CPU, `NUMA_DEMO_MODE=false`, `NUMA_ML_ENABLED=false`, secretos y persistencia conectada; configuración conservada |
| DAM aislado en CPU/Windows y Modal/Linux | Herramientas y resultados históricos recuperados de `3388445` |
| Silero VAD/calidad, mínimo 30 s de habla estimada | Código, manifiesto y tests recuperados de `2a4c8e6`; sin conexión al diario |
| Chromium MediaRecorder | Validación histórica recuperada de `8e3cd21`: 19/19 casos, con captura real del navegador y entrada sintética |
| Safari/iPhone | Usuario confirmó grabación/reproducción/revisión en la demo anterior; VAD/DAM sobre un archivo real sigue pendiente |
| DAM/VAD dentro del diario e historial versionado | No implementados; ML permanece desactivado a propósito |
| Publicación del nuevo frontend | Un merge de GitHub no acredita un despliegue de Vercel; comprobar por separado qué versión está publicada |

## Verificación de esta integración

- `npm ci` y `npm run build`: aprobados antes de integrar el frontend.
- Backend y contratos ML recuperados: **111 aprobadas, 3 omitidas**. Se omiten
  dos comprobaciones con PostgreSQL dedicado y la prueba opt-in de DAM real.
- Edge: suite completa **30/31**; el caso restante funcionaba pero esperaba una
  etiqueta de ML antigua. Se corrigió esa aserción y se repitieron grabación y
  descarte de borrador: **2/2 aprobadas**. Los 31 escenarios están cubiertos entre
  ambas ejecuciones. Detalles en [el informe de diseño](../design-review/REPORT.md).
- `node --check scripts/make-vad-browser-fixture.cjs`: aprobado.
- La recuperación modifica herramientas ML aisladas, tests y documentación.
  No modifica `backend/app.py`, `analysis.py`, `repository.py`, `security.py`,
  `modal_app.py`, dependencias de la API, frontend ni plantillas de entorno.
- No se repitieron inferencias remotas ni se desplegaron servicios en esta tarea.
  Los resultados de Modal conservados son evidencia histórica, no ejecuciones nuevas.

## Pendientes

1. Verificar la versión publicada y repetir QA en dispositivos reales e impresión.
2. Conservar Gemini/Aiven y ML desactivado durante cualquier cambio de despliegue.
3. Si se retoma la integración DAM/VAD, acordar ese alcance por separado y completar
   contrato, historial versionado y evaluación de audio. Recuperar los commits no
   implementa ni activa esas fases.
4. Probar VAD/DAM con un archivo Safari real autorizado y ampliar la evaluación.

La reproducción de audio histórico sigue pendiente: el diario no conserva audio
crudo. La actualización de la vista clínica sí tiene pruebas de regresión y
verificación pública histórica; las pruebas ML aisladas no acreditan ese flujo.
Ningún resultado sintético constituye validación clínica.
