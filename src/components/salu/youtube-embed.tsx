import { cn } from '@/lib/utils';

interface YouTubeEmbedProps {
  /**
   * URL de YouTube. Aceptamos las variantes públicas comunes:
   *   https://www.youtube.com/watch?v=ABC123
   *   https://youtu.be/ABC123
   *   https://youtube.com/playlist?list=PLxxxx
   *   https://www.youtube.com/playlist?list=PLxxxx&si=...
   */
  url: string;
  /** Etiqueta para lectores de pantalla. */
  title?: string;
  className?: string;
}

interface ParsedYouTube {
  kind: 'video' | 'playlist';
  /** Embed src ya armado, listo para `<iframe src={...}>`. */
  src: string;
}

/**
 * Convierte una URL pública de YouTube a su variante embed con los
 * parámetros que mejor encajan para Salu:
 *
 *   - youtube-nocookie.com: Spotify-equivalent en privacidad. No baja
 *     cookies de tracking de YT a la familia mientras no le den play.
 *   - rel=0: al terminar, no muestra recomendaciones de otros canales
 *     ("vea también este video viral con bebé llorando..."). Mantiene
 *     dentro del mismo canal/playlist seleccionada.
 *   - modestbranding=1: oculta el logo de YT cuando se puede.
 *   - playsinline=1: en iOS evita que abra fullscreen automáticamente.
 *
 * Devuelve null si la URL no es de YouTube — el componente muestra un
 * fallback.
 */
function parseYouTube(url: string): ParsedYouTube | null {
  let host: string;
  let pathname: string;
  let search: URLSearchParams;
  try {
    const parsed = new URL(url);
    host = parsed.host.replace(/^www\./, '');
    pathname = parsed.pathname;
    search = parsed.searchParams;
  } catch {
    return null;
  }

  const isYT = host === 'youtube.com' || host === 'youtu.be';
  if (!isYT) return null;

  const params = new URLSearchParams();
  params.set('rel', '0');
  params.set('modestbranding', '1');
  params.set('playsinline', '1');

  // Caso 1: playlist (con ?list= y opcionalmente sin v= → es playlist
  // pura).
  const listId = search.get('list');
  if (listId && pathname.startsWith('/playlist')) {
    params.set('list', listId);
    return {
      kind: 'playlist',
      src: `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}`,
    };
  }

  // Caso 2: video individual.
  // youtu.be/ID
  if (host === 'youtu.be' && pathname.length > 1) {
    const videoId = pathname.slice(1).split('/')[0];
    if (videoId) {
      if (listId) params.set('list', listId);
      return {
        kind: 'video',
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`,
      };
    }
  }
  // youtube.com/watch?v=ID&list=...
  if (pathname.startsWith('/watch')) {
    const videoId = search.get('v');
    if (videoId) {
      if (listId) params.set('list', listId);
      return {
        kind: 'video',
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`,
      };
    }
  }

  return null;
}

/**
 * Embed oficial de YouTube vía iframe. Sin OAuth, sin API key.
 * Funciona para videos individuales, playlists y mezclas. Privacidad
 * elevada (youtube-nocookie.com), sin recomendaciones cruzadas
 * (rel=0), reproducción inline en iOS (playsinline=1).
 *
 * Aspect-ratio fijo 16/9 — el patrón estándar de YT. Si en el futuro
 * querés embebir un short (9/16), agregar prop `aspect`.
 */
export function YouTubeEmbed({
  url,
  title = 'Reproductor de YouTube',
  className,
}: YouTubeEmbedProps) {
  const parsed = parseYouTube(url);
  if (!parsed) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm',
          className,
        )}
      >
        URL de YouTube inválida.
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
      <div className="relative aspect-video w-full">
        <iframe
          src={parsed.src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          loading="lazy"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
    </div>
  );
}
