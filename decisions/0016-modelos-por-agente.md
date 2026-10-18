# 0016 — Modelo por agente y pipeline común de agentes estructurados

**Estado:** propuesta
**Fecha:** 2026-10-16

## Contexto

Cada agente tenía su slug de modelo hardcodeado (Haiku 4.5 en casi todos, Opus 4.7 en cuentos y canciones) y repetía el mismo pipeline: llamar, extraer JSON, validar con Zod, loguear. En esa repetición se fueron perdiendo reglas de `AGENTS.md`: seis de nueve agentes no aplicaban `applyGuardrails`, y en los errores de parseo se guardaban 240 caracteres de la respuesta del modelo en `ai_logs.error`.

La familia Claude 5.5 cambia el contrato con el proveedor: Sonnet 5.5 y Haiku 5.5 rechazan `temperature`, razonan por defecto (Sonnet siempre) y ese razonamiento consume el mismo `max_tokens` que la respuesta. Topes de 350-600 tokens dejan respuestas vacías con `finish_reason: length`. En los loops con tools, OpenRouter pide reenviar `reasoning_details` junto a los tool calls.

`OPENROUTER_DEFAULT_MODEL` estaba en el schema de env y fijada en Vercel en `anthropic/claude-haiku-4-5`, pero ningún agente la leía.

## Decisión

Cada agente pide su perfil (modelo, esfuerzo de razonamiento, tope de tokens) a `src/lib/ai/models.ts`: Haiku 5.5 para tareas cortas o frecuentes y para Alexa, Sonnet 5.5 para lo que razona, escribe o mira fotos de pañales. Los agentes que devuelven JSON pasan por `runStructuredAgent`, que aplica siempre Zod, guardrails y log sin contenido. `OPENROUTER_DEFAULT_MODEL` se elimina.

## Alternativas consideradas

**Usar `OPENROUTER_DEFAULT_MODEL` como override global.** Permitiría cambiar de modelo sin deploy de código, pero con el valor que hoy tiene Vercel bajaría todos los agentes, cuentos incluidos, a Haiku 4.5. Además mezcla modelos con distintos parámetros (temperature, razonamiento obligatorio) bajo un mismo switch. Descartada: los perfiles quedan en código, versionados y testeados.

**Opus 5.5 para cuentos y canciones.** Es lo más capaz, pero cuesta el doble que Sonnet 5.5 y tarda más. Para textos de 150-1500 palabras con un prompt detallado, Sonnet alcanza. Se puede revisar si la familia nota diferencia.

**Haiku 5.5 en todos los agentes.** Es 20 veces más barato que Sonnet 5.5, pero el chat con tools, el coach de sueño y el análisis de pañales son justo donde un error de razonamiento o de visión le pesa a la familia.

**Structured outputs (`json_schema`) en lugar de `json_object`.** Eliminaría los parseos fallidos y los prompts que gritan "UN SOLO objeto JSON", pero Anthropic no acepta todas las restricciones de Zod (largos máximos, por ejemplo) y no se pudo probar en vivo. Queda para un paso siguiente con la key cargada.

## Consecuencias

**Positivo.** Cambiar el modelo de un agente es tocar una línea y un test. Las reglas de guardrails y de logs sin contenido dejan de depender de que cada agente las copie bien. Prompt caching en el chat: tools + prompt estático se cachean entre iteraciones.

**Negativo.** El chat de la app pasa de Haiku 4.5 (US$1/US$5 por millón) a Sonnet 5.5 (US$2/US$10) con razonamiento; Haiku 5.5 en las tareas chicas baja el costo 10 veces. Los agentes con esfuerzo medio pueden tardar más que antes: el timeout del cliente sube de 60 s a 90 s.

**Señales que harían reconsiderar.** Latencias del chat por encima de lo tolerable en `ai_logs.latency_ms`; muchos `parse failed ... finish=length` (topes cortos); que OpenRouter cambie cómo mapea `reasoning.effort` en Claude.
