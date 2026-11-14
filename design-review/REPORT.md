# Portal del paciente: «The journal that grows with you»

Informe final del trabajo en la rama `feat/patient-mailbox-garden`. Un commit
por paso (más el de este paso 7), sin push ni merges. Solo se ha tocado el
portal del paciente (`/patient/*`); la portada, el login, el portal del
psicólogo, `backend/`, la API, `vercel.json` y `.env*` no han cambiado.

| Paso | Commit    | Qué                                                              |
| ---- | --------- | ---------------------------------------------------------------- |
| 1    | `cb578e8` | Tokens, hierba y prado, cabecera, pie, navegación con transición |
| 2    | `fcf861c` | Home: el buzón                                                   |
| 3    | `ab53994` | Página de la entrada en la paleta nueva                          |
| 4    | `1e4ba0b` | My journal                                                       |
| 5    | `eb66080` | My garden sobre el suelo verde                                   |
| 6    | `9e79aa3` | Fuera «Today, something simple»                                  |
| 7    | (último)  | Transiciones, pulido, DESIGN.md, tests, este informe             |

## Qué hice en cada paso

**1. Cimientos.**
- Añadí los tokens Everforest a `src/design/tokens.css`: cream, oat, forest, forest-soft, line, peach, grass-1/2/3, ground, on-ground, butter y danger.
- Los tokens del login y la clínica siguen intactos.
- `src/design/Grass.tsx` dibuja la hierba:
  - briznas rellenas en tres capas;
  - alturas, anchos e inclinaciones deterministas por índice de brizna, con «matas» lentas para que sea silvestre;
  - un suelo cuyo borde son briznas oscuras.
- `src/design/Meadow.tsx` dibuja:
  - el prado, con una planta por entrada guardada a partir de `plantsFrom()`, metida entre las capas de hierba;
  - `PlantFigure`, la planta de una entrada sobre una matita.
- La cabecera muestra siempre Home, My journal y My garden (`aria-current`). La hoja abre un panel solo con «Sign out».
- El pie es una frase de 14 px.
- `src/design/flow.ts` aporta `useFlowNavigate()` y `<FlowLink>`.
- Saqué el contexto de auth y `useResource` a `src/auth.tsx` sin cambiar su lógica. Les añadí una caché por sesión para que las páginas pinten al instante, también dentro de una transición.

**2. Home, el buzón.**
- La home muestra «Welcome, {nombre}.» y la frase diaria de `src/dailyLine.ts`.
- **Buzón:**
  - superficie oat de radio 32 y 640 px;
  - micrófono forest de 88 px;
  - «I'd rather write today», que despliega «Your note» y «Keep these words».
- **Grabación:** la línea de voz en vivo se dibuja con la amplitud real del micrófono y el tiempo va en cifras tabulares.
  - La lógica del `Recorder` pasó a un hook compartido, `useVoiceCapture`, con el mismo límite de 2 minutos y la misma limpieza.
- **Consentimiento:**
  - el texto se conserva palabra por palabra y es obligatorio;
  - se recuerda en `localStorage` con try/catch y después queda solo «How audio is handled»;
  - si se pulsa enviar sin marcarlo aparece «Tick the box to continue.».
- **Ventana de revisión:**
  - se abre en el propio buzón (`role="dialog"` no modal, con el foco en el título);
  - estados: «Listening to your day…» y luego «Here's what I heard»;
  - acciones: Plant this entry (`PATCH` existente), Record again (`DELETE` existente) y Open the full entry.
- **Estado tranquilo:** tras plantar, la planta nueva crece una vez en la franja de hierba.
- **Al volver:** la home decide el estado con `todayState` tal cual.
- **La muestra** es de solo lectura.
- `/patient/new` redirige a `/patient`.

