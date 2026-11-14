# Brief de rediseño: Numa alrededor de un journal que crece contigo

> Documento de referencia de diseño conservado para Numa. Las rutas y algunos detalles técnicos de este brief describen el prototipo de origen; consultar `README.md` y `NUMA_NEXT_STEPS.md` para el estado y la estructura actuales. Este documento no implica que esas tareas estén implementadas.

## Objetivo

Rediseñar la experiencia del paciente para que se sienta como un espacio personal, cálido y sencillo: un buzón/journal que recibe una nueva entrada cada día y que puede crecer con la persona.

La interfaz actual intenta enseñar demasiadas cosas en la primera pantalla —racha, sesión, semana, métricas, microcopy y varios estados— y acaba pareciendo una app clínica. La nueva home debe tener una jerarquía mucho más clara:

1. Abrir el journal y ver qué hay para hoy.
2. Hacer la acción principal sin pensar.
3. Acceder al registro histórico y al dashboard desde una navegación secundaria.

No convertir la home en un dashboard. El dashboard clínico sigue existiendo, pero debe quedar separado de la experiencia personal del paciente.

## Dirección acordada con la persona usuaria

Estas decisiones son intencionales y deben tratarse como la dirección visual/producto principal:

- Metáfora central: un pequeño jardín que crece con cada sesión.
- Estilo del jardín: silvestre, orgánico e imperfecto; evitar una estética demasiado pulida o corporativa.
- Materialidad: interfaz digital limpia con detalles orgánicos puntuales, sin simular papel o artesanía de forma dominante.
- Paleta: Everforest suavizado, con verdes apagados, beige cálido y naranja como acento breve.
- Formas: componentes redondeados y suaves, como piedras, semillas o brotes.
- Primer impacto de la home: mensaje íntimo de bienvenida y después el jardín. Ejemplo de tono: “Qué bien verte. Tu jardín te estaba esperando.”
- Acción principal: `Añadir una entrada`.
- Cada entrada combina la sesión de voz con una pequeña reflexión automática.
- Tono de la reflexión automática: emocional y centrado en el autocuidado, por ejemplo “Hoy has cuidado un poco más de ti.” Evitar sonar clínico, evaluativo o excesivamente técnico.
- El jardín se compone de varias plantas pequeñas y cambia según la constancia, sin presentar una racha numérica como protagonista.
- En la parte superior solo aparece un resumen muy breve; después se muestra el jardín completo y la acción principal `Añadir una entrada`.
- Al hacer scroll, el jardín continúa creciendo y revela la última entrada y un resumen breve de progreso.
- El acceso a `Registro` y `Dashboard` vive en un menú pequeño de la esquina superior.
- El menú contiene únicamente `Registro` y `Dashboard` y se abre mediante un icono de hoja.
- Deben existir dos experiencias con nombres distintos: `Dashboard` para el psicólogo, con múltiples pacientes, alertas, sesiones, tendencias y sincronización; y `Mi jardín` para el paciente, como vista personal y simplificada centrada en su evolución y en el crecimiento del jardín.
- Las animaciones mezclan crecimiento lento y transiciones suaves al hacer scroll; no debe haber movimiento constante.

## Contexto técnico actual

El proyecto es una app React + Vite con Tailwind y `react-router`.

Archivos relevantes:

- `src/features/patient/Home.tsx`: home actual del paciente; contiene greeting, streak, sesión de hoy y week strip.
- `src/features/patient/Session.tsx`: flujo de grabación/sesión; debe conservarse funcional.
- `src/features/patient/Result.tsx`: resultado tras completar la sesión.
- `src/features/patient/Progress.tsx`: pantalla actual de progreso/calendario; candidata a convertirse en “Journal” o “Registro”.
- `src/features/patient/PatientShell.tsx`: marco móvil y posible lugar para la navegación principal del paciente.
- `src/app/router.tsx`: rutas actuales `/patient/home`, `/patient/session`, `/patient/result`, `/patient/progress`, además del portal `/clinic`.
- `src/design/tokens.css`: tokens de color, tipografías, sombras y textura global.
- `src/data/store.ts`, `src/data/patientCalendar.ts`: estado y fechas/sesiones que no deben romperse durante el rediseño.

Antes de editar, inspeccionar también cómo se resuelve la navegación desde `PatientShell`, cómo se persiste una sesión y qué botón o enlace se identifica actualmente como “Today”.

## Dirección visual

### Sensación

- Minimalista, calmada, íntima y acogedora.
- Más parecida a abrir un buzón personal o un cuaderno vivo que a consultar una aplicación médica.
- La persona debe sentir continuidad: cada sesión añade una hoja, una entrada o una pequeña marca al journal.
- Usar plantas, hojas, brotes, ramas sutiles o pequeñas ilustraciones orgánicas como lenguaje visual; evitar una decoración literal o infantil.

### Color

Explorar una paleta cálida inspirada en Everforest, sin copiarla literalmente:

