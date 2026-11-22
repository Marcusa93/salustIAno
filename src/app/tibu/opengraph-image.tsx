import { loadPublicLetter } from '@/lib/carta/load-letter';
import { ImageResponse } from 'next/og';

export const alt = 'Una carta de Tibu para Franco';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Lee la carta del bucket y baja la letra: se arma en cada pedido, no en el build.
export const dynamic = 'force-dynamic';

// Los colores de la carta (globals.css, en oklch) pasados a hex: Satori no lee tokens.
const NIGHT = '#101727';
const NIGHT_FOREGROUND = '#f2ecdf';
const GLOW = '#efc27e';
const POLAROID = '#fdfcf8';

// Google Fonts devuelve WOFF2 a los navegadores nuevos; Satori lee TTF, OTF y WOFF.
// Con este UA viejo devuelve TTF o, para Caveat, WOFF.
const OLD_UA =
  'Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19';

async function fetchGoogleFont(family: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`,
      { headers: { 'User-Agent': OLD_UA } },
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype|woff)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/** La primera foto del primer capítulo: Tibu de joven. */
async function coverPhoto(): Promise<{ src: string; width: number; height: number } | null> {
  const result = await loadPublicLetter('tibu');
  if (!result.ok) return null;
  for (const media of result.letter.chapters[0]?.media ?? []) {
    if (media.kind === 'photo') return media;
  }
  return null;
}

export default async function Image() {
  const [caveat, photo] = await Promise.all([fetchGoogleFont('Caveat'), coverPhoto()]);
  const hand = caveat ? 'Caveat' : 'Georgia, serif';
  // El PNG pesa por los píxeles de foto: así queda bajo los ~300 KB que muestra WhatsApp.
  const photoHeight = 340;
  const photoWidth = photo ? Math.round((photo.width / photo.height) * photoHeight) : 0;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 80,
        // Fondo liso: un degradé infla el PNG y WhatsApp no muestra previews pesadas.
        background: NIGHT,
        padding: '0 90px',
      }}
    >
      {photo && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: POLAROID,
            padding: '18px 18px 56px',
            transform: 'rotate(-4deg)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
          }}
        >
          <img src={photo.src} alt="" width={photoWidth} height={photoHeight} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: GLOW, fontSize: 40, fontFamily: hand }}>Para Franco</div>
        <div
          style={{
            color: NIGHT_FOREGROUND,
            fontSize: 96,
            fontFamily: hand,
            lineHeight: 1,
          }}
        >
          Una carta de Tibu
        </div>
        <div style={{ color: 'rgba(242,236,223,0.6)', fontSize: 30, fontFamily: hand }}>
          Tu chanchón, para siempre.
        </div>
      </div>
    </div>,
    // Sin la letra, se usa la de Satori: con `fonts: []` no dibuja nada.
    caveat
      ? { ...size, fonts: [{ name: 'Caveat', data: caveat, style: 'normal', weight: 400 }] }
      : size,
  );
}
