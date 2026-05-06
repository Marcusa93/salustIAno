import { ImageResponse } from 'next/og';

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
        borderRadius: 96,
        fontFamily: "'Fraunces', 'Newsreader', Georgia, serif",
        fontWeight: 600,
        fontSize: 360,
        color: '#7aa0c7',
        letterSpacing: '-0.02em',
      }}
    >
      S
    </div>,
    { width: 512, height: 512 },
  );
}
