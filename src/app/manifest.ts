import { BRAND_IVORY } from '@/lib/pwa/brand';
import type { MetadataRoute } from 'next';

/**
 * Web App Manifest para que Salu se instale como app en el celu de la familia.
 *
 * Detalles de elección:
 * - `id: '/home'` fija la identidad de la app instalada. Antes no estaba y
 *   Chrome la derivaba del `start_url`, que también es '/home': así las
 *   instalaciones que ya existen siguen siendo la misma app.
 * - `display: 'standalone'` → sin barra del navegador. En iPhone, además, es
 *   requisito para que funcionen las notificaciones push.
 * - `start_url: '/home'` → abre directo en el día, no en la landing pública.
 * - `theme_color` = `background_color` = ivory, igual que el theme-color
 *   claro del layout, para que el splash y la barra de estado no salten de
 *   azul a ivory al cargar.
 * - Íconos: SVG `any` + PNG 192/512 (mínimo que pide Chrome para instalar)
 *   + maskable con zona segura para el recorte de Android. iOS usa
 *   `apple-icon.tsx`.
 * - Shortcuts: mantener apretado el ícono (Android) → anotar toma, sueño o
 *   pañal en un toque. iOS no soporta shortcuts de PWA.
 * - `launch_handler`: si Salu ya está abierta, un atajo reusa esa ventana.
 * - Sin `screenshots`: el diálogo "enriquecido" de Chrome las pide, pero
 *   capturas reales mostrarían datos y fotos de Salustiano en un repo
 *   público. Para dos o tres instalaciones no vale la pena.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/home',
    name: 'Salu — un lugar para Salustiano',
    short_name: 'Salu',
    description: 'La casa donde guardamos todo lo de Salustiano. Hecho con cuidado en Tucumán.',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BRAND_IVORY,
    theme_color: BRAND_IVORY,
    lang: 'es-AR',
    dir: 'ltr',
    categories: ['lifestyle', 'medical', 'productivity'],
    prefer_related_applications: false,
    launch_handler: { client_mode: ['navigate-existing', 'auto'] },
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Anotar toma',
        short_name: 'Toma',
        description: 'Registrar una toma en un toque',
        url: '/anotar/toma',
        icons: [{ src: '/shortcut-icons/toma.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Anotar sueño',
        short_name: 'Sueño',
        description: 'Se durmió o se despertó',
        url: '/anotar/sueno',
        icons: [{ src: '/shortcut-icons/sueno.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Anotar pañal',
        short_name: 'Pañal',
        description: 'Registrar un pañal en un toque',
        url: '/anotar/panal',
        icons: [{ src: '/shortcut-icons/panal.png', sizes: '96x96', type: 'image/png' }],
      },
    ],
  };
}
