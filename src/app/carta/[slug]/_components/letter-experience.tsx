'use client';

import { type Letter, type LetterChapter, photosInChronologicalOrder } from '@/lib/carta/manifest';
import { easeWarm } from '@/lib/motion';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { PaperGrain } from './atmosphere';
import { ChapterSection } from './chapter-section';
import { Envelope } from './envelope';
import { Finale } from './finale';
import { Handwritten } from './handwritten';
import { HeartbeatGate } from './heartbeat-gate';
import { ChapterRail, SoundToggle } from './letter-chrome';
import { PhotoViewerProvider } from './photo-viewer';
import { SoundtrackProvider, useSoundtrack } from './soundtrack-provider';

type Stage = 'sealed' | 'heartbeat' | 'letter';

/**
 * La carta tiene tres escenas: el sobre cerrado, el latido y la carta en
 * sí (capítulos + final). Cada escena desbloquea la siguiente con un gesto,
 * que es además lo que habilita el audio en iOS.
 */
export function LetterExperience({ letter }: { letter: Letter }) {
  const [stage, setStage] = useState<Stage>('sealed');
  const firstSongId = letter.chapters[0]?.song ?? letter.songs[0]?.id;

  return (
    <MotionConfig reducedMotion="user">
      <SoundtrackProvider songs={letter.songs} effects={letter.sounds}>
        <PhotoViewerProvider photos={photosInChronologicalOrder(letter)} birthAt={letter.birthAt}>
          <AnimatePresence>
            {stage === 'sealed' && (
              <Envelope
                key="sealed"
                envelope={letter.envelope}
                onOpened={() => setStage('heartbeat')}
              />
            )}
            {stage === 'heartbeat' && (
              <HeartbeatGate
                key="heartbeat"
                copy={letter.heartbeat}
                firstSongId={firstSongId}
                onDone={() => setStage('letter')}
              />
            )}
          </AnimatePresence>
          {stage === 'letter' ? (
            <LetterPaper letter={letter} />
          ) : (
            <div className="min-h-dvh bg-carta-night" />
          )}
        </PhotoViewerProvider>
      </SoundtrackProvider>
    </MotionConfig>
  );
}

function LetterPaper({ letter }: { letter: Letter }) {
  const { soundtrack } = useSoundtrack();
  const [current, setCurrent] = useState<LetterChapter | null>(null);
  const defaultSong = letter.songs[0]?.id;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const enterChapter = (chapter: LetterChapter) => {
    setCurrent(chapter);
    const song = chapter.song ?? defaultSong;
    if (song) soundtrack.play(song);
  };

  const enterFinale = () => {
    setCurrent(null);
    const song = letter.finale.song ?? defaultSong;
    if (song) soundtrack.play(song);
  };

  return (
    <motion.main
      className="relative min-h-dvh overflow-x-clip bg-carta-paper text-carta-ink"
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.4, ease: easeWarm }}
    >
      <PaperGrain />
      <ChapterRail chapter={current} />
      <SoundToggle />

      <article className="relative z-10 mx-auto max-w-xl px-7 pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-32">
        {letter.dateline && (
          <p className="mb-10 text-right font-hand text-carta-ink-soft text-xl">
            {letter.dateline}
          </p>
        )}
        <Handwritten paragraphs={letter.intro} size="lg" />

        {letter.chapters.map((chapter) => (
          <ChapterSection key={chapter.id} chapter={chapter} onEnter={enterChapter} />
        ))}
      </article>

      <div className="relative z-10">
        <Finale
          slug={letter.slug}
          finale={letter.finale}
          birthAt={letter.birthAt}
          memories={letter.memories}
          onEnter={enterFinale}
        />
      </div>
    </motion.main>
  );
}
