import { ImageResponse } from 'next/og';

export const runtime = 'edge';

/**
 * Variante "maskable": el OS recorta el ícono con su forma propia (círculo,
 * cuadrado redondeado, etc.). Para que la S no quede recortada, dejamos
 * margen interno (safe zone ~ 80% del centro) y el fondo cubre el 100%.
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
        background: '#7aa0c7',
        fontFamily: "'Fraunces', 'Newsreader', Georgia, serif",
        fontWeight: 600,
        fontSize: 240,
        color: '#f4efe2',
        letterSpacing: '-0.02em',
      }}
    >
      S
    </div>,
    { width: 512, height: 512 },
  );
}
