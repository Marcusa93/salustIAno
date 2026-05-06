import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * Apple touch icon, 180x180. Lo usa iOS cuando el usuario hace
 * "Agregar a la pantalla de inicio". A diferencia de los iconos de Chrome,
 * iOS NO recorta automáticamente con esquinas redondeadas en versiones
 * recientes — el ícono se muestra tal cual. Aun así dejamos las esquinas
 * sutiles para iOS antiguos.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4efe2',
        fontFamily: "'Fraunces', 'Newsreader', Georgia, serif",
        fontWeight: 600,
        fontSize: 130,
        color: '#7aa0c7',
        letterSpacing: '-0.02em',
      }}
    >
      S
    </div>,
    { ...size },
  );
}