**3. Entrada.**
- Moví el contenido y las funciones a `src/patient/Entry.tsx` sin cambios de lógica.
- Las palabras van sobre una hoja oat (la superficie del buzón).
- El paso siguiente va en una banda `--n-ground` con texto crema.
- La cabecera muestra la planta nueva, que florece al marcar «Helpful».
- Los enlaces son «Home» y «My journal».
- Eliminé `entry.css` y `new-entry.css`.

**4. My journal.**
- h1 «My journal» y la frase pedida.
- Las mismas filas, ahora con la planta nueva de 56 px.
- Fuera el jardín de 7 días.
- Estado vacío con «Add an entry».
- La franja de hierba al pie.
- Eliminé `journal.css`.

**5. My garden.**
- **Cielo:** h1, «The journal that grows with you.», la frase con datos reales y los tres enlaces ancla.
- **Prado:** a todo el ancho.
- **Suelo verde:** desde el horizonte hasta el final de la página, con tres secciones:
  - What helps, siempre visible, con filas, cifras y una barra de 6 px;
  - Connections, con el contenido de la página antigua;
  - Your space, con los módulos como filas con interruptor y sus controles desplegados debajo.
- Las rutas antiguas redirigen a las anclas.
- Eliminé `garden.tsx` y `garden.css`. El motivo del login pasó, sin cambios, a `src/loginMotif.tsx`.
- `secondary.css` queda solo con el login y el 404.

**6. Fuera el modo sencillo.**
- Quité `SimpleModeControl`, sus textos y estilos, y toda rama que dependía de `simple_mode`.
- Ese campo ya no está en `GrowthPatch`, así que nunca se envía. El backend no se toca.

**7. Transiciones y pulido.**
- **Nombres de transición:**
  - `ground`: la hierba sube hasta su horizonte al ir a My garden y baja al salir. Cada imagen va anclada arriba y el grupo la revela, así que no se deforma.
  - `mailbox`: el buzón se convierte en la hoja de la entrada.
  - `plant-<id>`: la planta pasa de la fila a la cabecera.
  - `patient-header`: la cabecera queda quieta.
- **Duraciones:** 520 ms para los elementos compartidos y fundido de 220 ms con 8 px para el resto.
- **Limpieza:** quité las reglas antiguas de `styles.css`/`theme.css` que solo usaba el portal del paciente, más dos tokens de texto que no usaba nadie.
- `DESIGN.md` está reescrito.

## Decisiones propias

- **Dos identidades de color.** Los tokens nuevos conviven con los del login y la clínica, que se siguen usando y no podían cambiar.
  - `--n-radius-field` se queda en 12 px porque lo usa la clínica; los campos del paciente usan un token nuevo, `--n-radius-input`, de 14 px.
- **Texto secundario sobre el verde:** crema al 92 % (4,7:1). Al 80 % quedaba en 4,0:1, por debajo de AA, y no hizo falta oscurecer `--n-ground`.
- **Errores sobre el verde:** van en crema con un icono butter, porque el rojo `--n-danger` no se lee sobre `--n-ground`. Para el portal del paciente creé el componente `Problem` (icono y texto). El `ErrorNotice` de la clínica no se toca.
- **«Record again» con una nota escrita:** borra el borrador y vuelve al buzón en modo escritura con las palabras conservadas, para no perderlas. Con voz vuelve al micrófono.
- **La muestra en Home:** además de la frase de solo lectura, conserva «Today's entry is planted.» y «See today's entry» si hay entrada de hoy, para poder explorarla.
- **El paso siguiente de la entrada:** usa la banda `--n-ground` en lugar del antiguo musgo, para hilarlo con el suelo de My garden.
- **Your space:**
  - el gráfico de voz va sobre un panel oat, porque sus colores de clínica no se leen sobre verde;
  - las preferencias de actividades («Make this space yours») van bajo «What seems to help»;
  - la intención y «I made room for this», bajo «One small intention»;
  - los experimentos conservan su bloque y sus textos tal cual;
  - la invitación de crecimiento vive aquí y desplaza la página hasta el módulo que activa.
