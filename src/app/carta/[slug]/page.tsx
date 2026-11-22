import { loadLetter } from '@/lib/carta/load-letter';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { caveat } from '../fonts';
import { LetterExperience } from './_components/letter-experience';

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
