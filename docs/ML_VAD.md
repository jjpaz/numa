# VAD y calidad: fase B aislada

Fecha: 14 de noviembre de 2026. Base: `3388445`; rama `ml/vad-quality`.
Esta ruta añade un filtro anterior a DAM sin cambiar el backend público, el
frontend, el diario ni sus sesiones. No conecta Gemini o PostgreSQL.

## Implementación y política

`backend/ml/audio_quality.py` ofrece `evaluate` (mediciones) y `gated_infer`
(inferencia opcional después del filtro). No importa la API o el repositorio.

- **Silero VAD 6.2.3**, revisión `5cd7945676eb32225748052e2e6a0580e4686a08`,
  licencia MIT. Se fija la rueda oficial por SHA-256 en `requirements-vad.txt`.
  `vad_manifest.json` fija hashes de los módulos usados y del modelo TorchScript
  empaquetado. Se verifican antes de importar/cargar; no se descarga código por
  `torch.hub`. No se usan extras ONNX, otro proveedor o nuevas credenciales.
- Se reutiliza una instancia CPU, en evaluación y sin gradientes. Un lock protege
  el estado recurrente; la función upstream lo reinicia para cada archivo. Se
  conserva el número de hilos del llamador tras importar el paquete.
- Política **`numa-audio-gate-v1`**, configurable con `QualityPolicy`; los valores
  completos se incluyen en cada resultado. Mínimo inicial **30 segundos de habla
  estimada**, umbral VAD 0,5, salida de habla 0,35, segmento mínimo 250 ms, silencio
  mínimo 100 ms y padding **0 ms**. La suma usa coordenadas enteras de muestras,
  sin redondear antes de compararla con el umbral.
- Los 30 segundos son una decisión conservadora del prototipo apoyada en la
  recomendación de entrada de los autores de DAM; no un umbral clínico validado.
  Los segmentos son estimaciones: pueden incluir pausas menores de 100 ms y errores
  del detector. `speech_duration_sec` no es una medición manual de fonación.
- Entrada máxima **10 MiB / 120 segundos**. WAV PCM16 mono/16 kHz se comprueba
  directamente. FFmpeg normaliza WAV de otra frecuencia/canales, WebM/Opus y
  MP4/AAC a mono/16 kHz. Subproceso sin shell, sin protocolos de red, formatos
  permitidos explícitos, timeout 30 s y salida acotada. Se lee una muestra adicional
  para rechazar archivos que exceden dos minutos, en lugar de aceptarlos recortados.
- Se conserva la política acústica existente: RMS inferior a 0,005 o más del 10 %
  de muestras con amplitud absoluta >=0,98 causan rechazo. Energía, proporción de
  pausas por energía y clipping se miden sobre **todo** el audio normalizado.
  Son heurísticas técnicas, no estimaciones de SNR o validez clínica.
- DAM recibe el WAV normalizado completo, incluidos los silencios. No se
  concatenan segmentos ni se sustituyen sus ventanas/preprocesamiento de referencia.
  El archivo temporal se elimina y no se escribe audio en el volumen de modelos.

| Estado | Significado |
|---|---|
| `quality_rejected` | Vacío, formato/decodificación inválidos, exceso de tamaño/duración, silencio/nivel bajo o clipping |
| `insufficient_speech` | VAD ejecutado, pero no alcanza el mínimo configurado |
| `scope_unverified` | Habla suficiente, sin confirmación externa de una sola voz inglesa |
| `eligible` | Supera el filtro; todavía no afirma haber ejecutado DAM |
| `completed` | DAM se ejecutó realmente y devolvió valores finitos |
| `failed` | Fallo técnico; código de tipo saneado, sin contenido privado |

`quality` y `ml_status` están separados: una grabación puede tener energía adecuada
y habla insuficiente. No se crean puntuaciones cero para representar un rechazo.
El filtro no guarda ni modifica entradas; la posibilidad de guardar el diario
sigue gobernada por el backend actual, cuyas pruebas se ejecutan por separado.

## Alcance y límites

Silero no identifica idioma ni número de hablantes. `language_verified` y
`speaker_count_verified` permanecen `false`; `snr_db` permanece `null`.
`confirmed_scope=True` es una declaración del llamador para una muestra controlada
de una voz inglesa, **no** una inferencia de Silero. Por defecto es `false` y bloquea
DAM aunque haya habla suficiente. En una futura integración no debe activarse
silenciosamente para cualquier grabación.

