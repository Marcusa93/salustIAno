# 0001 — Stack base: Next.js, Supabase, OpenRouter

**Estado:** aceptada
**Fecha:** 2026-04-27

## Contexto

El proyecto necesita un stack que permita a un solo desarrollador, con trabajo paralelo, llegar a un MVP funcional antes del nacimiento de Salustiano. Las restricciones son: privacidad estricta de los datos de un menor, posibilidad de incorporar IA sin atarse a un proveedor único, costos bajos en escala familiar, y curva de mantenimiento manejable durante años.

## Decisión

El stack base es **Next.js 15 con App Router** en TypeScript para frontend y rutas, **Supabase** para autenticación, base de datos Postgres con Row Level Security y almacenamiento, y **OpenRouter** como capa de abstracción sobre proveedores de modelos de IA.

## Alternativas consideradas

**Backend custom con Express o Fastify y Postgres autoadministrado.** Daría más control pero suma mantenimiento de auth, RLS manual, backup y storage. No se justifica en escala familiar.

**Firebase como alternativa a Supabase.** Vendor lock-in mayor, peor experiencia con queries relacionales, costos menos predecibles. Postgres con RLS gana en transparencia y portabilidad de datos.

**Llamar directo a la API de Anthropic o de OpenAI.** Más simple en el corto plazo, pero cada cambio de proveedor requeriría reescribir la integración. OpenRouter cobra una comisión chica a cambio de una sola interfaz para múltiples modelos, lo que permite usar modelos baratos para resúmenes y caros solo para creación.

**Supabase self-hosted.** Posible en el futuro si los costos lo justifican o si aparecen requerimientos de soberanía de datos más estrictos. No para el MVP.

## Consecuencias

**Positivo.** Productividad alta de un solo desarrollador. RLS de Postgres como única capa de control de acceso, en lugar de duplicar reglas en código. PWA con Next.js es trivial. Facturación en cero o cerca de cero hasta una escala que esta app nunca va a alcanzar.

**Negativo.** Tres dependencias de proveedores externos: Vercel, Supabase, OpenRouter. Si cualquiera cambia condiciones de forma adversa, hay que migrar. Mitigación: el botón de exportación total y los backups nocturnos a Google Drive aseguran que los datos puedan moverse a cualquier infra estándar Postgres + S3 sin pérdida.

**Señales que harían reconsiderar.** Cambios en términos de servicio de OpenRouter respecto a entrenamiento con datos del usuario; aumentos significativos de precio en Supabase que no estén justificados por uso real; aparición de un proveedor con privacidad estructuralmente mejor.
