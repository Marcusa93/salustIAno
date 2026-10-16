# Pantallas y experiencia de usuario

## Pantallas iniciales

La propuesta original listaba nueve pantallas. Para arrancar usable se reducen a cinco. Salud y Desarrollo, en el MVP, son filtros del Timeline más resúmenes específicos, no pantallas separadas. Se separan cuando la cantidad de datos lo justifique.

### Home

Foto o avatar de Salu, edad calculada al día, último sueño, última comida, próximo control o vacuna, botón flotante de carga rápida siempre visible y resumen del día generado por IA al final. Modo oscuro disponible para registros nocturnos.

### Timeline

Línea vertical filtrable por tipo de evento. Es la pantalla emocional del producto y merece diseño cuidado. Tres modos: todo, salud, memoria.

### Cuidar

Pantalla de carga densa: sueño, comida, pañal, salud, medición. Pensada para una mano en el bebé y la otra en el teléfono. Botones grandes, formularios cortos, accesos rápidos.

### Biblioteca y Crear

Una sola sección con dos modos: explorar lo guardado o pedirle a la IA un cuento o canción nueva. Mantenerlas juntas baja el costo cognitivo del menú.

### Familia

Miembros, roles, invitaciones y auditoría básica.

### Cartas (`/carta/[slug]`)

Regalos interactivos, a pantalla completa y sin la navegación de la app. La primera es la carta de Salu a mamá por el Día de la Madre 2026 (`/carta/mama-2026`). Tiene tres escenas:

1. **El sobre.** Un tap lo abre, y ese mismo tap habilita el audio (iOS lo exige).
2. **El latido.** Mamá apoya el dedo y suena el latido de una ecografía, sintetizado con Web Audio. Al completarse, se funde con la primera canción.
3. **La carta.** Capítulos en orden cronológico (de la panza a los 5 meses), cada uno con su texto manuscrito, sus polaroids y su canción, que se funden al pasar de uno a otro. Los "aunque…" de septiembre son un mazo de fotos para deslizar. El final vuelve a la noche: mamá apoya el dedo sobre el corazón de Salu y aparece el cierre, con un contador de cuántos días y segundos hace que es su mamá.

El visor de fotos recorre todas las fotos de la carta en orden cronológico, sin importar desde qué capítulo se abrió. Mientras dura la ventana de fechas de la carta (`letter-window.ts`), el inicio muestra un sobre que lleva a ella. El contenido es privado y no está en el repo (ver [ADR 0014](../decisions/0014-cartas-contenido-privado.md)).

### Salu instalada en el celu

- **Instalación.** En Android aparece un banner con el botón "Instalar" (usa el diálogo nativo de Chrome). En iPhone, el banner explica Compartir → Agregar a inicio. Si lo cierran, no vuelve por 30 días.
- **Atajos.** Mantener apretado el ícono en Android ofrece Anotar toma, sueño o pañal. Llevan a `/anotar/[tipo]`: botones grandes que registran con la hora de ahora y vuelven al inicio.
- **Sin señal.** Si una página no carga por falta de red, se ve `/offline` en la misma URL, con "Reintentar". Cuando vuelve la conexión recarga sola. No se muestran datos guardados en el celu (ver [ADR 0016](../decisions/0016-pwa-offline-y-push.md)).
- **Avisos.** En Mi cuenta, la tarjeta de notificaciones dice en qué estado está ese dispositivo (falta instalar, bloqueadas, apagadas o activadas) y qué hacer. Con los avisos activos, "Mandarme una de prueba" confirma que llegan.

## Tono y estética

La app debe sentirse cálida, familiar, moderna y simple. No debe parecer una historia clínica fría ni una app médica hospitalaria. Debe combinar ternura, claridad, orden, confianza, facilidad de carga y visualización emocional del paso del tiempo.

## Patrones de diseño

**Operación a una mano.** Los controles principales se ubican en la zona inferior de la pantalla, accesibles con el pulgar mientras se sostiene al bebé. Esto influye en la posición del botón flotante de carga rápida, en la disposición del menú y en el diseño de los formularios cortos.

**Modo oscuro real.** No un modo gris azulado: oscuro de verdad, para registros nocturnos a las tres de la mañana sin deslumbrar al bebé ni agotar la vista de los padres. Soportado en toda la app desde el inicio.

**Carga rápida.** Si registrar un sueño toma más de tres taps, la app se abandona en dos meses. Toda la sección de carga se prueba contra ese estándar. Las decisiones de diseño que entran en conflicto con la velocidad de carga pierden.

**Modo abuelos.** Interfaz simplificada con texto grande, botones claros, foco en consumo de recuerdos y novedades, oculta la complejidad técnica. Un familiar mayor debe poder abrir la app, ver una foto nueva del nieto y reaccionar, sin enfrentarse al panel de carga ni a las métricas de sueño.

## Prueba de UX no negociable

Antes de cerrar el flujo de carga, probarlo con la mano no dominante, sentado, en oscuridad, con un peluche en el otro brazo simulando al bebé. Suena absurdo y es la prueba de UX más útil que va a hacerse en este proyecto.
