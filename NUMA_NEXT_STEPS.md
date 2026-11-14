# Numa — guía para retomar la implementación pendiente

Fecha de referencia: **14 de noviembre de 2026**.
Proyecto: `C:\JUNCTION\numa`.

Este documento permite retomar el trabajo con Codex sin reconstruir el contexto del chat. Describe tareas futuras: **su presencia aquí no significa que estén implementadas o verificadas**. No ejecutar estas tareas al leer el documento; ejecutarlas cuando el usuario pida continuar.

## 1. Estado real al dejar el proyecto

| Área | Implementado | Pendiente |
|---|---|---|
| Producto e interfaz | Dos portales, journal privado, grabación y texto, acciones, feedback, preferencias, hábitos y experimentos | QA manual final en dispositivos reales e informe impreso |
| Experiencia progresiva | Inicio sencillo, módulos elegidos, invitaciones y modo sencillo reversible; nueva paleta | Conservar el diseño y comportamiento durante las integraciones |
| Audio | Micrófono, waveform, normalización y medición de duración, energía RMS, pausas y clipping | Detección de habla efectiva y evaluación de calidad más completa |
| ML vocal | SpeechBrain preparado en la aplicación; **DAM ejecutado aisladamente en CPU/Windows y Modal/Linux**, con revisiones fijadas y pruebas reales | Integrar VAD y DAM en la aplicación; evaluar robustez y validez para el uso previsto |
| Historial personal | Baseline acústico con mediana/MAD y heurísticas de cambios | Incorporar resultados versionados del modelo y evaluar su estabilidad |
| Recomendaciones | Reglas sobre preferencias, contexto y feedback | Evaluación con datos reales; no hay un recomendador entrenado |
| Gemini | Código para transcribir, resumir y extraer menciones explícitas | Credenciales y pruebas reales de las llamadas |
| Persistencia | Repositorio PostgreSQL y comprobación de propiedad/rol | Conexión real a Aiven y prueba de persistencia |
| Despliegue | Backend demo Modal + frontend Vercel publicados; prueba aislada DAM/Linux ejecutada | Integrar el pipeline y servicios conectados sin perder el punto de retorno demo |

Última verificación conjunta de backend/contratos: **54 pruebas aprobadas, 2 omitidas** (PostgreSQL sin conexión y prueba local DAM opt-in desactivada). Además, DAM se ejecutó realmente en **Modal/Linux/CPU**, desde una caché de pesos persistida y con la red bloqueada durante inferencia; dos repeticiones produjeron valores finitos e idénticos. Audio: voz sintética inglesa de 57,095 segundos, sin evaluación clínica. La demo pública tiene acceso por nombre; sus últimos 7 escenarios de navegador pasaron al implementarlo y el usuario confirmó grabación en móvil. No se repitieron al añadir esta validación aislada. Ver `docs/ML_DAM_MODAL.md` y `docs/IMPLEMENTATION_LOG.md`.

El modo local y la demo pública utilizan memoria temporal. Existe una utilidad de copia/restauración para reinicios controlados, pero no sustituye la persistencia conectada. Backend demo y frontend ya están publicados; el acceso del equipo a Modal está configurado. No se han activado Gemini/Aiven ni se afirma haber canjeado créditos del evento.

## 2. Decisiones que se deben conservar

