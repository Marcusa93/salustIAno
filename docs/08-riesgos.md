# Riesgos

## Médicos

Alucinación del LLM dando consejo peligroso es el riesgo más serio. Mitigación: ningún output del agente médico se muestra sin validación humana hasta que existan cientos de salidas revisadas con confianza estadística en el comportamiento. Hasta entonces, modo borrador permanente. La app no calcula dosis de medicamentos bajo ninguna circunstancia.

## Legales

En uso familiar privado el riesgo es bajo. Las precauciones razonables: registrar consentimiento explícito de cada familiar al unirse; no incorporar terceros profesionales sin contrato; no usar los datos para entrenar modelos de terceros; tener política de retención y borrado clara.

## Privacidad

Fotos de un menor en infraestructura de terceros. RLS mal configurada es la falla más probable y más grave. Tests automatizados que intentan leer datos cruzados entre familias deben correr antes de cada deploy. Sanitización de EXIF al subir fotos. Signed URLs con expiración.

## Técnicos

Costos de LLM: usar modelos chicos como Haiku o GPT-4o-mini para resúmenes, modelos grandes solo para creación. Cachear resúmenes diarios. Bloqueo de proveedor: por eso OpenRouter como capa de abstracción.

## Producto

Fricción de carga mata baby trackers. Si la madre no carga eventos en las primeras dos semanas, hay que rediseñar el flujo, no agregar features.

## Pérdida de memoria

Si la app se rompe o se decide dejarla, la familia pierde años de datos. Por eso exportación total y backup nocturno externo son requisitos del MVP, no de fases tardías.

## Plan de respuesta a incidentes

Tener un plan no significa esperar el incidente; significa tomarse en serio el riesgo. Los componentes mínimos:

- Quién recibe alerta si hay actividad sospechosa.
- Cómo se rotan credenciales (Supabase, OpenRouter, dominio).
- Cómo se notifica a la familia.
- Backup más reciente verificado y accesible.
- Procedimiento de purga total si fuera necesario.

Este plan vive en un documento privado fuera del repositorio, accesible solo por los administradores.