La batería caracteriza ruido blanco, melodía sintetizada, voz con ruido y dos
voces sintéticas inglesas. No constituye una evaluación de música real, acentos,
diarización, habla superpuesta, dispositivos o grabaciones clínicas. Que una muestra
pase el filtro no implica que sea adecuada para uso clínico.

Los anteriores `backend.ml.check` y `backend.ml.modal_check` conservan el experimento
de referencia de fase A, **sin VAD**. Para evaluar este nuevo filtro se utiliza
`backend.ml.modal_vad_check`; la integración de la aplicación corresponde a fase C.

## Reproducción en Modal/Linux

Prerrequisito: los pesos DAM/Whisper de la prueba anterior existen en el volumen
`numa-dam-validation-weights`; ver [ML_DAM_MODAL.md](ML_DAM_MODAL.md).
La nueva imagen deriva del mismo Python 3.11.18 y lock CPU, instala el paquete
Silero fijado y FFmpeg. eSpeak NG se usa **solo para generar la segunda voz de la
batería**, no por el filtro. Se registran las versiones reales de estos binarios;
los paquetes Debian no constituyen un snapshot inmutable del sistema operativo.

```powershell
$env:MODAL_PROFILE = 'rebollmartin'
$env:PYTHONIOENCODING = 'utf-8'
.\.venv\Scripts\python.exe -m modal run -m backend.ml.modal_vad_check --audio .local/ml-fixtures/synthetic-en.wav --report .local/ml-results/vad-modal-NEW.json
```

Usar un informe nuevo. El comando exige el SHA-256 del fixture sintético original
antes de subirlo; no procesa grabaciones privadas accidentalmente. Los demás casos
se generan temporalmente en Linux a partir de esa señal y de fórmulas/texto ficticio
propios. El informe registra sus hashes y medidas, sin almacenar audio.

App independiente **`numa-vad-validation`**, workspace **`rebollmartin`**, Modal
**1.6.4**. CPU 4 / RAM 8192 MiB / timeout 300 s / reintentos 0 / máximo 1 / mínimos
y reserva 0 / ventana de apagado 30 s. Sin GPU, secretos, HTTP público o calendario.
La función tiene red saliente bloqueada y los dos flags de Hugging Face offline.
El volumen conserva solo los pesos anteriores; Silero queda en la imagen.

Solo el caso principal solicita una inferencia DAM real. Los demás comprueban el
filtro; pruebas con un sustituto de DAM verifican que un rechazo nunca lo invoca.
Las puntuaciones crudas van únicamente al informe ignorado en `.local/`.
La salida de terminal usa una lista explícita de campos permitidos.

## Capturas de navegador y dispositivos

Los casos WebM/Opus y MP4/AAC codificados con FFmpeg comprueban formatos, **no**
constituyen grabaciones reales de Chrome o Safari. No se verificó micrófono físico.
La primera ejecución del generador Chromium fue rechazada. Tras la nueva
autorización para continuar, se ejecutó correctamente; el resultado está abajo.

`scripts/make-vad-browser-fixture.cjs` está **ejecutado/verificado en Edge 157**:
pasa el fixture controlado por WebAudio y MediaRecorder en Edge/Chromium,
sin micrófono ni conexión a la demo. Guarda un WebM nuevo en
`.local/ml-fixtures/` y rechaza sobrescrituras.
El comando Modal admite después
`--browser-audio .local/ml-fixtures/chromium-synthetic.webm`.
El usuario confirmó que en iPhone/Safari funcionan el micrófono, la grabación,
reproducción y llegada a revisión en la demo. Es una comprobación comunicada por
el usuario, no observada por el agente. Sigue pendiente VAD/DAM sobre un archivo
real de Safari: la demo aún usa la ruta anterior. Conservar ese pendiente durante
la integración; la aceptación completa de fase B sigue abierta.

### Resultado adicional de Chromium — 14 de noviembre de 2026

- `node scripts/make-vad-browser-fixture.cjs`: **PASS**, Edge **157.0.4341.57**,
  MediaRecorder real WebM/Opus, **842.832 bytes**. Micrófono no usado.
- SHA-256 del WebM:
  `ad21026d44785ab1d49c1095410540d901ba0f1e19c02a8d18fae69a9cfaa646`.
