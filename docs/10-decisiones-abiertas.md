# Decisiones a cerrar antes del primer commit de código

Tres decisiones de producto que conviene resolver antes de empezar a programar, porque cambiarlas después tiene costo.

## Idioma del producto

Solo español, o español más alguna otra lengua para algún familiar. Si es solo español, ahorra abstracciones de internacionalización innecesarias. Si en algún momento entra otra lengua, la decisión de arquitectura cambia: claves de traducción, estructura de prompts, formato de fechas y números.

**Recomendación tentativa:** solo español argentino para empezar. Reabrir si aparece la necesidad real.

## Identidad gráfica

Paleta, tipografía, tono. Define si es app cálida y orgánica, minimalista clínica, lúdica infantil. Cada opción mueve decisiones de UX. Vale la pena un día de exploración visual antes de elegir componentes.

**Pendiente:** sesión de exploración visual.

## Política de fotos

Quién puede subir, quién puede ver, qué expira, qué se exporta automáticamente al backup familiar. Esto define varias políticas de RLS que se programan una vez.

Preguntas a resolver:

- ¿Pueden los abuelos subir fotos o solo los administradores?
- ¿Las fotos cargadas por familia requieren validación antes de aparecer en timeline?
- ¿Hay fotos privadas para administradores y fotos compartidas para todo el grupo?
- ¿Las fotos médicas (ronchas, lesiones, etc.) van a un módulo aparte?

**Recomendación tentativa:** todos los miembros pueden subir; las fotos médicas viven en el módulo de salud con permisos más restrictivos; sin validación previa para fotos comunes, sí para las que entran al timeline público.
