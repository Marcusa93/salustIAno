**Proyecto Salu**

*Sistema operativo familiar para acompañar la crianza de Salustiano*

Documento consolidado de arquitectura y alcance

Versión 1.0  ·  Tucumán, abril 2026

# **1\. Visión y principio rector**

Salu es una webapp privada y familiar pensada para acompañar la crianza de Salustiano. No es una app genérica de crianza ni un baby tracker más: es un sistema que combina bitácora de cuidado, memoria familiar y plataforma creativa, con asistencia de inteligencia artificial.

El principio rector que ordena todas las decisiones de producto es el siguiente: Salustiano será cuidado por personas, con asistencia de algoritmos. La IA no decide, no diagnostica y no reemplaza criterio humano. La IA organiza datos, resume información, sugiere actividades, detecta patrones, formula preguntas y genera contenidos creativos. Todas las decisiones sensibles —médicas, pedagógicas, vinculares— quedan en manos de los humanos responsables: padres, pediatra, familia.

Esta separación es la línea que divide un producto útil de un producto peligroso. Toda la arquitectura, los permisos, los prompts de los agentes y la experiencia de usuario están diseñados para sostenerla.

# **2\. Marco legal aplicable**

El proyecto se desarrolla y se utiliza en Argentina. El marco normativo aplicable, en orden de relevancia, es:

* **Ley 25.326 de Protección de los Datos Personales**. Los datos de salud de Salustiano son “datos sensibles” según el artículo 2 y reciben protección reforzada por el artículo 7\. Esto exige consentimiento expreso, finalidad determinada y medidas de seguridad adecuadas.

* **Ley 26.529 de Derechos del Paciente, Historia Clínica y Consentimiento Informado**. Relevante si en algún momento se invita a un pediatra al sistema, porque define qué constituye historia clínica y qué obligaciones de resguardo aparecen.

* **Ley 26.061 de Protección Integral de los Derechos de Niñas, Niños y Adolescentes**. Establece el principio de interés superior del niño, que en este contexto se traduce en minimización de datos, control parental y protección de la imagen.

Para uso estrictamente familiar y privado, el riesgo regulatorio es bajo. Pero el encuadre correcto importa: si en el futuro se invita a profesionales o se considera abrir el producto a otras familias, el marco aplicable seguirá siendo el argentino y no marcos extranjeros como COPPA o GDPR-K, que aparecen citados con frecuencia en propuestas de IA pero que no rigen este caso.

# **3\. Arquitectura funcional**

El sistema se piensa en tres capas conceptuales claramente separadas. Esta separación es lo que permite incorporar IA sin contaminar la integridad de los datos cargados por humanos.

## **3.1 Capa de hechos**

Datos crudos cargados por personas: sueño, comidas, pañales, mediciones, fotos, notas, eventos médicos. Son inmutables salvo edición o borrado explícito de un administrador. Toda mutación queda registrada con autor, timestamp y motivo. La IA nunca escribe directamente en esta capa sin validación humana previa.

## **3.2 Capa de memoria**

Composiciones derivadas de los hechos: timeline, biblioteca, álbumes, relatos como “el primer mes de Salu”. Es reconstruible a partir de la capa de hechos. Aquí pueden coexistir aportes humanos y aportes de IA, siempre con autoría visible.

## **3.3 Capa de inteligencia artificial**

Agentes que leen las capas anteriores y producen sugerencias, resúmenes, cuentos, alertas suaves y preguntas para el pediatra. Su salida vive en una tabla propia y separada, con referencia al prompt usado, al modelo, a los datos consultados y al momento de generación. La IA propone; los humanos disponen. Siempre se puede saber qué dijo la IA, cuándo y con qué insumos.

# **4\. Stack técnico**

La selección busca un equilibrio entre productividad de un solo desarrollador, seguridad razonable y posibilidad de evolución.

* **Frontend:** Next.js 15 con App Router, TypeScript, Tailwind, shadcn/ui.

* **Backend y datos:** Supabase, que provee Auth, Postgres con Row Level Security, Storage y Edge Functions.

