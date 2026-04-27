# Defensa, ética y comunicación del proyecto

Este documento existe porque el proyecto va a recibir críticas y conviene tener pensada la respuesta antes de tener que improvisarla. La crítica que va a llegar tiene varias caras: algunas vienen de mala fe y se desarman fácil, otras son preocupaciones legítimas que merecen una respuesta honesta. La mejor defensa no es retórica: es construir un producto que efectivamente respete a Salustiano más que las alternativas que la mayoría usa, y poder demostrarlo.

## El error de fondo en la crítica más común

La palabra que más se va a escuchar es "exponés". Es la palabra equivocada. Exponer es hacer público. Esta app no expone nada. Está cifrada, autenticada, con políticas de acceso fila por fila, sin función de compartir hacia afuera, alojada en infraestructura privada. Si alguien dice que "exponés" datos del niño en un sistema privado, está usando un marco mental que no aplica.

El concepto académico que sí aplica al fenómeno real de exponer datos de menores se llama **sharenting** (de *sharing parenting*) y se refiere específicamente a publicar información, fotos y videos de hijos en redes sociales públicas. Las críticas válidas del sharenting apuntan a Instagram, TikTok, WhatsApp con grupos enormes, blogs públicos, no a un sistema cerrado. Esa distinción es la primera línea de defensa.

## Las cinco críticas que van a aparecer

### "Le estás generando huella digital antes de que pueda consentir"

Es la crítica más sofisticada y la que merece más respeto. La respuesta corta: la huella digital pública nace de la publicación, no del registro. El niño va a tener huella digital cualquiera sea la decisión de los padres, porque la pediatra carga su historia clínica, la escuela su legajo, la obra social sus prácticas, los abuelos sus fotos en sus teléfonos. La pregunta real no es "¿registramos o no?" sino "¿quién controla ese registro?". Una app familiar privada con borrado y exportación garantizados le devuelve control sobre su propia narrativa cuando crezca, exactamente lo opuesto a fotos en Instagram que ya no pueden retirarse.

### "Lo estás criando con algoritmos"

Mezcla dos cosas. La IA en este sistema no toca al bebé: ayuda a los cuidadores adultos a recordar mejor, organizar mejor, preparar consultas pediátricas y crear contenidos. Salustiano no interactúa con un chatbot ni recibe recomendaciones algorítmicas dirigidas a él. La distinción está construida en el producto: el bebé es sujeto del cuidado, no usuario del software. Eso es defendible y es cierto.

### "Los datos van a estar en servidores de terceros"

Es preocupación legítima y técnica. La respuesta correcta no es minimizarla, es responderla con concreciones. Supabase aloja los datos cifrados en reposo; las políticas de Row Level Security garantizan aislamiento entre familias; el Storage usa URLs firmadas con expiración corta; el procesamiento de IA pasa por OpenRouter con configuración de no-entrenamiento; los términos comerciales se revisan y se documentan. Esa es la respuesta. Comparado con el escenario más común —fotos en Google Photos compartidas con familiares en cadenas de WhatsApp— el sistema propuesto tiene controles más estrictos, no más laxos.

### "Tu hijo no consintió"

Es el argumento que más suena pero el más débil legalmente. La autoridad parental es la institución que ordena el cuidado de los hijos en todo el derecho occidental, y Argentina no es excepción. La Ley 26.061 establece el principio de interés superior del niño, no un veto de los hijos sobre las decisiones de los padres. Los padres deciden por sus hijos en todos los planos —médico, educativo, alimentario, religioso, recreativo— hasta que crecen para decidir por sí mismos. Lo que sí se puede exigir y este proyecto puede cumplir: que cuando Salustiano tenga edad para opinar, sus opiniones se incorporen progresivamente; que cuando alcance autonomía, reciba el control completo de sus datos; que mientras tanto, se actúe en su mejor interés. Eso es lo que pide la Convención sobre los Derechos del Niño y lo que pide la Observación General 25 del Comité que la interpreta.

### "¿Y si te hackean?"

Es una pregunta sensata que merece respuesta concreta, no defensiva. La política técnica de seguridad ya está descrita en el documento de privacidad. Conviene tener pensada también la respuesta operativa: si hay incidente, qué se hace, cómo se notifica a la familia, cómo se rotan credenciales. Tener un plan no significa que el incidente vaya a ocurrir; significa que se está tomando en serio el riesgo.

## Los cuatro principios que sostienen la defensa

