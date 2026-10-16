# 0014 — Cartas: el código en el repo, el contenido en Storage privado

**Estado:** aceptada
**Fecha:** 2026-10-16

## Contexto

Queremos poder regalar "cartas" interactivas dentro de la app (la primera: la carta de Salu a mamá por el Día de la Madre 2026). Una carta es muy íntima: textos personales, fotos familiares con fechas, el video del nacimiento y canciones.

El repositorio en GitHub es **público**. Todo lo que se commitea (incluido `public/`) queda a la vista de cualquiera, y además los archivos de `public/` se sirven sin autenticación.

## Decisión

El repo tiene solo el **motor** de la carta (`src/app/carta/[slug]`, `src/lib/carta`). El **contenido** (un `manifest.json` validado con Zod, más fotos, video y canciones) vive en el bucket **privado** `cartas` de Supabase Storage, bajo `<slug>/`.

`loadLetter(slug)` lee el manifest con el cliente admin, pero **la autorización la decide RLS**: si la persona logueada puede ver el `child_profiles` del manifest, es de la familia y puede leer la carta. Recién entonces se firman URLs de 12 horas para cada archivo.

El contenido se sube con `scripts/carta/upload-letter.mjs`, desde una carpeta local que nunca entra al repo.

## Alternativas consideradas

- **Fotos en `public/` y textos en el código.** Era lo más simple, pero publica las fotos de un bebé en un repo público y las deja servidas sin login. Descartado.
- **Policies de Storage por familia** (`storage.objects` filtrado por `family_memberships`). Es la opción más "RLS pura", pero exige una migración y una convención de paths por familia, para un contenido que hoy sube una sola persona a mano. Puede volver si las cartas se crean desde la UI.
- **Una tabla `letters` en Postgres.** Agrega esquema y migraciones para algo que por ahora es un documento estático. Lo dejamos para cuando haya cartas creadas desde la app.

## Consecuencias

- Una carta nueva no requiere deploy: se arma la carpeta, se corre el script y listo. Sí hace falta deploy para cambiar el motor o la ventana en la que aparece en el inicio (`src/lib/carta/letter-window.ts`).
- El manifest se valida al cargar: si tiene un error, la página da 404 en vez de mostrar algo roto. Conviene probar en local antes de subirlo.
- Las URLs firmadas vencen a las 12 horas. Recargar la página genera URLs nuevas.
- El audio pasa por Web Audio para poder hacer fundidos en iOS. Por eso el bucket tiene que responder con CORS (Supabase Storage responde `Access-Control-Allow-Origin: *`).
