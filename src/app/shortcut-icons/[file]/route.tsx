import { BRAND_BLUE, BRAND_IVORY } from '@/lib/pwa/brand';
import { ImageResponse } from 'next/og';

/**
 * Íconos de los atajos del manifest (mantener apretado el ícono de Salu en
 * Android). Trazos de lucide (Milk, Moon, Baby) sobre el azul de marca, con
 * margen para que el recorte circular del sistema no los corte.
 */
const SHORTCUT_ICON_PATHS: Record<string, readonly string[]> = {
  'toma.png': [
    'M8 2h8',
    'M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2',
    'M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0',
  ],
  'sueno.png': [
    'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401',
  ],
  'panal.png': [
    'M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5',
    'M15 12h.01',
    'M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1',
    'M9 12h.01',
  ],
};

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(SHORTCUT_ICON_PATHS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const paths = SHORTCUT_ICON_PATHS[file];
  if (!paths) return new Response('Not found', { status: 404 });

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BRAND_BLUE,
      }}
    >
      <svg
        width="52"
        height="52"
        viewBox="0 0 24 24"
        fill="none"
        stroke={BRAND_IVORY}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>,
    { width: 96, height: 96 },
  );
}