- Fondo principal: crema cálido / papel claro.
- Superficies: marfil, avena o arena muy suave.
- Acción principal: naranja pastel / terracota suave.
- Estado positivo: verde hoja o salvia.
- Texto: verde bosque profundo o carbón verdoso, no azul marino clínico.
- Detalles opcionales: amarillo mantequilla, arcilla o verde musgo.

La paleta debe mantener contraste accesible. No usar naranja y verde como únicos indicadores de estado. Revisar especialmente focus states, botones deshabilitados y texto secundario.

### Tipografía y densidad

- Reducir el número de etiquetas en mayúsculas y textos de 11–12 px.
- Evitar bloques de microcopy explicativo debajo de cada elemento.
- Usar una tipografía display cálida para el saludo/título y una sans legible para controles.
- Priorizar espacios generosos, una sola tarjeta principal y pocos elementos visibles por defecto.
- Las métricas secundarias pueden aparecer en el registro o al expandir una entrada, no en la home.

## Nueva arquitectura de la experiencia del paciente

### Home: el buzón del journal

La home (`/patient/home`) debe mostrar:

- Un header muy sencillo con saludo y una pequeña fecha contextual, sin una cascada de texto.
- Un buzón, sobre, cuaderno o panel de journal como foco visual principal.
- Una entrada destacada de “Hoy” si todavía no se ha hecho la sesión.
- Un CTA claro, corto y accionable, por ejemplo `Abrir journal`, `Empezar hoy` o `Añadir entrada`.
- Si hoy ya está completado, la misma entrada debe transformarse en un estado tranquilo de completado y permitir revisar el resultado.
- Una pista visual de crecimiento: hojas, marcas o entradas acumuladas. Debe ser sutil y no convertirse en una racha gamificada protagonista.
- Accesos secundarios discretos a `Registro` y `Dashboard`.

La home no debe mostrar simultáneamente el streak grande, la tarjeta de tres actividades, el week strip y un footer informativo. Si se conserva la racha, reducirla a un detalle pequeño dentro del journal, por ejemplo “47 días cuidando tu voz”, sin tarjeta independiente.

### Registro / Journal

La pantalla que hoy es `Progress` debe evolucionar hacia un registro cronológico de entradas:

- Lista o timeline de sesiones/entradas ordenadas por fecha.
- Cada entrada debe tener fecha, estado y una frase breve o resultado resumido.
- La entrada de hoy debe destacarse suavemente.
- Los detalles clínicos o biomarcadores pueden estar colapsados o reservarse para el dashboard.
- Mantener la posibilidad de ver tendencias/progreso, pero como una capa secundaria y comprensible.
- La metáfora visual de hojas/crecimiento debe ayudar a orientarse, no dificultar la lectura.

Si “Registro” y “Journal” son conceptos distintos en el producto, conservar ambos nombres solo si existe una diferencia real. Si no, usar un único término consistente en toda la UI.

### Dashboard

Hay dos dashboards y no deben confundirse:

#### Dashboard del psicólogo

El dashboard clínico de `/clinic/dashboard` es una experiencia profesional diferente. Debe conservar la vista de múltiples pacientes, alertas, sesiones, tendencias, sincronización de dispositivo y acceso a informes. Puede compartir tokens de color con el paciente, pero no la misma composición ni la misma metáfora de jardín.

#### Mi jardín: dashboard del paciente

`Mi jardín` debe ser una versión personal y simplificada, accesible desde el menú de hoja. Debe mostrar únicamente lo que ayuda a la persona a entender su propia evolución:

- resumen visual del jardín y cómo ha crecido;
- sesiones, constancia y reflexiones recientes;
- una evolución temporal muy simple, sin números clínicos como protagonista;
- acceso al registro completo;
- relación visual con el jardín que crece.

Debe combinar estos elementos suavemente, con el jardín como foco principal. No convertirlo en una cuadrícula de estadísticas.

No debe mostrar pacientes, alertas clínicas, tablas densas ni biomarcadores técnicos como contenido principal. Los datos clínicos detallados permanecen en la experiencia del psicólogo.

- Mantener las capacidades existentes: pacientes, alertas, sesiones, tendencias y sincronización.
- Aplicar la nueva paleta solo de forma compatible con su contexto profesional.
- No renombrar rutas ni romper el flujo de login, detalle de paciente, informes o sincronización.

## Navegación propuesta

Para paciente, usar un header minimalista sin barra inferior fija. El jardín y la acción principal deben ocupar el foco visual. En la esquina superior habrá un único botón con icono de hoja; al abrirlo mostrará solo `Registro` y `Dashboard`.

No añadir una barra de navegación llena de iconos ni accesos persistentes que compitan con el jardín. El menú puede usar iconos secundarios, pero debe mostrar nombres claros para evitar ambigüedad.

## Reparar el botón “Today”

El botón/enlace relacionado con “Today” debe revisarse de extremo a extremo:

1. Identificar dónde se renderiza exactamente y qué comportamiento se espera.
2. Si representa la sesión actual, debe llevar a `/patient/session` cuando hoy aún no está completado.
3. Si hoy ya está completado, debe llevar al resultado o a la entrada de hoy, no reiniciar silenciosamente una sesión antigua.
4. Debe respetar la lógica de fecha existente (`isSameLocalDay`, `clockNow` y la zona horaria configurada).
5. Debe funcionar con teclado, tener `aria-label` útil y mostrar estado de foco.
6. Añadir o actualizar tests para: hoy pendiente, hoy completado, fecha anterior y navegación directa.
7. Evitar nombres ambiguos como `Today something`; usar una acción que describa el resultado: `Empezar hoy`, `Ver entrada de hoy` o `Continuar journal`.

No cambiar la lógica de datos solo para ocultar el bug visual. Primero reproducirlo y documentar la causa.

## Reglas de interacción

- Una acción principal por pantalla.
- No usar modales para tareas sencillas del journal.
- Las animaciones deben ser lentas y orgánicas, como crecimiento o una hoja que aparece; nada de rebotes constantes.
- Respetar `prefers-reduced-motion` y el toggle de reduced motion ya existente.
- Los estados vacíos deben ser cálidos y útiles, no párrafos largos.
- Las entradas nuevas deben sentirse acumulativas: añadir una hoja/entrada al completar la sesión y actualizar el journal sin perder el resultado.
- Mantener el audio, la grabación, el análisis, el resultado y la sincronización existentes.

## Qué quitar o reducir

- Reducir/eliminar el protagonismo del streak con llama.
- Eliminar la tarjeta azul oscura de “Today's session” como bloque dominante.
- Reducir la tira semanal a una indicación secundaria dentro del registro, si sigue siendo útil.
- Quitar etiquetas uppercase pequeñas y explicaciones repetidas.
- Evitar que la home parezca una colección de tarjetas estadísticas.
- Reducir ondas decorativas y efectos que no expliquen el estado del journal.
- Evitar ilustraciones o adornos de plantas que compitan con la acción principal.

## Criterios de aceptación

- Al abrir `/patient/home`, se entiende en menos de 3 segundos qué es el journal y qué hacer hoy.
- La home tiene una sola acción principal visible.
- El usuario puede llegar al registro en un toque y al dashboard/área profesional desde un acceso secundario claramente distinguido.
- El flujo de sesión existente sigue funcionando de principio a fin.
- El estado de hoy pendiente y completado es inequívoco.
- El botón “Today” funciona en navegación normal, teclado y acceso directo.
- No se muestran textos diminutos como información esencial.
- La UI se siente cálida y natural con una paleta crema + naranja pastel + verdes, manteniendo contraste AA donde corresponda.
- La interfaz funciona en móvil y no introduce overflow horizontal.
- Se ejecutan tests y se añade cobertura para la navegación de hoy y el estado del journal.

## Preguntas que hay que resolver antes de cerrar el diseño

1. Cuando dices “registro”, ¿te refieres al historial personal de sesiones del paciente o al dashboard clínico para profesionales?
2. ¿El “journal que crece contigo” debe ser principalmente visual/decorativo, o quieres que cada entrada tenga también notas escritas por la persona?
3. ¿Quieres mantener el concepto de racha, aunque sea discreto, o prefieres eliminar por completo la gamificación?
4. ¿El CTA de hoy debe iniciar directamente la grabación, abrir una vista previa del journal o mostrar primero una pantalla de bienvenida?
5. ¿“Today something” es un texto concreto que ves en la interfaz o te refieres al botón de sesión de hoy? Conviene compartir una captura o el texto exacto si no aparece en `Home.tsx`.
6. ¿El dashboard al que quieres acceder desde la app es el dashboard clínico actual (`/clinic/dashboard`) o imaginas también un dashboard personal para el paciente?
7. ¿Prefieres navegación inferior en móvil o un menú más discreto en la esquina/header?
8. ¿Hay referencias visuales concretas que quieras seguir además de Everforest —por ejemplo una app, marca, ilustrador o tipo de papelería—?
9. ¿Quieres conservar el marco de teléfono del prototipo para la demo o diseñar la experiencia como una app responsive a pantalla completa?
10. ¿Hay textos o términos de marca que deban mantenerse exactamente, especialmente “Numa”, “journal”, “registro” y “dashboard”?

## Orden recomendado para implementar

1. Resolver la arquitectura del jardín y el menú de hoja del paciente.
2. Rediseñar tokens visuales y `PatientShell`.
3. Rehacer `Home.tsx` alrededor del buzón/journal.
4. Transformar `Progress.tsx` en registro/journal cronológico.
5. Corregir y testear el CTA de hoy.
6. Revisar estados completado, vacío, error, focus y reduced motion.
7. Verificar que no se rompe el flujo clínico ni la sincronización.
8. Probar en viewport móvil estrecho y desktop, y revisar contraste y densidad de texto.