* **IA:** OpenRouter como capa de abstracción sobre proveedores de modelos. Esta decisión evita atarse a un proveedor específico —Anthropic, OpenAI, Google— y permite mezclar modelos según tarea: chicos y baratos para resúmenes, grandes para creación.

* **Búsqueda semántica futura:** extensión pgvector de Postgres activada desde el inicio aunque no se use de inmediato.

* **Tareas en segundo plano:** pg\_cron y Vercel Cron en una primera etapa, sin sumar infraestructura nueva.

* **Deploy:** Vercel para la web; PWA con instalación en pantalla principal y soporte offline básico para carga rápida sin conexión.

# **5\. Modelo de datos**

Las entidades se agrupan en seis dominios. Esta organización facilita pensar políticas de seguridad coherentes y evolucionar el esquema sin romper consultas existentes.

| Dominio | Entidades principales |
| :---- | :---- |
| Identidad y familia | family\_groups, users, family\_memberships con role y permisos, invitations. |
| Niño | child\_profiles con campos para edad gestacional al nacer y flag de prematurez; child\_measurements para peso, talla y perímetro cefálico contra curvas OMS. |
| Eventos de cuidado | Tablas específicas por tipo: sleep\_sessions, feeding\_events, diaper\_events, mood\_logs. Por encima, una vista o tabla materializada timeline\_events que actúa como índice unificado. |
| Salud | health\_events, medications, vaccines con catálogo del calendario nacional argentino precargado, medical\_appointments, allergies, medical\_documents. |
| Memoria y biblioteca | media\_items con storage path —no blobs en la base—, notes, library\_items, library\_consumptions. |
| Creaciones IA | generated\_stories, generated\_songs, ai\_summaries, ai\_recommendations. Todas con prompt\_used, model, inputs\_snapshot y referencia al evento que las originó. |
| Gobernanza | audit\_logs para toda mutación de datos sensibles, data\_exports, consents. |

## **5.1 Decisiones de diseño no negociables**

Tres decisiones se toman ahora porque su costo es bajo si se incorporan al inicio y muy alto si se retrofittean después.

* **Soft delete obligatorio** en toda tabla con datos del niño. Un familiar borrando sin querer la primera ecografía no debe ser un evento terminal.

* **Edad gestacional al nacer** como campo del perfil. Aunque Salustiano nazca a término, sumar dos campos hoy permite que el sistema funcione bien si en el futuro hay un hermano prematuro o si los hitos requieren edad corregida. La edad corregida se calcula como edad cronológica menos las semanas que faltaron para 40\.

* **Trazabilidad por defecto** en todo evento sensible: autor, timestamp, validado por, validado en. Sin esto, los resúmenes de IA pierden confiabilidad.

# **6\. Pantallas iniciales**

La propuesta original listaba nueve pantallas. Para arrancar usable se reducen a cinco. Salud y Desarrollo, en el MVP, son filtros del Timeline más resúmenes específicos, no pantallas separadas. Se separan cuando la cantidad de datos lo justifique.

### **Home**

Foto o avatar de Salu, edad calculada al día, último sueño, última comida, próximo control o vacuna, botón flotante de carga rápida siempre visible y resumen del día generado por IA al final. Modo oscuro disponible para registros nocturnos.

### **Timeline**

Línea vertical filtrable por tipo de evento. Es la pantalla emocional del producto y merece diseño cuidado. Tres modos: todo, salud, memoria.

### **Cuidar**

Pantalla de carga densa: sueño, comida, pañal, salud, medición. Pensada para una mano en el bebé y la otra en el teléfono. Botones grandes, formularios cortos, accesos rápidos.

### **Biblioteca y Crear**

Una sola sección con dos modos: explorar lo guardado o pedirle a la IA un cuento o canción nueva. Mantenerlas juntas baja el costo cognitivo del menú.

### **Familia**

Miembros, roles, invitaciones y auditoría básica.

# **7\. Roles y permisos**

El sistema utiliza control de acceso basado en roles, anclado en políticas de Row Level Security de Postgres. Cuatro roles iniciales son suficientes.

