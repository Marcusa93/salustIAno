# Architecture Decision Records (ADRs)

Esta carpeta contiene los registros de decisiones arquitectónicas significativas del proyecto. Un ADR es un archivo corto que documenta una decisión técnica importante: el contexto en que se tomó, las alternativas consideradas, la decisión y sus consecuencias.

## Por qué

Cuando dentro de seis meses aparezca la pregunta "¿por qué OpenRouter y no llamar a Anthropic directo?", el ADR está acá. Es disciplina barata con retorno alto: evita rediscutir lo ya decidido y permite revisitar decisiones cuando el contexto cambió.

## Convención de nombres

`NNNN-titulo-corto.md`, donde `NNNN` es un número de cuatro dígitos secuencial (`0001`, `0002`...). El número no se reutiliza nunca, incluso si la decisión se rechaza o reemplaza.

## Formato

Cada ADR usa el template en [`0000-template.md`](0000-template.md). Las secciones son fijas:

- **Estado:** propuesta, aceptada, rechazada, reemplazada por NNNN.
- **Contexto:** qué problema o pregunta motivó la decisión.
- **Decisión:** qué se decidió, en una o dos oraciones.
- **Alternativas consideradas:** qué se evaluó y por qué se descartó.
- **Consecuencias:** qué implica esta decisión, positivo y negativo.

## Cuándo escribir un ADR

Cualquier decisión que cumpla al menos una de estas condiciones:

- Cambia o establece la arquitectura del sistema.
- Compromete al proyecto con un proveedor o tecnología.
- Su reversión costaría más de un día de trabajo.
- Es probable que alguien (incluido el yo del futuro) la cuestione.

No hace falta ADR para decisiones de implementación rutinaria, naming de variables o estilos de código.
