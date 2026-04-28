# Salu

Sistema operativo familiar para acompañar la crianza de Salustiano.

Salu es una webapp privada y familiar pensada para ordenar el cuidado, la salud, la memoria y la creatividad alrededor de un bebé. No es un baby tracker más ni una app pública: es un sistema cerrado, accesible solo por la familia, que combina bitácora de cuidado, archivo de recuerdos y plataforma creativa, con asistencia de inteligencia artificial.

El principio rector es que Salustiano será cuidado por personas, con asistencia de algoritmos. La IA no decide, no diagnostica y no reemplaza criterio humano: organiza, resume, sugiere, detecta patrones y genera contenidos creativos.

## Estado

Paso 1 — scaffolding técnico. La app levanta y muestra una página inicial con sistema de diseño aplicado, modo oscuro y accesibilidad. Sin Supabase, sin auth, sin eventos: eso viene en los próximos pasos.

## Stack

- **Next.js 16.2** con App Router, Turbopack y React Compiler.
- **React 19**.
- **TypeScript 5** con strict mode completo.
- **Tailwind CSS v4.2** con configuración CSS-first.
- **Biome** para lint y format unificado.
- **Vitest** para tests.
- **pnpm** como package manager.
- **Node 22** LTS.

Detalle y justificaciones en [`decisions/0002-stack-moderno.md`](decisions/0002-stack-moderno.md).

## Setup

Requisitos: Node 22+ y pnpm 9+. Si usás `nvm`, `nvm use` toma la versión del `.nvmrc`.

```bash
# Instalar dependencias
pnpm install

# Levantar dev server
pnpm dev

# Abre http://localhost:3000
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Servidor de desarrollo con Turbopack y hot reload. |
| `pnpm build` | Build de producción. |
| `pnpm start` | Servir build de producción. |
| `pnpm typecheck` | Validar tipos sin emitir. |
| `pnpm lint` | Lint y format check con Biome. |
| `pnpm lint:fix` | Aplicar fixes automáticos. |
| `pnpm test` | Correr tests con Vitest. |
| `pnpm test:watch` | Tests en modo watch. |

## Estructura del proyecto

```
salustIAno/
├── docs/                    # Especificación funcional y arquitectónica
├── decisions/               # Architecture Decision Records (ADRs)
├── src/
│   ├── app/                 # App Router de Next.js
│   ├── components/
│   │   ├── ui/              # Componentes shadcn/ui (paso 4)
│   │   └── salu/            # Componentes propios del dominio
│   ├── lib/
│   │   ├── supabase/        # Cliente Supabase (paso 2)
│   │   ├── ai/              # Capa de IA (paso 6)
│   │   └── validators/      # Schemas Zod
│   └── types/
├── supabase/
│   └── migrations/          # Migraciones SQL versionadas (paso 2)
└── tests/                   # Tests e2e con Playwright (paso 5+)
```

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
- [`docs/10-decisiones-abiertas.md`](docs/10-decisiones-abiertas.md) — Decisiones que aún quedan por cerrar.
- [`docs/11-defensa-y-etica.md`](docs/11-defensa-y-etica.md) — Marco ético y defensa argumental del proyecto.

## Decisiones técnicas

Las decisiones arquitectónicas significativas se documentan como ADRs en [`decisions/`](decisions/).

## Privacidad

Este repositorio contiene especificación técnica y código del proyecto, no datos personales del menor. Los datos de Salustiano viven en infraestructura privada controlada por la familia, fuera de este repositorio. Ver [`docs/06-privacidad.md`](docs/06-privacidad.md) y [`docs/11-defensa-y-etica.md`](docs/11-defensa-y-etica.md) para el detalle.

## Licencia

Privado. Uso familiar exclusivo. Sin licencia abierta hasta nuevo aviso.