| Rol | Alcance |
| :---- | :---- |
| Admin | Padre y madre. Acceso total, incluye edición de datos médicos, borrado, gestión de invitaciones y validación de cargas de otros familiares. |
| Caregiver | Cuidador o cuidadora frecuente. Carga todos los eventos de cuidado, lee todo, no edita perfil ni elimina registros. |
| Family | Abuelos, tíos. Cargan memorias, notas y fotos. Leen la mayoría de los datos. No ven detalle de salud salvo permiso explícito. |
| Viewer | Solo lectura del timeline público de la familia. |

El rol de pediatra invitado se posterga deliberadamente. Que un profesional acceda a datos a través de la app trae implicancias de historia clínica bajo la Ley 26.529 que conviene no enfrentar antes de tiempo. Mientras tanto, la herramienta para llevar al pediatra es un resumen exportable en PDF, generado por IA en modo borrador y revisado por los padres antes de imprimirse.

La edición de datos médicos cargados por un familiar siempre requiere validación de un administrador antes de impactar en cualquier resumen de IA. Los campos validated\_by y validated\_at modelan esa regla.

# **8\. Agentes LLM**

No se construyen ocho agentes a la vez. Se construye uno y se establece el patrón para sumar más. Cada agente cumple cuatro condiciones.

1. Tiene un system prompt versionado en el repositorio, no editable desde la interfaz.

2. Tiene un esquema de input estricto que define qué datos del niño puede ver. El agente creativo no ve síntomas; el agente de salud no ve cuentos.

3. Tiene un esquema de output validado con Zod antes de llegar al usuario.

4. Su salida pasa por una capa de presentación que añade los disclaimers que correspondan.

## **8.1 Orden de incorporación**

Resumen diario en primer lugar; generador de cuentos en segundo; resumen para pediatra en modo borrador en tercero; agente pedagógico en cuarto; análisis de patrones de sueño y alimentación recién cuando haya al menos seis meses de datos reales que analizar. Antes de eso, los “patrones” serían ruido estadístico.

## **8.2 Agente médico: tratamiento especial**

Cuando se incorpore, el agente que toca temas de salud tiene reglas más estrictas que los demás:

* System prompt con prohibiciones explícitas: no diagnosticar, no recomendar medicación, no estimar gravedad numérica, no calcular dosis.

* Disclaimer no removible al final de cada salida: este texto no reemplaza la consulta con el pediatra.

* Guardrail en código que rechaza la respuesta si contiene patrones tipo “tomá X miligramos” o nombres de medicamentos en contexto de prescripción.

* Modo borrador en los primeros meses: la salida se guarda para que un humano la revise antes de mostrarse.

* Trazabilidad completa: prompt, modelo, datos consultados, momento.

# **9\. Reglas que cumplen todos los agentes**

5. No inventar datos de Salustiano. Si falta información, pedirla.

6. Distinguir explícitamente entre datos registrados, inferencias y sugerencias.

7. Lenguaje prudente y probabilístico, no asertivo.

8. No diagnosticar ni reemplazar al pediatra.

9. No generar alarmismo. Si algo parece fuera de lo esperable, recomendar consulta sin sembrar miedo.

10. No recomendar medicación ni dar instrucciones médicas.

11. Mostrar la base de los datos internos usados cuando sea posible.

12. Permitir que los padres validen recomendaciones sensibles antes de que entren al timeline.

13. Mantener separados los dominios de memoria, creatividad, salud y pedagogía.

# **10\. Reglas de seguridad médica y pedagógica**

Hay decisiones que no dependen de la IA. Son contenido fijo del producto, escrito y revisado, presente como recordatorio visible. La regla es que la información que potencialmente puede salvar una vida no debe poder ser alucinada.

## **10.1 Sueño seguro**

Tomado de las recomendaciones de la Academia Americana de Pediatría sobre prevención del Síndrome de Muerte Súbita del Lactante. Aparece como contenido estático en el módulo de sueño:

* Boca arriba para cada sueño durante el primer año.

