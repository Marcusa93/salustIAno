# 0016 — PWA: caché solo de lo estático, página offline y push pensado para iPhone

**Estado:** aceptada
**Fecha:** 2026-10-16

## Contexto

Marco pidió que Salu sea "una app de verdad en el celu": que se instale, que abra aunque no haya señal y que los avisos lleguen, sobre todo en iPhone. Hasta ahora el service worker solo manejaba push y se registraba recién al entrar a /perfil, así que la caché nunca arrancaba. Y la tabla `push_subscriptions` estaba vacía: nadie había logrado activar los avisos.

La tensión es que casi todo en Salu es privado. El HTML de cada página trae datos de Salustiano y de la familia, y depende de la sesión. Cachearlo en el celu es guardar datos sensibles fuera de RLS, con riesgo de mostrarle a una persona lo que vio otra en el mismo navegador.

## Decisión

El service worker (`public/sw.js`, escrito a mano) cachea **solo lo estático**: los chunks de `_next/static` (cache-first, llevan hash), íconos y manifest (stale-while-revalidate). Las navegaciones van siempre a la red y, si falla, se muestra `/offline`, una página estática y pública que el SW guarda sin cookies al instalarse y refresca una vez por día. No se cachean HTML, payloads RSC, `/api/*`, Server Actions, `/_next/image` ni nada de otro origen (Supabase).

Para push en iPhone: la tarjeta de /perfil detecta si falta instalar la app (iOS 16.4+ solo da push a PWAs instaladas), si el permiso está bloqueado o si la suscripción se hizo con claves VAPID viejas, y ofrece "Mandarme una de prueba" que le pega solo a ese dispositivo. El SW siempre muestra una notificación por cada push, porque Safari revoca la suscripción si no.

## Alternativas consideradas

- **Serwist / next-pwa / Workbox.** Resuelven el precache con un manifest generado en el build, pero suman una dependencia y un paso de build para algo que hoy son tres estrategias simples. Si algún día queremos precache de rutas o background sync, vale la pena revisarlo.
- **Cachear las páginas visitadas (network-first con caché).** Daría "ver lo último sin señal", pero guarda HTML autenticado en el celu y obliga a pensar cómo invalidarlo al cerrar sesión. Descartado por privacidad.
- **Cola offline para anotar tomas, sueños y pañales sin señal.** Es lo que más serviría de noche sin conexión, pero necesita IndexedDB, reintentos y resolver conflictos con lo que cargó otra persona. Queda para una iteración aparte.
- **Upsert de la suscripción.** `push_subscriptions` no tiene policy de UPDATE, y `INSERT ... ON CONFLICT DO UPDATE` choca con RLS cuando el endpoint ya existe (lo probamos en Postgres local). En vez de sumar una migración, la Server Action borra la fila propia e inserta de nuevo.

## Consecuencias

- Sin señal, Salu abre y muestra un mensaje claro en vez del error del navegador, pero no muestra datos. Para ver o cargar algo hace falta conexión.
- `sw.js` se sirve con `no-cache`. Si cambia la estrategia de caché, hay que subir `SW_VERSION` para que se borren los cachés viejos.
- En desarrollo el SW se registra como `/sw.js?dev=1` y no cachea, para no pelearse con el hot reload.
- `/offline` y `/apple-icon` quedan fuera de la redirección a /login del proxy.
- `sendPushToFamily` se mudó a `src/lib/web-push.ts` (server-only): como export de un archivo `'use server'` podía invocarse desde el navegador.
- Los colores del manifest y de los PNG generados viven en `src/lib/pwa/brand.ts` porque no pueden leer tokens CSS. Si cambia la paleta en `globals.css`, hay que actualizarlos a mano.
