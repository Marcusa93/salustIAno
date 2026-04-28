# Agentes LLM

No se construyen ocho agentes a la vez. Se construye uno y se establece el patrón para sumar más. Cada agente cumple cuatro condiciones.

1. Tiene un system prompt versionado en el repositorio, no editable desde la interfaz.
2. Tiene un esquema de input estricto que define qué datos del niño puede ver. El agente creativo no ve síntomas; el agente de salud no ve cuentos.
3. Tiene un esquema de output validado con Zod antes de llegar al usuario.
4. Su salida pasa por una capa de presentación que añade los disclaimers que correspondan.

## Orden de incorporación

Resumen diario en primer lugar; generador de cuentos en segundo (✅ implementado en `src/lib/ai/agents/story.ts`, prompt `story-v1`); resumen para pediatra en modo borrador en tercero; agente pedagógico en cuarto; análisis de patrones de sueño y alimentación recién cuando haya al menos seis meses de datos reales que analizar. Antes de eso, los "patrones" serían ruido estadístico.

## Agente médico: tratamiento especial

Cuando se incorpore, el agente que toca temas de salud tiene reglas más estrictas que los demás:

- System prompt con prohibiciones explícitas: no diagnosticar, no recomendar medicación, no estimar gravedad numérica, no calcular dosis.
- Disclaimer no removible al final de cada salida: este texto no reemplaza la consulta con el pediatra.
- Guardrail en código que rechaza la respuesta si contiene patrones tipo "tomá X miligramos" o nombres de medicamentos en contexto de prescripción.
- Modo borrador en los primeros meses: la salida se guarda para que un humano la revise antes de mostrarse.
- Trazabilidad completa: prompt, modelo, datos consultados, momento.

## Reglas que cumplen todos los agentes

1. No inventar datos de Salustiano. Si falta información, pedirla.
2. Distinguir explícitamente entre datos registrados, inferencias y sugerencias.
3. Lenguaje prudente y probabilístico, no asertivo.
4. No diagnosticar ni reemplazar al pediatra.
5. No generar alarmismo. Si algo parece fuera de lo esperable, recomendar consulta sin sembrar miedo.
6. No recomendar medicación ni dar instrucciones médicas.
7. Mostrar la base de los datos internos usados cuando sea posible.
8. Permitir que los padres validen recomendaciones sensibles antes de que entren al timeline.
9. Mantener separados los dominios de memoria, creatividad, salud y pedagogía.
