# 0013 — `src/lib/ai/` como única puerta a los LLMs

**Estado:** aceptada
**Fecha:** 2026-04-27

## Contexto

La capa de IA llega al proyecto con riesgos que no tiene el resto del backend: los LLMs producen output no determinístico, los providers cambian (OpenRouter hoy puede ser otro mañana), los costos son por token, y un prompt mal versionado deja outputs irreproducibles. Sumado a eso, `docs/06-privacidad.md` y `docs/04-agentes-llm.md` imponen restricciones específicas: no loguear contenido, validar todo output, aplicar guardrails determinísticos, separar dominios (creatividad vs salud).

Sin una puerta única, esas restricciones se replican mal: una server action puede llamar `fetch` directo a OpenRouter, un componente puede importar la API key, un guardrail puede saltearse "por esta vez". El resultado es un sistema donde la disciplina depende de la memoria del desarrollador.

## Decisión

**Toda interacción con un LLM ocurre exclusivamente a través de `src/lib/ai/agents/*.ts`.** Esa capa expone funciones tipadas (`generateStory`, futuras `generateDailySummary`, etc.) que internamente:

1. Validan el input con un schema Zod estricto.
2. Cargan el system prompt desde `src/lib/ai/prompts/<name>.md`.
3. Llaman a `callLLM` (cliente OpenRouter en `client.ts`).
4. Parsean y validan el output con Zod.
5. Aplican `applyGuardrails`.
6. Persisten metadata en `ai_logs` vía `logStore.record`.
7. Devuelven `AgentResult<T>` con tipos.

Ningún otro módulo importa `callLLM` directamente. El cliente OpenRouter, los guardrails y el logger viven debajo de los agentes y solo se exponen a través de ellos.

## Alternativas consideradas

**Una librería externa tipo Vercel AI SDK o LangChain JS.** Vercel AI SDK es liviana y se integra bien con Next.js, pero introduce una dependencia con su propio modelo mental (helpers de streaming, providers, prompt templates) que se solapa parcialmente con lo que necesitamos. LangChain es over-kill para los casos de uso actuales y trae mucha indirección. Por ahora preferimos código propio chico y transparente; cuando aparezcan necesidades reales (streaming, agentes con tools, RAG), se reevalúa con caso concreto.

**Llamar a OpenRouter directo desde server actions.** Más simple en el corto plazo, pero rompe varias reglas de un solo paso: la API key se acopla a múltiples archivos, los logs quedan inconsistentes, los guardrails se olvidan. Cada llamada nueva sería una oportunidad de saltearse una regla. La centralización paga su costo en la primera regresión que evita.

**Una abstracción "provider-agnóstica" desde el día cero.** Dejar `callLLM` adaptable a cualquier proveedor con una interface genérica. Atractivo en teoría, pero en la práctica la API de OpenRouter ya es un wrapper sobre múltiples providers. Hacer otra capa de abstracción encima es resolver un problema que no tenemos. Si OpenRouter cambia condiciones, swap del cliente; los agentes no cambian.

## Consecuencias

**Positivo.** Una sola superficie para revisar cuando hay que aplicar una regla nueva (ej. agregar disclaimer obligatorio, sumar trazabilidad de un campo). Cada agente es un archivo chico y testeable. La capa de logs queda inevitable: el mismo módulo que llama al LLM también escribe la metadata, sin oportunidad de "olvidarse". Los guardrails, también.

**Negativo.** Hay que disciplinar al equipo (incluido el yo del futuro): la tentación de hacer un `fetch` rápido a OpenRouter desde una server action va a aparecer. Mitigación: una regla en `AGENTS.md` y revisión cada vez que aparezca un agente nuevo. La indirección agrega un archivo más por agente — costo aceptable en escala.

**Señales que harían reconsiderar.** Que el patrón empiece a duplicar boilerplate en cada agente nuevo (señal de que falta una factory más alta); que aparezca una librería madura que cubra estos casos sin lock-in (señal de evaluar migrar); que el caso de streaming o tools requiera reestructurar la interface de `AgentResult` de forma incompatible.