* Superficie firme, plana, en cuna, moisés o parque que cumpla normas.

* Cuna vacía: sin almohadas, mantas sueltas, peluches ni protectores.

* Habitación compartida, cama separada, durante al menos los primeros seis meses.

## **10.2 Signos de alarma**

Los signos generales de peligro descritos por la Organización Mundial de la Salud aparecen como lista educativa visible en el módulo de salud, no como alerta automática disparada por IA. La diferencia importa: la lista educa al cuidador; la alerta automática genera dependencia y puede dar falsos negativos peligrosos.

* Incapacidad para beber o mamar.

* Vómitos persistentes, vomita todo lo que ingiere.

* Convulsiones durante la enfermedad actual.

* Letargia o inconsciencia, no se despierta o parece inusualmente decaído.

* Dificultad respiratoria: aleteo nasal, quejidos, hundimiento severo del pecho.

Cada vez que se muestran, llevan asociado el mensaje: ante cualquiera de estas señales, consulta médica inmediata.

## **10.3 Pantallas**

Siguiendo recomendaciones consolidadas de la AAP desde 2016 y reafirmadas en guías posteriores, la app desaconseja explícitamente el uso de pantallas en menores de 18 meses, salvo videollamadas con familiares. Entre los 2 y 5 años, máximo una hora diaria de contenido de calidad, siempre en compañía de un adulto. La biblioteca distingue entre recursos para mirar, escuchar, leer, jugar o compartir, y la app no fomenta consumo pasivo.

# **11\. Privacidad y seguridad**

La privacidad de los datos de un menor es central por diseño, no una capa agregada al final.

## **11.1 Principios**

* Acceso privado mediante autenticación por familia.

* Roles y permisos diferenciados, anclados en políticas de Row Level Security de Postgres.

* No exposición pública de datos.

* No envío de información sensible a servicios externos sin control. OpenRouter y proveedores de modelos: revisar términos para que no entrenen con los datos enviados.

* Registro de auditoría de mutaciones sensibles.

* Separación lógica entre datos médicos, recuerdos familiares y contenido creativo.

* Posibilidad de exportar todo en cualquier momento.

* Posibilidad de eliminar todo en cualquier momento.

## **11.2 Decisiones técnicas concretas**

* Buckets de Storage privados con signed URLs de expiración corta. Nunca paths públicos.

* EXIF sanitizado al subir fotos: la geolocalización se elimina por defecto.

* Cifrado en reposo provisto por Supabase. Cifrado a nivel de aplicación, con clave por familia, queda como capa opcional para campos especialmente sensibles —diagnósticos, medicación—. No se persigue cifrado de extremo a extremo de toda la base, porque sería incompatible con el procesamiento por IA y no es proporcional al riesgo de uso familiar privado.

* Auditoría automática de RLS antes de cada deploy: tests que intentan leer datos cruzados entre familias y deben fallar.

* Backup nocturno automático a una cuenta familiar de Google Drive, además del backup del proveedor.

* Botón de exportación total: ZIP con JSON estructurado más carpeta de medios. Este botón no es un feature, es contrato moral con la familia.

# **12\. Experiencia de usuario**

La app debe sentirse cálida, familiar, moderna y simple. No debe parecer una historia clínica fría ni una app médica hospitalaria. Debe combinar ternura, claridad, orden, confianza, facilidad de carga y visualización emocional del paso del tiempo.

## **12.1 Patrones de diseño**

* Operación a una mano: controles principales en la zona inferior de la pantalla, accesibles con el pulgar mientras se sostiene al bebé.

* Modo oscuro real para registros nocturnos sin deslumbrar.

* Carga rápida: si registrar un sueño toma más de tres taps, la app se abandona en dos meses. Toda la sección de carga se prueba contra ese estándar.

* Modo abuelos: interfaz simplificada con texto grande, botones claros, foco en consumo de recuerdos y novedades, oculta la complejidad técnica.

## **12.2 Prueba de UX no negociable**

