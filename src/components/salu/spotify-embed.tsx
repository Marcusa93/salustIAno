import { cn } from '@/lib/utils';

interface SpotifyEmbedProps {
  /**
   * URL completa de Spotify (track / playlist / album / show / episode).
   * Aceptamos la URL pública estándar — internamente la convertimos a
   * la versión `/embed/`. Ejemplos válidos:
   *   https://open.spotify.com/playlist/3U5CcYIMZo3BRnD2JV4I0c?si=...
   *   https://open.spotify.com/track/7lQ8MOhq6IN2w8EYcFNSUk
   */
  url: string;
  /**
   * Alto del iframe. Default 352 (recomendado por Spotify para
   * playlists). Tracks individuales lucen mejor en 152.
   */
  height?: number;
  /** Etiqueta para lectores de pantalla. */
  title?: string;
  className?: string;
}

const SPOTIFY_PUBLIC_PREFIX = 'https://open.spotify.com/';
const SPOTIFY_EMBED_PREFIX = 'https://open.spotify.com/embed/';

/**
 * Convierte una URL pública de Spotify a su variante embed. Si la URL
 * no es de Spotify devuelve null (caller decide qué mostrar).
 *
 * El parámetro `?si=...` (share-id de tracking) se elimina — no aporta
 * a la reproducción y queda más limpio en el iframe src.
 */
function toEmbedUrl(url: string): string | null {
  if (!url.startsWith(SPOTIFY_PUBLIC_PREFIX)) return null;
  const path = url.slice(SPOTIFY_PUBLIC_PREFIX.length);
  // Sacamos la query string si existe.
  const [pathOnly] = path.split('?');
  if (!pathOnly) return null;
  return `${SPOTIFY_EMBED_PREFIX}${pathOnly}`;
}

/**
 * Embed oficial de Spotify (iframe). Sin OAuth, sin API key — la
 * familia que esté logueada en Spotify (free o premium) reproduce
 * entero; sin login obtienen previews de 30s.
 *
 * Decisiones:
 *   - `loading="lazy"`: el iframe baja JS de Spotify (~80kb) — solo
 *     se carga cuando entra al viewport.
 *   - Bordes redondeados via wrapper `<div>` con overflow-hidden,
 *     porque el iframe en sí no respeta border-radius en algunos
 *     browsers viejos.
 *   - Sin sandbox: Spotify necesita scripts + same-origin para
 *     manejar el cookie de auth del usuario logueado. El iframe
 *     mismo es de un origin distinto (open.spotify.com), no compromete
 *     nuestra app.
 */
export function SpotifyEmbed({
  url,
  height = 352,
  title = 'Reproductor de Spotify',
  className,
}: SpotifyEmbedProps) {
  const embedUrl = toEmbedUrl(url);
  if (!embedUrl) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm',
          className,
        )}
      >
        URL de Spotify inválida.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm',
        className,
      )}
    >
      <iframe
        src={embedUrl}
        title={title}
        width="100%"
        height={height}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ border: 0, display: 'block' }}
      />
    </div>
  );
}
