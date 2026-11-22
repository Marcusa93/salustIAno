import { LetterExperience } from '@/app/carta/[slug]/_components/letter-experience';
import { caveat } from '@/app/carta/fonts';
import { loadPublicLetter } from '@/lib/carta/load-letter';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * La carta de Tibu para Franco. Se abre con el link, sin cuenta: Franco no
 * es de la familia de la app. El contenido vive en el bucket privado
 * (`cartas/tibu/`), como el de cualquier carta; ver load-letter.ts.
 */
const SLUG = 'tibu';
const TITLE = 'Una carta de Tibu';
const DESCRIPTION = 'Para Franco, de su chanchón.';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  robots: 'noindex, nofollow',
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', locale: 'es_AR' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default async function TibuLetterPage() {
  const result = await loadPublicLetter(SLUG);
  if (!result.ok) notFound();

  return (
    <div className={caveat.variable}>
      <LetterExperience letter={result.letter} />
    </div>
  );
}
