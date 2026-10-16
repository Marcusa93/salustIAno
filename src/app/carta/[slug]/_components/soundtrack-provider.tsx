'use client';

import { Soundtrack, type SoundtrackSong } from '@/lib/carta/soundtrack';
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

interface SoundtrackValue {
  soundtrack: Soundtrack;
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

const SoundtrackContext = createContext<SoundtrackValue | null>(null);

export function SoundtrackProvider({
  songs,
  children,
}: {
  songs: SoundtrackSong[];
  children: ReactNode;
}) {
  const [soundtrack] = useState(() => new Soundtrack(songs));
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    const onVisibility = () => soundtrack.setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      soundtrack.dispose();
    };
  }, [soundtrack]);

  const setMuted = (next: boolean) => {
    soundtrack.setMuted(next);
    setMutedState(next);
  };

  return (
    <SoundtrackContext.Provider value={{ soundtrack, muted, setMuted }}>
      {children}
    </SoundtrackContext.Provider>
  );
}

export function useSoundtrack(): SoundtrackValue {
  const value = useContext(SoundtrackContext);
  if (!value) throw new Error('useSoundtrack necesita un <SoundtrackProvider>.');
  return value;
}