- **What helps:** muestra nombre, «helpful N of M times» y la barra, sin la frase larga de cada patrón, por minimalismo.
- **La franja de hierba es sticky:**
  - en My journal se queda abajo de la pantalla mientras la lista se desplaza («se queda en su sitio» entre Home y My journal);
  - es decorativa (`pointer-events: none`) y la página reserva 96 px de `scroll-padding`.
- **Plantas:**
  - en la franja nunca superan su altura;
  - en el prado siempre asoman sobre la hierba;
  - un paciente sin entradas ve solo hierba, con un prado más bajo (140 px).
- **El buzón crece con una animación de layout de `motion`,** que ya era dependencia del proyecto, y se desactiva con reduced motion.
- **La página de la entrada pinta al instante** con los datos que ya tiene el journal, para que la planta y la hoja existan al hacer la transición.
- **Accesibilidad extra:** un «Skip to content» que solo aparece con el foco.
- **`.gitignore`:** ignoro `design-review/*` salvo este `REPORT.md`, para que el informe quede en el repositorio y las capturas no.

## Tests: qué cambió y por qué

- **`tests/today.spec.ts`:** las pruebas unitarias de `today.ts` están intactas. Las de navegador describen ahora el buzón:
  - **pending:** el micrófono es la única acción, se alcanza con el teclado, tiene anillo visible y pide el consentimiento.
  - **día anterior:** no cuenta como hoy.
  - **borrador de hoy:** reabre su ventana de revisión, con mock.
  - **escribir desde Home:** revisión, plantar, el estado tranquilo, la frase «con entrada», «See today's entry» por teclado, y que `/patient/new` redirige.
  - **nuevo:** «Record again» descarta el borrador; lo comprueba contra la API.
  - **la cabecera:** los tres lugares y la hoja, que solo cierra sesión y se cierra con Escape. Sustituye al test del menú antiguo.
  - **la página de la entrada:** se llega por «Open the full entry» desde la revisión.
- **`tests/journal.spec.ts`:**
  - El flujo privado con el psicólogo pasa ahora por el buzón y comprueba además que la planta florece.
  - La muestra y la vista pequeña se prueban por los tres lugares, y la home sin scroll a 375×812.
  - **El micrófono, flujo nuevo:** grabar, revisión, plantar, la entrada en My journal (Today) y editar «In short». Las aserciones de medidas de voz quedan al final.
  - **«space grows only by choice / simple view»** pasa a ser «My garden muestra sus tres secciones sin módulos y ninguna lista de entradas»:
    - comprueba el fondo cream y el verde del suelo;
    - comprueba que los módulos persisten tras recargar.
  - Intención y experimentos, ahora dentro de My garden.
  - **Nuevos:** las rutas antiguas redirigen; no existe «Today, something simple» en ninguna página.
- **`tests/switch-account.spec.ts`:** los textos «Welcome, …» y «My journal».
- **Nuevo, `tests/dailyLine.spec.ts`:** la misma frase todo el día, distinta al día siguiente (comprobado un año entero), la lista correcta y todas las frases a lo largo del ciclo.
- Los tests del backend no se han tocado.

## Verificación

- `npm run build`: sin errores ni avisos.
- **`npm run test:e2e`: 30 de 31.** El que falla es solo su última aserción, la de las medidas de voz (`.ep-source` «ML not active» y `.voice-facts`). Requiere `ffmpeg` en la máquina del API; aquí no está y el backend responde «Voice analysis unavailable». Ya fallaba así antes de este trabajo. Todo lo nuevo de ese test pasa: grabar, revisar, plantar, verlo en My journal y editar.
- **Capturas** (`design-review/`, 1440×900 y 375×812):
  - Home: vacía, grabando, revisión procesando, revisión lista, plantada, muestra y error de micrófono.
  - La entrada.
  - My journal: muestra (arriba y al final) y vacío.
  - My garden: muestra arriba, a mitad y al final, y paciente nuevo.
  - `transition-*`: las transiciones congeladas a mitad de camino.
