# MVP y plan por fases

## MVP versión cero

Asumiendo un solo desarrollador con trabajo paralelo y un bebé que viene en camino, el alcance del primer entregable se limita deliberadamente. La meta es que el día que nazca Salustiano, abrir la app y registrar el nacimiento sea un acto natural.

1. Autenticación con Supabase. Un grupo familiar.
2. Perfil de Salustiano editable, con campos de edad gestacional incluidos.
3. Tres tipos de eventos: sueño, alimentación, pañal, con carga rápida desde botón flotante.
4. Mediciones de peso y talla, graficadas contra curvas OMS.
5. Timeline simple, filtrable.
6. Subida de fotos con nota.
7. Invitación a la madre y a un familiar más, sin roles diferenciados todavía: todos administran.
8. Un solo agente IA: resumen del día.
9. PWA instalable con cola offline básica.
10. Botón de exportación total.
11. Botón de borrado total.

Nada más. Sin biblioteca, sin generador de cuentos, sin vacunas, sin agente médico. Esas capas se construyen después de las primeras semanas reales de uso, cuando el comportamiento real va a mostrar qué fricciones existen y qué información se está perdiendo.

## Plan por fases

Las fases se anclan a hitos de vida del bebé, no a meses calendario. Esto evita el calendario ficticio y obliga a que cada feature aparezca cuando hay uso que la pida.

### Fase 0 · Antes del nacimiento

MVP versión cero, deployado, probado con la madre. Setup técnico, modelo de datos, auth, perfil, eventos básicos, timeline, fotos, exportación, modo oscuro. Sin IA todavía o con un agente apenas funcional.

### Fase 1 · Primer mes de vida

Estabilizar carga rápida según fricción real. Sumar resumen diario por IA. Backup automático verificado. Solo escuchar y arreglar; nada de features grandes.

### Fase 2 · Mes dos a tres

Calendario nacional de vacunas precargado, controles pediátricos, generador de resumen para llevar al pediatra en modo borrador. Roles diferenciados para sumar a abuelos sin darles acceso pleno.

### Fase 3 · Mes cuatro a seis

Generador de cuentos personalizados. Biblioteca curada manualmente —cien recursos seleccionados a mano valen más que un "agente curador" que aún no tiene datos suficientes—. Hitos de desarrollo basados en CDC y Pathways, traducidos.

### Fase 4 · Mes seis a doce

Análisis de patrones de sueño y alimentación con seis meses de datos. Generador de canciones: letras propias y prompts para modelos de música tipo Suno, abstraídos detrás de una interfaz propia para poder cambiar de proveedor. Resumen semanal y mensual.

### Fase 5 · Después del primer año

Libro del primer año exportable a PDF. Modo pediatra invitado con vista limitada y consideraciones legales de historia clínica. Carga por lenguaje natural. Si el proyecto sigue vivo y útil, recién en este punto evaluar abrirlo a otras familias.
