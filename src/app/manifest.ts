import type { MetadataRoute } from 'next';

/**
 * Web App Manifest para que Salu se pueda "instalar" en el celu de la familia.
 *
 * Detalles de elección:
 * - `display: 'standalone'` → cuando se abre desde el ícono no muestra la
 *   barra del browser. Da sensación de app nativa.
 * - `start_url: '/home'` → al abrir el shortcut va directo al feed del día,
 *   no a la landing pública.
 * - `theme_color` y `background_color` matchean la paleta hue 235 (azul
 *   polvo) + ivory del proyecto. Estos colores se usan para el splash y
 *   la barra del SO al levantar la app.
 * - Iconos: SVG con `sizes: 'any'` cubre Android Chrome / Edge / Firefox.
 *   `apple-icon` (definido en `apple-icon.tsx`) cubre iOS.
 * - Shortcuts: accesos directos para los 3 flujos más frecuentes.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Salu — un lugar para Salustiano',
    short_name: 'Salu',
    description: 'La casa donde guardamos todo lo de Salustiano. Hecho con cuidado en Tucumán.',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4efe2',
    theme_color: '#7aa0c7',
    lang: 'es-AR',
    dir: 'ltr',
    categories: ['lifestyle', 'medical', 'productivity'],
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
        name: 'Registrar pañal',
        short_name: 'Pañal',
        description: 'Anotar un pañal rápido',
        url: '/home?quick=panal',
      },
      {
        name: 'Registrar toma',
        short_name: 'Toma',
        description: 'Anotar una toma',
        url: '/home?quick=toma',
      },
      {
        name: 'Subir foto al álbum',
        short_name: 'Foto',
        description: 'Sumar fotos al álbum',
        url: '/album',
      },
    ],
  };
}