- **Rondas de revisión** (los ficheros `r2-*` y `r3-*`, más `r*-checks.txt`):
  - **Ronda 1** (ya sustituida). Corregí:
    - la línea de voz que se salía del buzón durante la expansión (ahora mide el ancho de layout);
    - el prado vacío con un gran hueco crema;
    - plantas de la franja que tapaban el pie en móvil;
    - unos 41 px de scroll en Home con el error de micrófono a 375.
  - **Ronda 2.** Corregí:
    - 2 px de scroll a 1440 en el mismo estado;
    - la sombra de foco global que dibujaba una caja alrededor de la transcripción.
  - **Ronda 3, limpia:**
    - un h1 por página;
    - 0 px de overflow a 1440, 375 y 360;
    - Home sin scroll en todos los estados a ambos tamaños;
    - peach solo en `pt-primary`/`ep-primary` y en las flores;
    - foco visible en todo el recorrido con teclado;
    - consola sin errores.
- **Contraste (WCAG):**
  - forest sobre cream, 10,4:1; sobre oat, 9,5:1;
  - forest-soft, 5,8:1 y 5,3:1;
  - botón peach, 5,5:1;
  - crema sobre ground, 5,2:1; crema al 92 % sobre ground, 4,7:1;
  - danger sobre cream, 6,0:1.
- **Reduced motion:** no hay View Transitions, las anclas saltan al instante, ni crecimiento ni apertura animados.
- **Sin soporte de View Transitions** (API eliminada a propósito): la navegación es normal y sin errores.
- **El login, la portada, la clínica y el 404 se ven igual que antes:** los comparé con capturas anteriores.

## Lo que quedó imperfecto

- La prueba de medidas de voz necesita `ffmpeg`; sin Gemini, la transcripción local llega vacía y se ve el texto de ayuda («Transcription unavailable?…»), como estaba previsto.
- **Home sin scroll:** está comprobado a 1440×900, 375×812 y 360×740. En móviles más bajos (por ejemplo 375×667) la ventana de revisión con un texto largo puede pedir algo de scroll.
- **La franja sticky de My journal** pasa por encima del final de las filas mientras se desplaza. Es intencionado (es decoración y no bloquea clics), pero en pantallas muy bajas resta espacio.
- **Prado con muchas entradas:** con cientos, las plantas se apiñan, porque sus posiciones vienen de `plantsFrom()`, que no se ha cambiado.
- **La transición `ground` hacia My garden** captura un elemento muy alto (toda la página verde). Chrome/Edge la resuelven bien; en navegadores sin View Transitions la navegación es instantánea.
- **Restos en código de otras zonas:**
  - un comentario de `src/clinicCharts.tsx` todavía menciona el `VoiceChart` antiguo del paciente; no toqué el portal del psicólogo;
  - el motivo del login conserva su propia copia de las hojas y la flor antiguas.

## Cómo probarlo en 5173/8000

1. Reinicia el backend de 8000 como sueles hacerlo, para que Alex vuelva a estar vacío.
2. Arranca el frontend con `npm run dev` (puerto 5173).
3. Entra en `/login/patient`, con Alex:
   - la home muestra el buzón;
   - marca la casilla, graba con tu voz real (hasta 2 minutos) y para;
   - el buzón se abre con «Listening to your day…» y luego «Here's what I heard»;
   - corrige si hace falta y pulsa «Plant this entry»: la planta nueva crece en la hierba de abajo;
   - también puedes probar «I'd rather write today», «Record again» y «Open the full entry».
4. Ve a My journal y abre una entrada: la planta pasa de la fila a la cabecera.
   - Marca «I tried this» y luego «Helpful»: la planta florece.
5. Ve a My garden: la hierba sube y el verde llena la página. Recorre What helps, Connections y Your space.
6. Con la muestra (`/login/patient?sample=1`, Robin) verás un jardín lleno de flores y patrones con datos.
