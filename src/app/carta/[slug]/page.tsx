import { loadLetter } from '@/lib/carta/load-letter';
import type { Metadata } from 'next';
import { Caveat } from 'next/font/google';
import { notFound } from 'next/navigation';
import { LetterExperience } from './_components/letter-experience';

// Letra manuscrita solo para las cartas: no se descarga en el resto de la app.
const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Una carta para vos',
  robots: 'noindex, nofollow',
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LetterPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadLetter(slug);
  if (!result.ok) notFound();

  return (
    <div className={caveat.variable}>
      <LetterExperience letter={result.letter} />
    </div>
  );
}
