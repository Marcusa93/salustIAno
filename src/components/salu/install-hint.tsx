'use client';

import { IosInstallSteps } from '@/components/pwa/ios-install-steps';
import { Button } from '@/components/ui/button';
import {
  INSTALL_HINT_STORAGE_KEY,
  type InstallHintKind,
  getInstallHintKind,
  readDeviceInfo,
} from '@/lib/pwa/platform';
import { cn } from '@/lib/utils';
import { Download, Share, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Evento no estándar de Chromium; TypeScript no lo trae en lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Pequeño delay para no aparecer junto con otras toasts/animaciones.
const IOS_HINT_DELAY_MS = 1200;

function readDismissedAt(): string | null {
  try {
    return window.localStorage.getItem(INSTALL_HINT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Banner discreto que invita a instalar Salu como app:
 *  - Android / Chromium: cuando el navegador ofrece instalar
 *    (`beforeinstallprompt`), guardamos el evento y mostramos un botón
 *    "Instalar" que abre el diálogo nativo.
 *  - iPhone / iPad: no hay prompt; mostramos los pasos de Compartir →
 *    Agregar a inicio. Ahí importa doble: en iOS los avisos push solo
 *    funcionan con la app instalada.
 * No aparece si ya está instalada o si la descartaron en los últimos 30 días.
 */
export function InstallHint() {
  const [kind, setKind] = useState<InstallHintKind>(null);
  const [installing, setInstalling] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const device = readDeviceInfo();
    const evaluate = (canPrompt: boolean) =>
      getInstallHintKind({ device, canPrompt, dismissedAt: readDismissedAt(), now: Date.now() });

    const onBeforeInstallPrompt = (event: Event) => {
      if (evaluate(true) !== 'prompt') return; // dejamos que el navegador siga con lo suyo
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setKind('prompt');
    };
    const onAppInstalled = () => {
      deferredPrompt.current = null;
      setKind(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    const timer =
      evaluate(false) === 'ios'
        ? setTimeout(() => setKind((current) => current ?? 'ios'), IOS_HINT_DELAY_MS)
        : undefined;

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(INSTALL_HINT_STORAGE_KEY, String(Date.now()));
    } catch {
      /* localStorage bloqueado (modo privado): igual ocultamos para esta sesión */
    }
    setKind(null);
  }

  async function install() {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setKind(null);
      else dismiss();
    } finally {
      // El evento sirve una sola vez.
      deferredPrompt.current = null;
      setInstalling(false);
    }
  }

  if (!kind) return null;

  return (
    <section
      aria-label="Instalar Salu"
      className={cn(
        'fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 mx-auto max-w-sm',
        'animate-stagger-up rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur-md',
        'flex items-start gap-3 md:hidden',
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"
      >
        {kind === 'ios' ? <Share className="size-4" /> : <Download className="size-4" />}
      </span>

      {kind === 'ios' ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="font-medium text-foreground text-sm leading-tight">
            Instalá Salu en tu iPhone
          </p>
          <IosInstallSteps finalStep="Abrí Salu desde el ícono: así también te llegan los avisos." />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground text-sm leading-tight">
              Instalá Salu en tu celu
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              Se abre como una app, sin la barra del navegador, y te pueden llegar los avisos.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={install}
            disabled={installing}
            className="self-start"
          >
            <Download aria-hidden />
            Instalar
          </Button>
        </div>
      )}

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={dismiss}
        aria-label="Cerrar sugerencia"
        className="-mt-1 -mr-1 shrink-0"
      >
        <X className="size-4" aria-hidden />
      </Button>
    </section>
  );
}
