# Salu

Sistema operativo familiar para acompañar la crianza de Salustiano.

Salu es una webapp privada y familiar pensada para ordenar el cuidado, la salud, la memoria y la creatividad alrededor de un bebé. No es un baby tracker más ni una app pública: es un sistema cerrado, accesible solo por la familia, que combina bitácora de cuidado, archivo de recuerdos y plataforma creativa, con asistencia de inteligencia artificial.

El principio rector que ordena todas las decisiones de producto es que Salustiano será cuidado por personas, con asistencia de algoritmos. La IA no decide, no diagnostica y no reemplaza criterio humano: organiza datos, resume información, sugiere actividades, detecta patrones y genera contenidos creativos. Las decisiones sensibles quedan siempre en manos de los humanos responsables.

## Estado

En diseño. Todavía no hay código. La carpeta `docs/` contiene la especificación funcional y arquitectónica completa; la carpeta `decisions/` contiene los registros de decisiones técnicas (ADRs).

## Documentación

La documentación está pensada para leerse en orden, aunque cada archivo se sostiene solo:

- [`docs/00-vision.md`](docs/00-vision.md) — Visión, principio rector, marco legal aplicable.
- [`docs/01-arquitectura.md`](docs/01-arquitectura.md) — Las tres capas, stack técnico, modelo de datos.
- [`docs/02-pantallas-ux.md`](docs/02-pantallas-ux.md) — Pantallas iniciales y patrones de experiencia.
- [`docs/03-roles-permisos.md`](docs/03-roles-permisos.md) — Roles, permisos y RLS.
- [`docs/04-agentes-llm.md`](docs/04-agentes-llm.md) — Agentes de IA, reglas, orden de incorporación.
- [`docs/05-seguridad-medica.md`](docs/05-seguridad-medica.md) — Reglas duras de seguridad médica y pedagógica.
- [`docs/06-privacidad.md`](docs/06-privacidad.md) — Privacidad y seguridad técnica.
- [`docs/07-mvp-y-fases.md`](docs/07-mvp-y-fases.md) — MVP y plan por fases ancladas a hitos del bebé.
- [`docs/08-riesgos.md`](docs/08-riesgos.md) — Riesgos identificados y mitigaciones.
- [`docs/09-descartado.md`](docs/09-descartado.md) — Decisiones explícitamente descartadas y por qué.
- [`docs/10-decisiones-abiertas.md`](docs/10-decisiones-abiertas.md) — Decisiones a cerrar antes del primer commit de código.
- [`docs/11-defensa-y-etica.md`](docs/11-defensa-y-etica.md) — Marco ético y defensa argumental del proyecto.

## Decisiones técnicas

Las decisiones arquitectónicas significativas se documentan como ADRs en [`decisions/`](decisions/). Ver el README de esa carpeta para el formato.

## Privacidad

Este repositorio contiene especificación técnica del proyecto, no datos personales del menor. Los datos de Salustiano viven en infraestructura privada controlada por la familia, fuera de este repositorio. Ver [`docs/06-privacidad.md`](docs/06-privacidad.md) y [`docs/11-defensa-y-etica.md`](docs/11-defensa-y-etica.md) para el detalle.

## Licencia

Privado. Uso familiar exclusivo. Sin licencia abierta hasta nuevo aviso.
