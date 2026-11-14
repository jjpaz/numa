# DAM: ejecución independiente (fase A)

Esta ruta comprueba la ejecución técnica de DAM, sin FastAPI, Gemini, Aiven ni credenciales. No modifica la `.venv` de la demo, el frontend o el adaptador SpeechBrain de la aplicación. La integración en el journal corresponde a las fases B/C de `NUMA_NEXT_STEPS.md`.

**Estado de despliegue:** la validación aislada en Modal/Linux/CPU ya se ejecutó con pesos reales y está documentada en **[ML_DAM_MODAL.md](ML_DAM_MODAL.md)**. El siguiente bloque es VAD/calidad, fase B. El adaptador recibe rutas y dispositivo como parámetros; el lock CPU/Windows y el generador TTS son herramientas opcionales de desarrollo, no requisitos del servidor. La aplicación pública sigue sin integrar DAM y el cierre de fase F continúa pendiente. Las futuras ampliaciones deben conservar esta ruta de hosting y funcionar sin el ordenador del desarrollador.

## Recursos fijados y auditoría

- DAM: `KintsugiHealth/dam`, revisión `df83a1e00101d9c06a5042b96b921eb94d5a2528`.
- Whisper: `openai/whisper-small.en`, revisión `e8727524f962ee844a7319d92be39ac1bd25655a`.
- Pipeline Numa: `numa-dam-standalone-v1`.
- `backend/ml/dam_manifest.json` registra SHA-256 de los cuatro módulos ejecutados, la ficha original, las dependencias de referencia y el checkpoint. Antes de cargarlos se comprueban todos los hashes; un cambio exige nueva auditoría y una nueva versión del pipeline.
- El checkpoint DAM ocupa **736.180.146 bytes** y el archivo safetensors de Whisper aproximadamente **967 MB**. Se descargan solo esos pesos, los módulos de referencia y los recursos necesarios; no los duplicados TensorFlow/Flax/PyTorch de Whisper. Reservar varios GB adicionales para Python, paquetes y caché.
- La auditoría de los módulos fijados identificó imports genéricos, carga del checkpoint, descarga del backbone y normalización; no identificó envíos de audio ni escritura de resultados. No se utiliza `trust_remote_code` genérico.

La caché conserva intactos los archivos upstream. En memoria, el loader convierte los imports `config/model/featex` en relativos bajo un namespace propio, sustituye la ruta del extractor por el snapshot Whisper fijado y fuerza `torch.load(weights_only=True)`. La configuración de ambos backbones recibe ese mismo snapshot local. No modifica el cálculo numérico del modelo, los tamaños de ventana ni la normalización. El modelo se reutiliza, queda en `eval()` y la inferencia usa `torch.inference_mode()` y `quantize=False`.