Antes de cerrar el flujo de carga, probarlo con la mano no dominante, sentado, en oscuridad, con un peluche en el otro brazo simulando al bebé. Suena absurdo y es la prueba de UX más útil que va a hacerse en este proyecto.

# **13\. MVP versión cero**

Asumiendo un solo desarrollador con trabajo paralelo y un bebé que viene en camino, el alcance del primer entregable se limita deliberadamente. La meta es que el día que nazca Salustiano, abrir la app y registrar el nacimiento sea un acto natural.

14. Autenticación con Supabase. Un grupo familiar.

15. Perfil de Salustiano editable, con campos de edad gestacional incluidos.

16. Tres tipos de eventos: sueño, alimentación, pañal, con carga rápida desde botón flotante.

17. Mediciones de peso y talla, graficadas contra curvas OMS.

18. Timeline simple, filtrable.

19. Subida de fotos con nota.

20. Invitación a la madre y a un familiar más, sin roles diferenciados todavía: todos administran.

21. Un solo agente IA: resumen del día.

22. PWA instalable con cola offline básica.

23. Botón de exportación total.

Nada más. Sin biblioteca, sin generador de cuentos, sin vacunas, sin agente médico. Esas capas se construyen después de las primeras semanas reales de uso, cuando el comportamiento real va a mostrar qué fricciones existen y qué información se está perdiendo.

# **14\. Plan por fases**

Las fases se anclan a hitos de vida del bebé, no a meses calendario. Esto evita el calendario ficticio y obliga a que cada feature aparezca cuando hay uso que la pida.

### **Fase 0  ·  Antes del nacimiento**

MVP versión cero, deployado, probado con la madre. Setup técnico, modelo de datos, auth, perfil, eventos básicos, timeline, fotos, exportación, modo oscuro. Sin IA todavía o con un agente apenas funcional.

### **Fase 1  ·  Primer mes de vida**

Estabilizar carga rápida según fricción real. Sumar resumen diario por IA. Backup automático verificado. Solo escuchar y arreglar; nada de features grandes.

### **Fase 2  ·  Mes dos a tres**

Calendario nacional de vacunas precargado, controles pediátricos, generador de resumen para llevar al pediatra en modo borrador. Roles diferenciados para sumar a abuelos sin darles acceso pleno.

### **Fase 3  ·  Mes cuatro a seis**

Generador de cuentos personalizados. Biblioteca curada manualmente —cien recursos seleccionados a mano valen más que un “agente curador” que aún no tiene datos suficientes—. Hitos de desarrollo basados en CDC y Pathways, traducidos.

### **Fase 4  ·  Mes seis a doce**

Análisis de patrones de sueño y alimentación con seis meses de datos. Generador de canciones: letras propias y prompts para modelos de música tipo Suno, abstraídos detrás de una interfaz propia para poder cambiar de proveedor. Resumen semanal y mensual.

### **Fase 5  ·  Después del primer año**

Libro del primer año exportable a PDF. Modo pediatra invitado con vista limitada y consideraciones legales de historia clínica. Carga por lenguaje natural. Si el proyecto sigue vivo y útil, recién en este punto evaluar abrirlo a otras familias.

# **15\. Riesgos**

## **15.1 Médicos**

Alucinación del LLM dando consejo peligroso es el riesgo más serio. Mitigación: ningún output del agente médico se muestra sin validación humana hasta que existan cientos de salidas revisadas con confianza estadística en el comportamiento. Hasta entonces, modo borrador permanente. La app no calcula dosis de medicamentos bajo ninguna circunstancia.

## **15.2 Legales**

En uso familiar privado el riesgo es bajo. Las precauciones razonables: registrar consentimiento explícito de cada familiar al unirse; no incorporar terceros profesionales sin contrato; no usar los datos para entrenar modelos de terceros; tener política de retención y borrado clara.

## **15.3 Privacidad**

Fotos de un menor en infraestructura de terceros. RLS mal configurada es la falla más probable y más grave. Tests automatizados que intentan leer datos cruzados entre familias deben correr antes de cada deploy. Sanitización de EXIF al subir fotos. Signed URLs con expiración.