Antes de discutir caso por caso, conviene tener claros los principios. La crítica desorganizada se desarma con principios articulados.

**Privado por construcción, no por declaración.** No alcanza con decir "es privado". El sistema tiene que serlo en su arquitectura, sin función de publicación, sin compartir externo, sin links públicos. Lo que no existe en el código no se puede romper.

**Control parental con horizonte de transferencia.** La administración hoy es de los padres porque el bebé no puede ejercerla. Pero el diseño contempla, desde ahora, el momento futuro en que ese control se transfiere a Salustiano. Hay un calendario implícito: a los 13 años puede acceder con sus credenciales propias y opinar sobre publicaciones; a los 16 puede pedir borrados; al alcanzar mayoría plena, control completo. Esto no es un feature urgente, es un compromiso que conviene poner por escrito.

**Proporcionalidad entre riesgo y beneficio.** Cualquier registro de información tiene riesgo. Pero el riesgo cero significa renunciar a beneficios reales: detectar patrones de salud, preparar consultas pediátricas, conservar memoria familiar, generar contenidos personalizados. La pregunta correcta es si los controles aplicados son proporcionales al riesgo y al beneficio. Los controles que el documento de privacidad describe lo son.

**Datos para el niño, no datos del niño.** Los datos no se capturan para vigilar a Salustiano sino para que la familia lo cuide mejor y para construirle una memoria. El destinatario final es él. Esta distinción es central y es honesta: el día que pida ver "todo lo que la familia recuerda de mí", la app debe poder entregárselo en un ZIP.

## Decisiones de producto que dan músculo a la defensa

Los argumentos no valen nada si las decisiones técnicas no los respaldan. Los compromisos verificables del proyecto:

- **No publicación externa.** No hay función de compartir, no hay enlaces públicos, no hay export hacia redes sociales. Si en algún momento se quiere mostrar una foto a alguien fuera del grupo familiar, se hace fuera de la app.
- **Botón de exportación total** funcionando desde el primer día. Si se rompe, falla el deploy.
- **Botón de borrado total** desde el inicio. Borrado real, con purga física después del soft delete temporal.
- **Opt-out de entrenamiento** documentado en cada proveedor de IA. Texto donde figura el contrato y la cláusula.
- **Sanitización de EXIF** en fotos: la geolocalización se elimina por defecto al subir.
- **Política de retención** escrita: qué se guarda cuánto tiempo, qué se purga automáticamente.
- **Auditoría completa**: cada acceso a datos sensibles queda registrado.
- **Plan de transferencia de control** con calendario por edades del niño.
- **Política familiar firmada** por cada usuario al unirse al grupo.

## Cómo comunicar el proyecto en público

Tres marcos posibles, con efectos distintos:

**Marco de memoria familiar.** "Armé una libreta digital privada para que la familia recuerde mejor a Salu". Es el más invisible y el menos atacable. Subraya lo que el proyecto comparte con un álbum, un cuaderno, una caja de zapatos con fotos. Quien quiera atacar eso parece estar atacando los álbumes familiares en general.

**Marco técnico-profesional.** "Estoy desarrollando un sistema con privacidad por diseño y controles que la mayoría de las apps comerciales no tienen". Funciona bien con audiencias técnicas, mal con familias intuitivas.

**Marco honesto-completo.** "Es una app privada, cifrada, sin compartir externo, donde la familia carga datos del bebé y la IA ayuda a organizarlos. No publica nada. Salu va a tener control completo cuando crezca". Tiene la ventaja de la honestidad y el costo de la longitud.

Recomendación: empezar por el primer marco en conversaciones casuales, y reservar los otros dos para quien efectivamente plantee objeciones. No salir a explicar arquitectura a quien preguntó por curiosidad: pone a la defensiva sin razón.

## La línea roja

Hay un escenario donde la crítica sería justa y conviene no cruzarlo nunca. Si en algún momento aparece la tentación, por nostalgia, marketing del proyecto, evangelización de la idea, o cualquier otro motivo, **publicar contenido generado por la app** —un cuento generado para Salu, una foto, un resumen de IA— en una red social, en un blog, en un newsletter, ahí sí se estaría exponiendo. Ahí los críticos tendrían razón.

La regla más fácil: lo que pasa en la app se queda en la app. Si se va a hablar del proyecto en público, se habla del sistema en abstracto, no se exhibe contenido del niño. Esa autodisciplina hace toda la diferencia entre lo que este proyecto es y un canal familiar de TikTok.