Las salidas `depression` y `anxiety` son valores crudos en escalas arbitrarias. No son porcentajes, probabilidades, diagnósticos ni puntuaciones PHQ/GAD. No se aplican los umbrales de clasificación upstream. [Ficha y limitaciones de DAM](https://huggingface.co/KintsugiHealth/dam/blob/df83a1e00101d9c06a5042b96b921eb94d5a2528/README.md).

## Entorno aislado: Windows y CPU

Python de referencia: **3.11.14 de 64 bits**. Usar una instalación de Python 3.11 para crear `.venv-ml`; no cambiar la `.venv` existente.

```powershell
# Desde C:\JUNCTION\numa, si Python 3.11 está registrado:
py -3.11 -m venv .venv-ml
.\.venv-ml\Scripts\python.exe -m pip install --index-url https://download.pytorch.org/whl/cpu torch==2.7.0+cpu torchaudio==2.7.0+cpu
.\.venv-ml\Scripts\python.exe -m pip install -r backend/ml/requirements-cpu-win.lock.txt
.\.venv-ml\Scripts\python.exe -m pip check
```

El par PyTorch/torchaudio se instala primero desde el índice oficial de CPU; PyPI no publica esas ruedas con sufijo `+cpu`. El archivo `requirements.txt` fija las dependencias directas; `requirements-cpu-win.lock.txt` fija también las transitivas del entorno verificado. Instalar el lock después del par CPU permite reproducir las versiones exactas. No es un lock verificado de CUDA/Linux: Modal se resolverá en la fase F.

En esta máquina no había Python 3.11 registrado. uv 0.9.11 descargó el intérprete pero falló al renombrar su carpeta. La preparación local utiliza el mismo archivo oficial, extraído directamente, sin instalar Python globalmente:

- [Distribución de Astral CPython 3.11.14, build 20251120](https://github.com/astral-sh/python-build-standalone/releases/download/20251120/cpython-3.11.14%2B20251120-x86_64-pc-windows-msvc-install_only_stripped.tar.gz).
- SHA-256 del archivo: `8460ac70e97e4507aacda8aea56b1a7ec106aa1cb7ea3ac7dc5d198dec51e2f6`.
- Intérprete local: `.local/python311-standalone/python/python.exe`; creó `.venv-ml` con `-m venv`. Ambas carpetas están ignoradas por Git. No hay que repetir esta descarga si `.venv-ml/Scripts/python.exe` ya funciona.

## Ejecutar

```powershell
# Primera vez: descarga aproximadamente 1,7 GB de pesos más recursos pequeños.
.\.venv-ml\Scripts\python.exe -m backend.ml.check --download-only

# Fixture generado localmente con una voz inglesa instalada en Windows:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/make-ml-fixture.ps1

# No imprime puntuaciones. --report es opcional y nunca sobrescribe un archivo.
.\.venv-ml\Scripts\python.exe -m backend.ml.check --audio .local/ml-fixtures/synthetic-en.wav --report .local/ml-results/dam-first.json
```

`--download-only` devuelve `downloaded_not_inferred`, nunca una afirmación de inferencia. El informe normal indica estado, revisiones, duración del archivo, tiempo de carga/inferencia y versiones instaladas. Los fallos devuelven código de salida 1, sin imprimir excepciones que puedan contener rutas privadas. `--cache` permite otra caché; por defecto usa `model-cache/`.

Las puntuaciones solo se escriben cuando se solicita un informe nuevo dentro de `.local/` o `model-cache/`. No se aceptan informes en el árbol de código o documentación. No se guardan transcripciones ni audio por el adaptador; la CLI lee un archivo local elegido explícitamente. Los snapshots de modelos, entorno, audios e informes no se publican en GitHub.

## Alcance del audio y pruebas

En esta fase la CLI exige WAV PCM16, mono, 16 kHz, de 30–120 segundos y hasta 10 MB. Rechaza silencio/energía muy baja, clipping intenso, datos truncados y formatos incompatibles antes de cargar el modelo. Conserva el preprocesamiento de referencia del archivo aceptado.

**Duración del archivo no significa habla efectiva.** `speech_duration_sec` permanece `null` y `vad_verified=false`. Todavía no se detectan música, múltiples hablantes o idioma. Solo usar fixtures controlados de una voz inglesa. La fase B añadirá VAD y el umbral de habla efectiva antes de conectar DAM al journal.

El script Windows crea voz sintética inglesa, con un texto ficticio explícitamente técnico. Sirve para probar carga e inferencia, no para evaluar depresión ni generalización a pacientes. No contiene datos personales y no sobrescribe fixtures existentes.

```powershell
# Pruebas del contrato, sin descargar ni ejecutar el modelo:
.\.venv\Scripts\python.exe -m pytest backend/ml/tests -q

# Prueba separada con pesos reales, dos inferencias del mismo archivo:
$env:NUMA_RUN_DAM_REAL_TEST = '1'
$env:NUMA_DAM_TEST_AUDIO = (Resolve-Path .local/ml-fixtures/synthetic-en.wav).Path
.\.venv-ml\Scripts\python.exe -m pytest backend/ml/tests/test_dam_real.py -q
Remove-Item Env:NUMA_RUN_DAM_REAL_TEST,Env:NUMA_DAM_TEST_AUDIO
```

Las pruebas del contrato cubren independencia del servidor, ausencia de puntuaciones y rutas privadas en stdout, integridad de artefactos, aislamiento de imports, carga compartida, rechazo de audio y fallos. La prueba real está desactivada por defecto; comprueba valores finitos, parámetros congelados, `eval()` y repetibilidad CPU con tolerancia absoluta `1e-6`. Los resultados ejecutados se registran en `docs/IMPLEMENTATION_LOG.md`.

Si Windows deniega acceso a su temporal compartido, usar `--basetemp .local/pytest-ml-contract` (o `pytest-ml-real` para la prueba real). Son subcarpetas desechables exclusivas de pytest, que puede borrar al repetir; nunca usar `.local/` completo porque contiene copias privadas. En este entorno la suite de TestClient requirió ejecución fuera del sandbox; eso no cambia las pruebas ni autoriza acceso a datos de la vista previa.

## Atribución y licencias

DAM fue publicado por **Kintsugi Health**, con contribuciones iguales de Oleksii Abramenko, Noah Stein y Colin Vaz según su ficha. La ficha fijada declara **Apache-2.0**; se conserva íntegra en la caché junto al código. [Código de referencia fijado](https://huggingface.co/KintsugiHealth/dam/tree/df83a1e00101d9c06a5042b96b921eb94d5a2528), [licencia Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).

El backbone es **OpenAI Whisper**, convertido para Transformers por sus mantenedores. Su [ficha fijada](https://huggingface.co/openai/whisper-small.en/blob/e8727524f962ee844a7319d92be39ac1bd25655a/README.md) también se conserva en la caché; consultar sus condiciones y las del [proyecto Whisper](https://github.com/openai/whisper). La licencia MIT de Numa cubre su código propio, no sustituye las licencias de pesos, módulos ni paquetes de terceros. El corpus clínico de entrenamiento no se descarga ni se utiliza para entrenar.
