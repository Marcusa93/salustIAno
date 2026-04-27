# Arquitectura, stack y modelo de datos

## Las tres capas

El sistema se piensa en tres capas conceptuales claramente separadas. Esta separación es lo que permite incorporar IA sin contaminar la integridad de los datos cargados por humanos.

### Capa de hechos

Datos crudos cargados por personas: sueño, comidas, pañales, mediciones, fotos, notas, eventos médicos. Son inmutables salvo edición o borrado explícito de un administrador. Toda mutación queda registrada con autor, timestamp y motivo. La IA nunca escribe directamente en esta capa sin validación humana previa.

### Capa de memoria

Composiciones derivadas de los hechos: timeline, biblioteca, álbumes, relatos como "el primer mes de Salu". Es reconstruible a partir de la capa de hechos. Aquí pueden coexistir aportes humanos y aportes de IA, siempre con autoría visible.

### Capa de inteligencia artificial

Agentes que leen las capas anteriores y producen sugerencias, resúmenes, cuentos, alertas suaves y preguntas para el pediatra. Su salida vive en una tabla propia y separada, con referencia al prompt usado, al modelo, a los datos consultados y al momento de generación. La IA propone; los humanos disponen. Siempre se puede saber qué dijo la IA, cuándo y con qué insumos.

## Stack técnico

La selección busca un equilibrio entre productividad de un solo desarrollador, seguridad razonable y posibilidad de evolución.

- **Frontend:** Next.js 15 con App Router, TypeScript, Tailwind, shadcn/ui.
- **Backend y datos:** Supabase, que provee Auth, Postgres con Row Level Security, Storage y Edge Functions.
- **IA:** OpenRouter como capa de abstracción sobre proveedores de modelos. Esta decisión evita atarse a un proveedor específico —Anthropic, OpenAI, Google— y permite mezclar modelos según tarea: chicos y baratos para resúmenes, grandes para creación.
- **Búsqueda semántica futura:** extensión `pgvector` de Postgres activada desde el inicio aunque no se use de inmediato.
- **Tareas en segundo plano:** `pg_cron` y Vercel Cron en una primera etapa, sin sumar infraestructura nueva.
- **Deploy:** Vercel para la web; PWA con instalación en pantalla principal y soporte offline básico para carga rápida sin conexión.

## Modelo de datos

Las entidades se agrupan en seis dominios. Esta organización facilita pensar políticas de seguridad coherentes y evolucionar el esquema sin romper consultas existentes.

| Dominio | Entidades principales |
|---------|----------------------|
| Identidad y familia | `family_groups`, `users`, `family_memberships` con `role` y permisos, `invitations`. |
| Niño | `child_profiles` con campos para edad gestacional al nacer y flag de prematurez; `child_measurements` para peso, talla y perímetro cefálico contra curvas OMS. |
| Eventos de cuidado | Tablas específicas por tipo: `sleep_sessions`, `feeding_events`, `diaper_events`, `mood_logs`. Por encima, una vista o tabla materializada `timeline_events` que actúa como índice unificado. |
| Salud | `health_events`, `medications`, `vaccines` con catálogo del calendario nacional argentino precargado, `medical_appointments`, `allergies`, `medical_documents`. |
| Memoria y biblioteca | `media_items` con storage path —no blobs en la base—, `notes`, `library_items`, `library_consumptions`. |
| Creaciones IA | `generated_stories`, `generated_songs`, `ai_summaries`, `ai_recommendations`. Todas con `prompt_used`, `model`, `inputs_snapshot` y referencia al evento que las originó. |
| Gobernanza | `audit_logs` para toda mutación de datos sensibles, `data_exports`, `consents`. |

## Decisiones de diseño no negociables

Tres decisiones se toman ahora porque su costo es bajo si se incorporan al inicio y muy alto si se retrofittean después.

**Soft delete obligatorio** en toda tabla con datos del niño. Un familiar borrando sin querer la primera ecografía no debe ser un evento terminal. Soft delete temporal de treinta días, después purga real.

**Edad gestacional al nacer** como campo del perfil. Aunque Salustiano nazca a término, sumar dos campos hoy permite que el sistema funcione bien si en el futuro hay un hermano prematuro o si los hitos requieren edad corregida. La edad corregida se calcula como edad cronológica menos las semanas que faltaron para 40.

**Trazabilidad por defecto** en todo evento sensible: autor, timestamp, validado por, validado en. Sin esto, los resúmenes de IA pierden confiabilidad.
