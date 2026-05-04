'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * Botón "dictar mensaje" usando la Web Speech API del browser.
 *
 * Por qué browser STT y no un endpoint server-side (Whisper):
 *  - 0 costo, 0 latencia (todo se procesa en el device).
 *  - Funciona offline en navegadores compatibles (Chrome, Edge, Safari iOS).
 *  - El reconocimiento de español rioplatense es razonable para frases
 *    cortas tipo "anotá una toma" o "dormí dos siestas".
 *  - Si después queremos dictado largo / grabación de voz, sumamos un
 *    fallback a un servicio cloud (Whisper, Deepgram).
 *
 * Soporte:
 *  - Chrome / Edge desktop + Android: ✔
 *  - Safari iOS 14.5+: ✔
 *  - Firefox: ✘ (el botón no se renderiza si no hay soporte)
 *
 * El componente solo se encarga del audio → texto. Cómo combinar el
 * transcript con un input controlado lo decide el caller via `onTranscript`.
 */

interface SpeechToTextButtonProps {
  /**
   * Callback cuando el reconocimiento devuelve un transcript final
   * (después de detectar pausa o cuando el usuario hace stop).
   */
  onTranscript: (text: string) => void;
  /**
   * Callback opcional para resultados intermedios mientras el usuario
   * habla. Útil para mostrar live-update en el textarea.
   */
  onInterimTranscript?: (text: string) => void;
  /**
   * BCP-47 locale tag. Default 'es-AR'. Usá 'es-MX', 'es-ES', etc. si la
   * familia prefiere otra región.
   */
  lang?: string;
  disabled?: boolean;
  size?: 'sm' | 'icon' | 'icon-sm';
  className?: string;
}

// El typing oficial de Web Speech API no está en lib.dom.d.ts de TS por
// default (está como draft). Tipamos solo lo que usamos.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function SpeechToTextButton({
  onTranscript,
  onInterimTranscript,
  lang = 'es-AR',
  disabled,
  size = 'icon',
  className,
}: SpeechToTextButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(!!ctor);
    return () => {
      // Si el componente se desmonta mientras estaba grabando, cortamos
      // limpio para no dejar el mic abierto.
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  function start() {
    if (typeof window === 'undefined') return;
    const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!ctor) return;

    const rec = new ctor();
    rec.lang = lang;
    rec.continuous = false; // un dictado por click — corta sólo en pausa.
    rec.interimResults = !!onInterimTranscript;

    rec.onstart = () => setListening(true);

    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          finalText += alt.transcript;
        } else {
          interimText += alt.transcript;
        }
      }
      if (finalText.trim().length > 0) {
        onTranscript(finalText.trim());
      } else if (interimText.length > 0 && onInterimTranscript) {
        onInterimTranscript(interimText);
      }
    };

    rec.onerror = (event) => {
      const err = event.error || 'unknown';
      // 'aborted' = stop manual del propio user. 'no-speech' = no detectó
      // nada al silencio: no es un error duro, lo silenciamos. El resto
      // sí lo mostramos.
      if (err !== 'aborted' && err !== 'no-speech') {
        const message =
          err === 'not-allowed' || err === 'service-not-allowed'
            ? 'Necesitamos permiso para usar el micrófono.'
            : err === 'audio-capture'
              ? 'No pudimos acceder al micrófono. Verificá que esté conectado.'
              : err === 'network'
                ? 'Sin conexión para procesar el audio. Probá de nuevo.'
                : 'No pudimos transcribir. Probá de nuevo.';
        toast.error(message);
      }
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
      toast.error('No pudimos iniciar el dictado.');
    }
  }

  function stop() {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={listening ? 'destructive' : 'outline'}
      size={size}
      onClick={listening ? stop : start}
      disabled={disabled}
      aria-label={listening ? 'Detener dictado' : 'Dictar mensaje'}
      title={listening ? 'Detener dictado' : 'Dictar mensaje'}
      className={cn(listening && 'animate-pulse', className)}
    >
      {listening ? (
        <MicOff className="size-4" aria-hidden />
      ) : (
        <Mic className="size-4" aria-hidden />
      )}
    </Button>
  );
}
