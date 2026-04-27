# Decisiones explícitamente descartadas

Esta sección existe para que más adelante, si alguien sugiere reincorporar estas ideas, haya un registro de por qué se descartaron.

## Cálculo automático de dosis de medicamentos

Aunque algunas apps lo ofrecen y aunque se base en peso, el riesgo médico-legal es serio. Errores en el peso registrado, condiciones que alteran el metabolismo, interacción con otros medicamentos: el cálculo "correcto" puede ser tóxico. La app registra dosis indicadas por el pediatra, no las calcula ni las sugiere.

## Alertas médicas automatizadas disparadas por IA

Los signos de alarma se muestran como contenido educativo visible, no como alertas que el sistema dispara solo. La diferencia es que el contenido fijo no falla; un clasificador automático sí, y los falsos negativos en este dominio son peligrosos.

## Cifrado de extremo a extremo de toda la base

Es incompatible con varias features deseadas: si la IA tiene que procesar datos para generar resúmenes, alguien tiene que descifrarlos. E2EE real implica gestión de claves del lado del cliente, sin recuperación si se pierden. Para uso familiar privado lo proporcional es cifrado en reposo, RLS estricta, signed URLs y cifrado opcional a nivel de aplicación para campos especialmente sensibles.

## Verificación parental con identificación oficial o tarjeta de crédito

Es solución para problemas que esta app no tiene. Está diseñada para servicios donde un menor podría hacerse pasar por adulto. Acá el administrador es conocido y no hay terceros. Sumar fricción de identidad estatal es overengineering.

## Hardware dedicado de carga

Botones físicos para registrar eventos sin sacar el teléfono son una idea simpática pero agregan dependencias y costos que no se justifican. Si la fricción de carga es problema, la solución son widgets, accesos directos y posiblemente carga por lenguaje natural en el futuro, no hardware.

## Marcos legales extranjeros como base

COPPA y GDPR-K aparecen citados con frecuencia en propuestas de IA pero no rigen este caso. El marco aplicable es el argentino. Los principios de minimización, consentimiento y derechos del titular se cumplen igual; solo cambia la norma de referencia.

## Función de compartir externamente

La app no tiene ni va a tener función de compartir hacia afuera. No hay enlace público de fotos, no hay export hacia redes sociales, no hay "share" nativo a WhatsApp. Si en algún momento se quiere mostrar una foto a alguien fuera del grupo familiar, se hace fuera de la app, con el medio que esa persona elija, y bajo su responsabilidad consciente. Esta regla protege la integridad del sistema cerrado y es central a la defensa ética del proyecto.
