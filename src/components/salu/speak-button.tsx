'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Pause, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface SpeakButtonProps {
  text: string;
  /**
   * Idioma preferido. Default 'es-AR'; si el browser no tiene voz para AR
   * cae a 'es-MX' / 'es-ES' / 'es' por orden.
   */
  lang?: string;
  className?: string;
  size?: 'xs' | 'sm';
}

const PREFERRED_LANGS = ['es-AR', 'es-MX', 'es-419', 'es-ES', 'es'];

/**
 * Botón "leer en voz alta" que usa `window.speechSynthesis` (Web Speech API).
 *
 * Por qué browser TTS y no un endpoint server-side:
 *  - 0 costo, 0 latencia (la voz es local).
 *  - Funciona offline en el PWA instalado.
 *  - La calidad para español rioplatense en iOS (Siri Voice "Mónica" o
 *    similar) y Android es razonable. Si después queremos voz custom,
 *    podemos delegar al server con un agente TTS.
 *
 * Estados:
 *  - 'idle' (no soportado o no se hizo click)
 *  - 'speaking' (está hablando)
 *  - El click toggle: si está speaking, lo cancela.
 */
export function SpeakButton({ text, lang = 'es-AR', className, size = 'xs' }: SpeakButtonProps) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    setSupported(true);

    // En varios browsers `getVoices()` devuelve vacío hasta que dispara el
    // evento `voiceschanged`. Forzamos un tick por las dudas.
    const handleVoicesChanged = () => {
      // Solo nos importa que el array esté hidratado para cuando el user
      // toque el botón — no necesitamos hacer nada acá, pero suscribirnos
      // garantiza que el browser tenga las voces cargadas.
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    // Trigger inicial para que algunos browsers carguen la lista.
    window.speechSynthesis.getVoices();

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    };
  }, []);

  useEffect(() => {
    return () => {
      // Si el componente se desmonta mientras estaba hablando, cortamos.
      if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function pickVoice(langPref: string): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    const tryList = [langPref, ...PREFERRED_LANGS.filter((l) => l !== langPref)];
    for (const target of tryList) {
      const exact = voices.find((v) => v.lang === target);
      if (exact) return exact;
      const startsWith = voices.find((v) => v.lang.startsWith(`${target}-`) || v.lang === target);
      if (startsWith) return startsWith;
    }
    // Fallback: primera voz cuyo lang empiece con "es"
    return voices.find((v) => v.lang.startsWith('es')) ?? null;
  }

  function handleClick() {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!text || text.trim().length === 0) return;

    // Cancelar cualquier otra utterance previa (otro botón).
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 1.0;
    utt.pitch = 1.0;

    const voice = pickVoice(lang);
    if (voice) utt.voice = voice;

    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);

    utteranceRef.current = utt;
    setSpeaking(true);
    window.speechSynthesis.speak(utt);
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={handleClick}
      aria-label={speaking ? 'Pausar lectura' : 'Leer en voz alta'}
      className={cn('text-muted-foreground hover:text-foreground', className)}
    >
      {speaking ? (
        <Pause className="size-3.5" aria-hidden />
      ) : (
        <Volume2 className="size-3.5" aria-hidden />
      )}
      {speaking ? 'Detener' : 'Escuchar'}
    </Button>
  );
}
