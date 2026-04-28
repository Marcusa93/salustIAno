'use client';

import { useCallback } from 'react';
// TODO: reemplazar con archivo .mp3 real en /public/sounds/confirm.mp3
// import useSound from "use-sound"

const SOUND_KEY = 'salu-sound-enabled';

export function useSaluSound() {
  // TODO: descomentar cuando haya asset de audio
  // const soundEnabled = typeof window !== "undefined"
  //   ? localStorage.getItem(SOUND_KEY) !== "false"
  //   : false
  // const [playConfirm] = useSound("/sounds/confirm.mp3", {
  //   volume: 0.2,
  //   soundEnabled,
  // })

  const playConfirm = useCallback(() => {
    // stub silencioso hasta que haya asset
  }, []);

  function setSoundEnabled(enabled: boolean) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_KEY, String(enabled));
    }
  }

  return { playConfirm, setSoundEnabled };
}
