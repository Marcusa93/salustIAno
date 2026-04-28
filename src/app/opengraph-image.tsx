import { ImageResponse } from 'next/og';

export const alt = 'Salu — un lugar para Salustiano';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Font fetch requires network; generate at request time, not build time
export const dynamic = 'force-dynamic';

// Google Fonts returns WOFF2 for modern UAs; Satori only handles TTF/OTF.
// Old Android UA makes Fonts API return TTF format.
const OLD_UA =
  'Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19';

async function fetchGoogleFont(family: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`,
      { headers: { 'User-Agent': OLD_UA } },
    ).then((r) => r.text());

    const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    const url = match?.[1];
    if (!url) return null;

    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function Image() {
  const fraunces = await fetchGoogleFont('Fraunces');

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(140deg, #2a5740 0%, #4a8060 100%)',
        padding: '80px',
        gap: '28px',
        position: 'relative',
      }}
    >
      <div
        style={{
          color: 'rgba(255,255,255,0.95)',
          fontSize: 62,
          fontFamily: fraunces ? 'Fraunces' : 'Georgia, serif',
          fontWeight: 400,
          textAlign: 'center',
          letterSpacing: '-1px',
          lineHeight: 1.15,
        }}
      >
        Salustiano todavía no nació.
      </div>
      <div
        style={{
          color: 'rgba(255,255,255,0.65)',
          fontSize: 28,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          lineHeight: 1.4,
          fontWeight: 400,
        }}
      >
        Pero cuando llegue, este va a ser su lugar.
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          color: 'rgba(255,255,255,0.45)',
          fontSize: 22,
          fontFamily: fraunces ? 'Fraunces' : 'Georgia, serif',
          fontStyle: 'italic',
        }}
      >
        Salu.
      </div>
    </div>,
    {
      ...size,
      fonts: fraunces ? [{ name: 'Fraunces', data: fraunces, style: 'normal', weight: 400 }] : [],
    },
  );
}
