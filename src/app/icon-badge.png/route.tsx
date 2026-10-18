import { BRAND_BLUE } from '@/lib/pwa/brand';
import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

/**
 * Badge de las notificaciones en Android: la barra de estado usa solo el
 * canal alpha, así que va una "S" opaca sobre fondo transparente (el sistema
 * la pinta de blanco). Con el ícono a color se vería un cuadrado blanco.
 */
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 84,
        color: BRAND_BLUE,
      }}
    >
      S
    </div>,
    { width: 96, height: 96 },
  );
}