- [Ejecución Modal con el caso de navegador](https://modal.com/apps/rebollmartin/main/ap-Xscv7fKItnmWQRi9TTzbKK):
  **19/19 casos correctos**, salida 0, **43,170 s** de batería. Se reutilizó la
  imagen existente; fuente de la aplicación sin cambios.
- Archivo Chromium: **57,060 s**, habla estimada **40,704 s**, clipping 0,
  `eligible`, **1,055 s** de decodificación/filtro. No se solicitó DAM para ese
  caso. El caso TTS de referencia sí completó DAM realmente, igual que antes.
- Informe ignorado: `.local/ml-results/vad-browser-modal-20261114-01.json`.
  Intervalos repetibles, CUDA false, sin importaciones de API. Consulta final:
  ambas ejecuciones `numa-vad-validation` **stopped / 0 tareas**.

## Resultados ejecutados

[Ejecución Modal del 14 de noviembre](https://modal.com/apps/rebollmartin/main/ap-dhJv8bSdLgnTACqgQrMAxI):
**18/18 casos correctos**, salida 0. Imagen final `im-1EccIn8NCKtu2K6lax4GCm`.
Python 3.11.18, torch/torchaudio 2.7.0+cpu, Silero 6.2.3, FFmpeg
7.1.5-0+deb13u1, eSpeak NG 1.52.0; `pip check` correcto. Se verificó después el
estado **stopped / 0 tareas**. CUDA no disponible y API no importada.

| Caso | Habla estimada | Resultado observado |
|---|---:|---|
| TTS principal, archivo de 57,095 s | 40,704 s | DAM completado realmente |
| Próximo al umbral por debajo | 29,504 s | `insufficient_speech` |
| Próximo al umbral por encima | 30,496 s | `eligible`, sin solicitar DAM |
| Archivo de 60 s con poca voz | 5,056 s | `insufficient_speech` |
| Silencio / voz muy baja / clipping | No se ejecuta VAD | `quality_rejected` |
| Ruido blanco / melodía sintetizada | 0 s / 0 s | `insufficient_speech` |
| Voz con ruido añadido | 39,936 s | `scope_unverified` |
| Dos voces inglesas sintéticas consecutivas | 48,416 s | `scope_unverified` |
| WebM/Opus / MP4/AAC, estéreo 48 kHz de FFmpeg | 40,736 s / 40,736 s | Normalizados y `eligible` |
| Contenedor inválido / WAV truncado | No se ejecuta VAD | `decode_failed` |
| WAV >120 s / WebM >120 s / carga >10 MiB | No se ejecuta VAD | Rechazo por límite |

En los casos con ruido y dos voces, el bloqueo corresponde a la falta de
confirmación externa del alcance; **no** significa que el detector reconociera
ruido problemático o varios hablantes. Esa limitación queda expuesta.

Intervalos del archivo principal idénticos al repetirlo después de los demás casos.
La batería duró **44,366 s**, excluidos build y arranque; el caso con carga/DAM,
27,267 s. Los casos VAD posteriores duraron aproximadamente 0,83–1,37 s, incluida
decodificación cuando correspondía. No se midió la latencia aislada de DAM ni se
hizo un benchmark de concurrencia o coste.

Informe privado: `.local/ml-results/vad-modal-20261114-01.json`; exactamente una
llamada DAM y puntuaciones únicamente en ese caso. No se publican aquí.

Pruebas finales ejecutadas:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests backend/ml/tests -q --basetemp=.local/pytest-vad-final -o faulthandler_timeout=30
.\.venv-ml\Scripts\python.exe -m pip check
node --check scripts/make-vad-browser-fixture.cjs
```

**81 aprobadas, 2 omitidas** (PostgreSQL dedicado y prueba local DAM opt-in), tres
avisos existentes. Incluyen 27 contratos nuevos: borde de 30 s a precisión de una
muestra, rechazo antes del modelo, intervalos inválidos, fallo sin valores falsos,
conservación íntegra del WAV, limpieza temporal y resumen sin puntuaciones.
Esos contratos usan timestamps/salidas simuladas; la batería remota usa modelos
reales. La captura Chromium se ejecutó posteriormente, como consta arriba; no se
repitió pytest en ese seguimiento porque no cambió el código.

La suite de API se bloqueó dentro del sandbox en el socket local de TestClient;
se interrumpió y pasó fuera del sandbox con autorización. No se cambió la lógica
de la aplicación para resolverlo.

## Fuentes

- [Código/licencia Silero fijados](https://github.com/snakers4/silero-vad/tree/5cd7945676eb32225748052e2e6a0580e4686a08).
- [Paquete oficial 6.2.3](https://pypi.org/project/silero-vad/6.2.3/).
- [Requisitos de entrada y límites de DAM](https://huggingface.co/KintsugiHealth/dam/blob/df83a1e00101d9c06a5042b96b921eb94d5a2528/README.md).
