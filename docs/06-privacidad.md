# Privacidad y seguridad

La privacidad de los datos de un menor es central por diseño, no una capa agregada al final.

## Principios

- Acceso privado mediante autenticación por familia.
- Roles y permisos diferenciados, anclados en políticas de Row Level Security de Postgres.
- No exposición pública de datos. La app no tiene función de compartir externamente.
- No envío de información sensible a servicios externos sin control. OpenRouter y proveedores de modelos: revisar términos para que no entrenen con los datos enviados.
- Registro de auditoría de mutaciones sensibles.
- Separación lógica entre datos médicos, recuerdos familiares y contenido creativo.
- Posibilidad de exportar todo en cualquier momento.
- Posibilidad de eliminar todo en cualquier momento.

## Decisiones técnicas concretas

**Buckets de Storage privados** con signed URLs de expiración corta. Nunca paths públicos.

**EXIF sanitizado al subir** fotos: la geolocalización se elimina por defecto.

**Cifrado en reposo** provisto por Supabase. Cifrado a nivel de aplicación, con clave por familia, queda como capa opcional para campos especialmente sensibles —diagnósticos, medicación—. No se persigue cifrado de extremo a extremo de toda la base, porque sería incompatible con el procesamiento por IA y no es proporcional al riesgo de uso familiar privado.

**Auditoría automática de RLS** antes de cada deploy: tests que intentan leer datos cruzados entre familias y deben fallar. Si alguno pasa, no hay deploy.

**Backup nocturno automático** a una cuenta familiar de Google Drive, además del backup del proveedor.

**Botón de exportación total**: ZIP con JSON estructurado más carpeta de medios. Este botón no es un feature, es contrato moral con la familia. Funciona desde el día uno o no hay deploy.

**Botón de borrado total** desde el inicio. Borrado real, no "marca como eliminado en la pantalla". Soft delete temporal de treinta días para evitar accidentes, después purga real con eliminación física.

**Opt-out de entrenamiento** documentado en cada proveedor de IA. Texto donde figura el contrato y la cláusula. Esto es revisable y exhibible.

**Auditoría de accesos**: cada acceso a datos sensibles queda registrado. Si Salustiano pide saber quién vio qué cuando tenga doce años, la app puede contestar.

## Política familiar

Cada usuario que entra al grupo —padre, madre, abuelos, tíos— acepta condiciones explícitas al unirse. No publicar capturas, no extraer fotos para difundir en redes externas, no usar la app para vigilar a otros familiares. El consentimiento informado al unirse al sistema es un acto significativo, no un checkbox. Conviene tener el texto escrito antes del primer alta.
