'use client';

import {
  type Letter,
  type LetterChapter,
  type LetterSong,
  photosInChronologicalOrder,
} from '@/lib/carta/manifest';
import {
  FINALE,
  clearProgress,
  readProgress,
  resumableChapter,
  safeStorage,
  saveProgress,
} from '@/lib/carta/progress';
import { easeWarm } from '@/lib/motion';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { PaperGrain } from './atmosphere';
import { ChapterSection, chapterAnchor } from './chapter-section';
import { Envelope } from './envelope';
import { Finale } from './finale';
import { Handwritten } from './handwritten';
import { HeartbeatGate } from './heartbeat-gate';
import { ChapterRail, ExitLetterLink, SoundToggle } from './letter-chrome';
import { PhotoViewerProvider } from './photo-viewer';
import { SoundtrackProvider, useSoundtrack } from './soundtrack-provider';

type Stage = 'sealed' | 'heartbeat' | 'letter';

/** Dónde está cada parte de la carta en la página, para saltar ahí. */
function anchorFor(id: string): string {
  return id === FINALE ? FINALE : chapterAnchor(id);
}

/**
 * La carta tiene tres escenas: el sobre cerrado, el latido y la carta en
 * sí (capítulos + final). Cada escena desbloquea la siguiente con un gesto,
 * que es además lo que habilita el audio en iOS. Si ya la había empezado,
 * el sobre ofrece seguir donde quedó.
 */
export function LetterExperience({ letter }: { letter: Letter }) {
  const [stage, setStage] = useState<Stage>('sealed');
  const [resumeFrom, setResumeFrom] = useState<string | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const firstSongId = letter.chapters[0]?.song ?? letter.songs[0]?.id;

  // El progreso vive en el dispositivo: se lee recién en el cliente.
  useEffect(() => {
    const saved = readProgress(safeStorage(), letter.slug);
    setResumeFrom(
      resumableChapter(
        saved,
        letter.chapters.map((chapter) => chapter.id),
      ),
    );
  }, [letter.slug, letter.chapters]);

  const resumeLabel =
    resumeFrom === null
      ? null
      : resumeFrom === FINALE
        ? 'el final'
        : (letter.chapters.find((chapter) => chapter.id === resumeFrom)?.label ?? null);

  return (
    <MotionConfig reducedMotion="user">
      <SoundtrackProvider songs={letter.songs} effects={letter.sounds}>
        <PhotoViewerProvider photos={photosInChronologicalOrder(letter)} birthAt={letter.birthAt}>
          <AnimatePresence>
            {stage === 'sealed' && (
              <Envelope
                key="sealed"
                envelope={letter.envelope}
                resumeLabel={resumeLabel}
                onOpened={() => {
                  clearProgress(safeStorage(), letter.slug);
                  setStage('heartbeat');
                }}
                onResume={() => {
                  setStartAt(resumeFrom);
                  setStage('letter');
                }}
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
            <LetterPaper letter={letter} startAt={startAt} />
          ) : (
            <div className="min-h-dvh bg-carta-night" />
          )}
        </PhotoViewerProvider>
      </SoundtrackProvider>
    </MotionConfig>
  );
}

function LetterPaper({ letter, startAt }: { letter: Letter; startAt: string | null }) {
  const { soundtrack } = useSoundtrack();
  const [current, setCurrent] = useState<LetterChapter | null>(null);
  const [nowPlaying, setNowPlaying] = useState<LetterSong | null>(null);
  const playingId = useRef<string | null>(null);
  const defaultSong = letter.songs[0]?.id;

  useEffect(() => {
    const target = startAt ? document.getElementById(anchorFor(startAt)) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [startAt]);

  const playSong = (songId: string | undefined) => {
    if (!songId) return;
    soundtrack.play(songId);
    if (playingId.current === songId) return;
    playingId.current = songId;
    setNowPlaying(letter.songs.find((song) => song.id === songId) ?? null);
  };

  const enterChapter = (chapter: LetterChapter) => {
    setCurrent(chapter);
    saveProgress(safeStorage(), letter.slug, chapter.id);
    playSong(chapter.song ?? defaultSong);
  };

  const enterFinale = () => {
    setCurrent(null);
    saveProgress(safeStorage(), letter.slug, FINALE);
    playSong(letter.finale.song ?? defaultSong);
  };

  const jumpTo = (id: string) => {
    document.getElementById(anchorFor(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <motion.main
      className="relative min-h-dvh overflow-x-clip bg-carta-paper text-carta-ink"
      // Al retomar, sin desplazamiento: si no, el salto al capítulo queda 60 px corrido.
      initial={startAt ? { opacity: 0 } : { opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.4, ease: easeWarm }}
    >
      <PaperGrain />
      <ExitLetterLink />
      <ChapterRail
        chapters={letter.chapters}
        current={current}
        nowPlaying={nowPlaying}
        onJump={jumpTo}
      />
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