## **15.4 Técnicos**

Costos de LLM: usar modelos chicos como Haiku o GPT-4o-mini para resúmenes, modelos grandes solo para creación. Cachear resúmenes diarios. Bloqueo de proveedor: por eso OpenRouter como capa de abstracción.

## **15.5 Producto**

Fricción de carga mata baby trackers. Si la madre no carga eventos en las primeras dos semanas, hay que rediseñar el flujo, no agregar features.

## **15.6 Pérdida de memoria**

Si la app se rompe o se decide dejarla, la familia pierde años de datos. Por eso exportación total y backup nocturno externo son requisitos del MVP, no de fases tardías.

# **16\. Decisiones explícitamente descartadas**

Esta sección existe para que más adelante, si alguien sugiere reincorporar estas ideas, haya un registro de por qué se descartaron.

## **16.1 Cálculo automático de dosis de medicamentos**

Aunque algunas apps lo ofrecen y aunque se base en peso, el riesgo médico-legal es serio. Errores en el peso registrado, condiciones que alteran el metabolismo, interacción con otros medicamentos: el cálculo “correcto” puede ser tóxico. La app registra dosis indicadas por el pediatra, no las calcula ni las sugiere.

## **16.2 Alertas médicas automatizadas disparadas por IA**

Los signos de alarma se muestran como contenido educativo visible, no como alertas que el sistema dispara solo. La diferencia es que el contenido fijo no falla; un clasificador automático sí, y los falsos negativos en este dominio son peligrosos.

## **16.3 Cifrado de extremo a extremo de toda la base**

Es incompatible con varias features deseadas: si la IA tiene que procesar datos para generar resúmenes, alguien tiene que descifrarlos. E2EE real implica gestión de claves del lado del cliente, sin recuperación si se pierden. Para uso familiar privado lo proporcional es cifrado en reposo, RLS estricta, signed URLs y cifrado opcional a nivel de aplicación para campos especialmente sensibles.

## **16.4 Verificación parental con identificación oficial o tarjeta de crédito**

Es solución para problemas que esta app no tiene. Está diseñada para servicios donde un menor podría hacerse pasar por adulto. Acá el administrador es conocido y no hay terceros. Sumar fricción de identidad estatal es overengineering.

## **16.5 Hardware dedicado de carga**

Botones físicos para registrar eventos sin sacar el teléfono son una idea simpática pero agregan dependencias y costos que no se justifican. Si la fricción de carga es problema, la solución son widgets, accesos directos y posiblemente carga por lenguaje natural en el futuro, no hardware.

## **16.6 Marcos legales extranjeros como base**

COPPA y GDPR-K aparecen citados con frecuencia en propuestas de IA pero no rigen este caso. El marco aplicable es el argentino. Los principios de minimización, consentimiento y derechos del titular se cumplen igual; solo cambia la norma de referencia.

# **17\. Decisiones a cerrar antes del primer commit**

Tres decisiones de producto que conviene resolver antes de empezar a programar, porque cambiarlas después tiene costo:

24. Idioma del producto. Solo español o español más alguna otra lengua para algún familiar. Si es solo español, ahorra abstracciones de internacionalización innecesarias.

25. Identidad gráfica. Paleta, tipografía, tono. Define si es app cálida y orgánica, minimalista clínica, lúdica infantil. Cada opción mueve decisiones de UX. Vale la pena un día de exploración visual antes de elegir componentes.

26. Política de fotos. Quién puede subir, quién puede ver, qué expira, qué se exporta automáticamente al backup familiar. Esto define varias políticas de RLS que se programan una vez.

# **18\. Cierre**

Salu no es solo software. Es el primer cofre de tesoros digital de Salustiano y un compromiso técnico de la familia con su propia memoria. Cada decisión de privacidad, cada disclaimer en la IA, cada test de RLS y cada botón de exportación son actos de cuidado hacia su futuro.

El plan razonable es construir poco, construir bien y dejar que el bebé y la familia muestren cuáles son las features que valen la pena. Lo demás puede esperar.