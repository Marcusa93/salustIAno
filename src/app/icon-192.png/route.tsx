import { ImageResponse } from 'next/og';

export const runtime = 'edge';

/**
 * PNG 192x192 generado en runtime. Lo referencia el manifest. Mismo look
 * que `app/icon.svg` pero con dimensiones explícitas para que Chrome lo
 * acepte como ícono "instalable" del PWA (requisito mínimo: 192x192 PNG).
 */
export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4efe2',
        borderRadius: 36,
        fontFamily: "'Fraunces', 'Newsreader', Georgia, serif",
        fontWeight: 600,
        fontSize: 130,
        color: '#7aa0c7',
        letterSpacing: '-0.02em',
      }}
    >
      S
    </div>,
    { width: 192, height: 192 },
  );
}