- Mantener el frontend actual. Limitar cambios posteriores a contratos, etiquetas veraces y estados necesarios para integrar el backend; no rediseñar los portales.
- Usar **DAM preentrenado y congelado** como candidato principal. No entrenar una red desde cero para completar el MVP.
- Mantener independientes la señal vocal y las declaraciones explícitas del journal. No interpretar desacuerdo como mentira.
- El diario se puede guardar sin un resultado de ML, sin una puntuación de ánimo y aunque una integración falle.
- No determinar qué módulos puede ver alguien a partir de una estimación emocional. Conservar elección, privacidad y modo sencillo.
- **Una base persistente: PostgreSQL en Aiven. Un proveedor de LLM: Gemini. Un entorno de cómputo ML: Modal.** No añadir otra base, LLM o nube para aumentar participaciones en premios.
- **Toda funcionalidad nueva debe poder desplegarse y funcionar fuera del ordenador de desarrollo.** Destinos previstos: frontend en Vercel, backend/ML en Modal (Linux) y persistencia en Aiven. Evitar dependencias de rutas `C:\`, procesos de desarrollo, archivos del usuario o utilidades exclusivas de Windows en el runtime. Configurar rutas de caché, secretos y orígenes mediante entorno o parámetros; usar el volumen de Modal solo para artefactos del modelo y audio temporal para procesamiento. Fixtures, comandos y locks de Windows son herramientas de desarrollo opcionales. Cada entrega debe documentar su ruta de despliegue y distinguir portabilidad prevista de despliegue realmente verificado; una prueba local no completa la aceptación cloud de las fases F/G.
- El psicólogo continúa recibiendo una proyección restringida. Ni transcripciones, resúmenes privados, audio, preguntas de experimentos ni reflexiones se incorporan a sus respuestas.
- Sueño, actividad, meteorología y música siguen simulados y etiquetados. Apple Health, Last.fm, calendario y wearables no son requisitos de esta entrega.
- Ninguna salida nueva debe presentarse como diagnóstico, medida de sinceridad o recaída confirmada tras TMS.

La documentación anterior sigue siendo contexto útil. **DAM ya funciona como experimento independiente; la aplicación continúa con su adaptador SpeechBrain/acústico anterior.** No confundir la CLI verificada con una migración del backend conectado.

## 3. Primer paso al retomar

1. Leer `README.md`, `NUMA_BUILD_BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/GROWTH.md`, `docs/ML_DAM.md` y `docs/IMPLEMENTATION_LOG.md`.
2. Inspeccionar el código y las modificaciones del usuario antes de editar. No sobrescribir cambios ajenos ni copiar otro MVP.
3. Comprobar versiones de Python/Node y presencia de credenciales **sin imprimir sus valores**. Hay plantillas `.env.example` y `.env.production.example`; una plantilla no implica una cuenta configurada.
4. Revisar los puntos de entrada: `backend/analysis.py`, `backend/app.py`, `backend/domain.py`, `backend/modal_app.py` y `backend/smoke.py`.
5. Tomar como referencia las verificaciones registradas. Repetirlas si el entorno o el código han cambiado; anotar lo que realmente se ejecuta.

Si hay una vista previa activa con datos que conservar, no reiniciarla sin copia. Usar `python -m backend.preview` con la API local accesible y después restaurar mediante `backend.preview:create_preview`. No imprimir el contenido de `.local/`, que puede incluir palabras privadas. Las pruebas de navegador usan **5174/8001**; reservar **5173/8000** para la vista previa del usuario.

## 4. Orden de implementación

**Orden acordado tras completar la fase A:** las letras siguientes conservan los bloques de trabajo originales; la ejecución pendiente sigue este orden para validar primero el entorno definitivo:

1. **Validación inicial de Modal (adelanto de la fase F), completada técnicamente:** entorno Linux/CPU fijado, pesos reales e inferencia remota aislada verificados. Ver `docs/ML_DAM_MODAL.md`. No conecta DAM a la aplicación ni completa toda la fase F.
2. **Fase B, siguiente trabajo:** VAD y calidad del audio sobre el entorno ya verificado.
3. **Fases C/D:** integrar el contrato del backend y el historial versionado; completar las comprobaciones técnicas correspondientes.
4. **Fase E y cierre de F:** conectar Aiven/Gemini y terminar el despliegue del backend con sus secretos, orígenes y comprobaciones.
5. **Fase G:** conectar/publicar el frontend y verificar el recorrido externo completo.

Cerrar cada bloque con implementación, pruebas y documentación antes de abrir otro. Si no hay margen para completarlo, detenerse antes de empezarlo. No avanzar con dependencias exclusivas de desarrollo que después haya que sustituir para alojar el producto.

### Fase A — ejecutar DAM de forma independiente (completada técnicamente)

**Objetivo:** obtener una inferencia real reproducible, sin necesitar Gemini, Aiven o el servidor web.

**Estado al 14 de noviembre:** entorno `.venv-ml` con Python 3.11.14, PyTorch/torchaudio 2.7.0 CPU, lock de dependencias y manifiesto con revisiones completas. CLI `python -m backend.ml.check`, caché ignorada e informes privados explícitos. Inferencia Windows real sin red: carga 6,796 s, inferencia 5,340 s en un proceso nuevo con pesos ya descargados. **La validación aislada Modal/Linux también pasó**; el siguiente bloque es fase B. El audio fue generado con TTS inglesa de Windows; no se usaron grabaciones privadas. Los pasos conservados a continuación documentan la fase A; instrucciones en `docs/ML_DAM.md` y `docs/ML_DAM_MODAL.md`.

1. Crear un entorno ML separado con Python 3.11. No alterar la `.venv` que mantiene funcionando el prototipo hasta verificar compatibilidad.
2. Consultar la ficha, código, dependencias y licencia actuales de [KintsugiHealth/DAM](https://huggingface.co/KintsugiHealth/dam). Fijar un commit completo, no una rama móvil como `main`, para la ejecución reproducible.
3. Auditar los archivos necesarios para cargar el modelo. Mantener las atribuciones de terceros; la licencia MIT de Numa no sustituye las de pesos, código o datos descargados.
4. Resolver y fijar una combinación compatible de PyTorch, torchaudio, transformers, peft y dependencias de audio. El archivo upstream consultado mezcla versiones de PyTorch y torchaudio: **no copiarlo a ciegas**.
5. Descargar los pesos y recursos del modelo en una caché ignorada por Git. El checkpoint consultado era de aproximadamente 736 MB, además de recursos auxiliares; comprobar tamaño real antes de descargar.
6. Implementar un adaptador aislado, por ejemplo `backend/ml/dam_adapter.py`, con carga diferida y reutilización de una única instancia. Evitar colisiones con nombres genéricos upstream como `config`, `model` o `pipeline`.
7. Mantener el preprocesamiento de referencia y ejecutar inferencia sin gradientes. Usar `quantize=False`: conservar salidas numéricas internas sin convertirlas en categorías clínicas.
8. Crear una CLI independiente, por ejemplo `python -m backend.ml.check --audio <ruta>`. Debe funcionar sin importar `create_app`, abrir la base de datos o exigir claves de Gemini.
9. La CLI debe producir un informe con éxito/fallo, versión, duración y latencia. Escribir resultados sensibles solo en una ruta local explícita e ignorada por Git; no volcarlos por defecto en logs compartidos.

**Aceptación:** el proceso carga pesos reales, procesa una grabación apropiada, devuelve valores finitos y registra la revisión exacta y las dependencias utilizadas. Añadir una prueba con el modelo real separada de las pruebas con mocks. Si no se ha ejecutado, escribir «no verificado», no «integración completada».

### Fase B — habla efectiva y rechazo de muestras inadecuadas

**Objetivo:** decidir cuándo existe audio suficiente para intentar el análisis.

1. Mantener el límite actual de dos minutos, normalización mono/16 kHz, comprobaciones de silencio/clipping y límites de carga.
2. Integrar [Silero VAD](https://github.com/snakers4/silero-vad) como detector de habla, fijando versión y verificando licencia/dependencias. Es una utilidad de preprocesamiento en el mismo entorno, no otro proveedor cloud ni otro modelo clínico.
3. Calcular intervalos de habla y `speech_duration_sec`. No equiparar la duración del archivo a la duración hablada.
4. Para DAM, exigir inicialmente **30 segundos de habla efectiva** como criterio conservador del prototipo, basado en la recomendación publicada por sus autores. Mantener configurable y versionada esta política.
5. Conservar el audio temporal original para las características de pausas y energía. Si se construye una señal recortada para el modelo, no medir después las pausas sobre ese audio sin silencios.
6. Respetar el preprocesamiento de DAM. No reutilizar automáticamente la actual división en ventanas de diez segundos ni el promedio de categorías de SpeechBrain.
7. Registrar fallos de decodificación, silencio, clipping y habla insuficiente. Medir robustez frente a ruido/música; no inventar una estimación de SNR o calidad que no se calcule realmente.
8. El alcance inicial es una voz en inglés. Si idioma o hablantes no se evalúan automáticamente, registrar ese límite y comprobarlo en las muestras de evaluación; no afirmar que un VAD hace diarización o detecta el idioma.

**Aceptación:** un archivo largo con poco habla no recibe una predicción clínica; tampoco la reciben silencio o audio inválido. La entrada sigue siendo guardable. Probar muestras justo por debajo y por encima del umbral, música, ruido, varios hablantes y formatos reales de Chrome/Safari. Documentar limitaciones que todavía no puedan detectarse de forma automática.

### Fase C — sustituir el adaptador y definir un contrato correcto

**Objetivo:** incorporar DAM al backend sin reinterpretar sus salidas ni romper registros anteriores.

1. Cambiar la selección de modelo en `backend/analysis.py` y la configuración del entorno. Hoy `MODEL_ID` está fijado a SpeechBrain y `NUMA_VOICE_MODEL` de la plantilla no gobierna realmente la carga: corregir esa discrepancia.
2. Separar calidad acústica, ejecución de ML y resultado. Una nota puede tener acústica utilizable y no alcanzar el mínimo de habla para DAM.
3. Mantener la compatibilidad de campos existentes. Añadir un esquema versionado con, como mínimo:

   ```text
   model, model_revision, pipeline_version
   ml_status
   speech_duration_sec
   raw_scores: {depression, anxiety}  # solo si la inferencia termina correctamente
   quality / quality_flags
   features                        # características acústicas independientes
   source                          # measured, simulated, etc.
   ```

4. Distinguir al menos `not_configured`, `insufficient_speech`, `quality_rejected`, `completed` y `failed`. No producir una puntuación cero para representar un fallo.
5. **No colocar resultados de DAM dentro de `probabilities`.** El frontend actual interpreta ese campo como porcentajes de categorías emocionales. Los valores crudos de DAM no tienen ese significado. Mantenerlo vacío para DAM y conservar los registros históricos con su tipo original.
6. No aplicar los umbrales clínicos upstream a los pacientes de Numa ni mostrar puntuaciones PHQ/GAD estimadas sin evaluación específica. Las observaciones deben describir el estado de procesamiento y sus límites.
7. Conservar las ramas de voz y texto independientes. Una edición de transcripción vuelve a evaluar el texto, nunca el audio ni sus resultados.
8. Preservar idempotencia, estados de trabajo, recuperación de tareas interrumpidas y posibilidad de guardar después de un fallo parcial.
9. Actualizar el health check para distinguir «configurado» de «cargado/probado». Actualmente `voice_model_enabled` depende del modo demo; eso no demuestra una inferencia exitosa.
10. Mantener la vista previa acústica como fallback explícito. No sustituir DAM silenciosamente por otro modelo ni por una predicción simulada.

**Aceptación:** se guarda una salida real versionada sin porcentajes falsos; modelos antiguos no cambian de significado; fallos no bloquean el journal; el psicólogo sigue sin recibir campos privados. Las etiquetas visibles describen correctamente lo que está activo, sin reabrir el diseño.

### Fase D — historial personal y evaluación técnica

**Objetivo:** estudiar comparabilidad y estabilidad antes de añadir nuevas interpretaciones.

1. Conservar el baseline acústico existente como heurística provisional. Documentar que cinco días y sus umbrales no son una validación clínica.
2. Guardar las nuevas señales de DAM como serie independiente. Comparar únicamente resultados con modelo, revisión, preprocesamiento y condiciones de calidad compatibles.
3. No mezclar muestras simuladas con el historial del perfil nuevo. Los follow-ups no deben convertirse en nuevas jornadas de baseline.
4. Ante una actualización de modelo o pipeline, separar versiones o reconstruir la referencia con datos legítimamente disponibles. Si no se conserva audio, no prometer que se pueden recalcular inferencias antiguas.
5. No convertir una variación entre dos notas en «mejora» o «recaída». No generar nuevas alertas médicas automáticas a partir de DAM en esta fase.
6. Crear un pequeño banco de pruebas consentido o con licencia adecuada. Incluir duraciones, dispositivos, distancias, ruido y acentos distintos. Versionar un manifiesto sin información identificativa; no incluir grabaciones privadas en Git.
7. Medir: tasa de procesamiento, rechazos, repetibilidad sobre el mismo archivo, sensibilidad a cambios de captura, latencia en frío/caliente y consumo de memoria. Estas métricas son técnicas, no precisión clínica.
8. Si se calculan sensibilidad, especificidad, MAE o calibración, usar etiquetas independientes adecuadas y separar validación y test. No evaluar con las propias predicciones del modelo como verdad.

**Aceptación:** existe un informe reproducible de mediciones reales, con límites de las muestras y errores observados. Los audios de compañeros interpretando emociones no se presentan como validación de depresión o de seguimiento tras TMS.

### Fase E — conectar Gemini y Aiven

**Gemini:**

1. Activar el acceso del equipo y guardar la clave en el entorno del servidor.
2. Verificar que `GEMINI_MODEL` corresponde a un modelo accesible y compatible con audio/JSON. El valor de la plantilla es una configuración de referencia, no una garantía futura de acceso.
3. Probar transcripción normalizada a WAV y, después, análisis semántico solo sobre texto. Comprobar que cada sentimiento explícito conserva evidencia literal y que la ausencia de declaración queda vacía.
4. Probar timeout, cuota agotada, respuesta inválida y correcciones manuales. Mantener el resumen editable y el guardado tras fallos.
5. Verificar explicaciones de recomendaciones frente al historial disponible. No inventar cifras, evidencia o causalidad.

**Aiven:**

1. Crear únicamente PostgreSQL y configurar `DATABASE_URL` con TLS y los requisitos de certificado de la cuenta.
2. Probar creación de tabla, escritura, lectura, actualización y eliminación usando registros de verificación propios.
3. Ejecutar la prueba con `TEST_DATABASE_URL` en una instancia de prueba dedicada. No apuntar la suite a datos del usuario.
4. Verificar persistencia de entradas, feedback, notas, crecimiento, hábitos y experimentos tras reiniciar el backend.
5. Probar aislamiento de propietarios y asignaciones, además de la proyección clínica. No migrar automáticamente datos privados de la vista previa sin una decisión explícita sobre qué conservar.

**Aceptación:** ambas integraciones funcionan por separado y en el flujo de una entrada. El frontend no contiene claves o URI de la base de datos. La aplicación conectada mantiene PostgreSQL como única fuente persistente.

### Fase F — adaptar Modal y los comandos de comprobación

**Ejecutar primero la validación aislada del entorno e inferencia en Modal**, antes de la fase B. El despliegue de la aplicación completa y las comprobaciones de credenciales/concurrencia de este bloque se terminan después de las integraciones. No confundir estos dos hitos ni marcar toda la fase F completada con una sola inferencia remota.

Ese primer hito aislado ya está verificado y documentado en `docs/ML_DAM_MODAL.md`; los pasos siguientes siguen pendientes para la integración de la aplicación completa.

1. Sustituir las dependencias de SpeechBrain de `backend/modal_app.py` por el entorno DAM ya verificado. Conservar Python 3.11 y ffmpeg si siguen siendo compatibles.
2. Reutilizar un único modelo cargado y la caché de pesos. No guardar audio de pacientes en el volumen del modelo.
3. Separar configuración de inferencia del modo de datos demo. Una CLI ML no debe exigir Gemini/PostgreSQL; la aplicación conectada sí debe validar sus credenciales.
4. Configurar el secreto `numa-secrets`, los límites de uso y la allowlist de orígenes. Comprobar presupuesto antes de mantener una GPU encendida.
5. Medir arranque en frío, tiempo de inferencia y comportamiento con peticiones simultáneas. Mantener inicialmente un solo contenedor, coherente con los locks y trabajos actuales.
6. Actualizar `backend/smoke.py`: actualmente comprueba un audio de SpeechBrain y espera probabilidades sumando uno. Esa prueba no sirve para DAM. Separar comprobaciones ML, Gemini y PostgreSQL para que puedan ejecutarse independientemente.
7. No declarar éxito con un health check de configuración. Ejecutar una inferencia real en Modal y verificar el resultado desde un cliente.

**Aceptación:** imagen construida, pesos correctos, inferencia real por el endpoint, tiempos y errores registrados, límites de coste conocidos. Para varios contenedores o trabajo durable se necesitaría otra fase; no activar escalado distribuido con los locks y cola actuales.

### Fase G — recorrido conectado y publicación

1. Compilar y publicar el frontend en Vercel; configurar `VITE_API_BASE` con el origen de Modal y reconstruir.
2. Establecer el origen HTTPS exacto del frontend en `NUMA_ALLOWED_ORIGINS`. No exponer secretos del servidor mediante variables `VITE_*`.
3. Mantener sesiones firmadas, contraseñas demo únicas y ausencia de registro público. No presentar estas cuentas de demostración como un sistema listo para pacientes reales.
4. Probar entre dos dispositivos o contextos independientes: grabar, analizar, revisar, guardar, probar una acción y registrar feedback; comprobar actualización clínica en menos de diez segundos con la pestaña visible.
5. Verificar directamente la API: el rol clínico no obtiene journal privado, audio, experimentos o reflexiones, aunque intente consultar endpoints del paciente.
6. Probar Chrome/Edge y Safari/iOS reales: permisos, interrupciones de grabación, formatos, pérdida de red, caducidad de sesión y recuperación.
7. Imprimir el informe en A4 y comprobar legibilidad y paginación; una captura de la pantalla no verifica el PDF final.
8. Ensayar con audio real consentido y datos ficticios claramente identificados. Actualizar vídeo y guion para que las afirmaciones coincidan con lo que realmente funciona.

**Aceptación:** URL pública utilizable, persistencia tras reinicio, permisos verificados, recuperación de fallos y demo reproducible. Mantener visible la diferencia entre mediciones reales y contexto simulado.

## 5. Configuración y recursos

Revisar y actualizar las plantillas, sin escribir valores secretos en documentación o en el chat:

| Variable | Uso al completar el trabajo |
|---|---|
| `NUMA_VOICE_MODEL` | Selección real del adaptador DAM |
| `NUMA_MODEL_REVISION` | Commit completo de pesos/código |
| `NUMA_MODEL_CACHE` / `HF_HOME` | Caché de artefactos del modelo |
| `NUMA_ML_ENABLED` | Flag explícito **a implementar**; default desactivado hasta configurar/probar |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Comprensión del journal |
| `DATABASE_URL` | Única persistencia PostgreSQL |
| `TEST_DATABASE_URL` | Integración en una base de prueba |
| `NUMA_SESSION_SECRET` y contraseñas demo | Acceso firmado y configuración segura del entorno conectado |
| `NUMA_ALLOWED_ORIGINS` | Orígenes autorizados del frontend |
| `VITE_API_BASE` | Origen público del backend; sin secretos |

`NUMA_ML_ENABLED` es una propuesta de implementación pendiente, no una variable que funcione en el código actual. Añadir también identificación de la versión del pipeline y la política mínima de habla, con valores documentados y probados.

Consultar `docs/RESOURCES.md` para ofertas y activación: Gemini, Aiven, Modal y Codex. Los importes y términos allí son del evento de noviembre de 2026; si se retoma más tarde, verificar vigencia antes de contar con ellos. Créditos de Codex y créditos de API son conceptos distintos. No crear cuentas, canjear enlaces personales ni asumir gastos sin la autoridad o acceso necesarios.

## 6. Pruebas y checklist de entrega

Comandos ya existentes, desde la raíz del proyecto:

```powershell
npm run build
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm run test:e2e
```

Añadir comandos ML independientes y documentarlos cuando existan. No ejecutar una ruta de ejemplo inexistente y registrar su fallo como un resultado del modelo.

- [x] Entorno DAM CPU/Windows y validación aislada Modal/Linux con revisiones fijadas.
- [x] Inferencia real ejecutada con voz sintética; pruebas con mocks identificadas por separado.
- [ ] VAD y duración hablada verificados.
- [ ] Calidad acústica y estado ML separados.
- [ ] Salidas crudas guardadas sin fingir probabilidades o escalas clínicas.
- [ ] Nota guardable cuando hay poco habla, error de modelo o fallo de Gemini.
- [ ] Texto y voz siguen siendo independientes; editar texto no altera la señal vocal.
- [ ] Registros antiguos conservan su tipo y versión.
- [ ] Informe de estabilidad técnica, latencia y errores.
- [ ] Gemini conectado y validado con casos positivos y negativos de mención explícita.
- [ ] PostgreSQL conectado y prueba de persistencia ejecutada.
- [x] DAM ejecutado aisladamente en Modal/Linux con pesos reales; no integrado todavía en el API público.
- [ ] Backend conectado completo desplegado y probado con pesos reales.
- [x] Frontend demo publicado con configuración y orígenes correctos; recorrido conectado completo pendiente.
- [ ] Privacidad y propiedad verificadas en API, no solo en pantalla.
- [ ] QA en móviles reales e impresión A4.
- [ ] Documentación y vídeo reflejan lo que realmente se ejecutó.

Actualizar `docs/IMPLEMENTATION_LOG.md` después de cada fase con comandos, resultados, versiones, entorno y pendientes. No marcar una fase terminada por haber escrito un adaptador o una configuración.

## 7. Trabajo posterior al MVP

No bloquea la entrega del prototipo:

- Entrenar una cabeza pequeña sobre representaciones preentrenadas, únicamente con datos etiquetados y derechos de uso adecuados.
- Recoger datos longitudinales con investigadores y evaluar el seguimiento tras tratamiento/TMS de forma específica. No asumir que un resultado de cribado demuestra detección de recaídas.
- Separar participantes entre entrenamiento, validación y test; evaluar diferencias por idioma, acento, dispositivo y otros factores relevantes.
- Recalibrar umbrales con referencias independientes, no con las predicciones del propio sistema. La valoración del usuario no debe ser un formulario obligatorio diario para usar el journal.
- Estudiar un recomendador aprendido cuando exista suficiente feedback; las reglas actuales son un baseline útil y no deben describirse como un modelo causal entrenado.
- Conexiones reales a Apple Health, Last.fm, calendarios y wearables, con permisos y minimización de datos.
- Cuentas de usuarios reales, flujo de vinculación con profesionales, revocación de sesiones y operación del servicio fuera de una demo.
- Cola durable, migraciones más estructuradas y concurrencia distribuida solo cuando el despliegue lo requiera.

Procesar una grabación no implica permiso para reutilizarla en entrenamiento. Mantener separados los consentimientos, minimizar datos y no publicar audios, texto privado o representaciones identificables. No usar muestras clínicas de terceros sin revisar acceso y condiciones.

## 8. Fuentes para revalidar antes de implementar

- [DAM: ficha, uso y limitaciones](https://huggingface.co/KintsugiHealth/dam).
- [DAM: pipeline de referencia](https://huggingface.co/KintsugiHealth/dam/blob/main/pipeline.py).
- [DAM: dependencias publicadas](https://huggingface.co/KintsugiHealth/dam/blob/main/requirements.txt).
- [Aclaración de autores sobre salidas sin calibrar](https://huggingface.co/KintsugiHealth/dam/discussions/2).
- [Silero VAD: código y licencia](https://github.com/snakers4/silero-vad).
- [Estudio sobre contaminación entre hablantes al evaluar](https://arxiv.org/abs/2604.14354).
- [DAIC-WOZ: solicitud y restricciones de acceso](https://dcapswoz.ict.usc.edu/).

## 9. Texto listo para iniciar otro chat con Codex

> Trabaja en `C:\JUNCTION\numa`. Lee `NUMA_NEXT_STEPS.md` y verifica el estado del repositorio antes de editar. Fase A y la validación aislada de DAM en Modal/Linux están completadas técnicamente; consulta `docs/ML_DAM.md` y `docs/ML_DAM_MODAL.md`. La demo pública con acceso por nombre se conserva como punto de retorno; DAM aún no está conectado al journal. El siguiente bloque es B (VAD/calidad), luego C/D (contrato e historial), E/cierre de F (Gemini/Aiven y backend completo) y G (recorrido conectado). Conserva el frontend, las sesiones demo y las decisiones de privacidad/crecimiento. Usa el entorno Linux verificado, CPU y cero contenedores mínimos salvo una decisión explícita posterior. No confundas pruebas TTS con evaluación clínica ni amplíes esta fase a integraciones no solicitadas. No imprimas secretos o contenido privado y registra pruebas reales y pendientes en `docs/IMPLEMENTATION_LOG.md`.
