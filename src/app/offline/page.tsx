import { WifiOff } from 'lucide-react';
import type { Metadata } from 'next';
import { RetryButton } from './retry-button';

/**
 * Página de respaldo sin señal. El service worker la guarda al instalarse
 * (junto con su CSS y JS) y la devuelve cuando una navegación falla por red.
 * Es estática y pública (ver PUBLIC_ROUTES en el proxy): no tiene datos de
 * la familia, así que se puede cachear sin problema.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Sin conexión',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-7 px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <WifiOff className="size-7" />
      </span>

      <div className="flex flex-col gap-3">
        <p className="font-medium text-primary text-xs uppercase tracking-[0.18em]">Sin señal</p>
        <h1 className="font-display font-medium text-3xl text-foreground leading-tight">
          Salu te espera acá.
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          No hay conexión en este momento. Todo lo de Salustiano está guardado: apenas vuelva la
          señal, recargamos solos.
        </p>
      </div>

      <RetryButton />

      <p className="text-muted-foreground/80 text-xs leading-relaxed">
        Mientras tanto, anotá la hora de la toma, el pañal o el sueño y cargalo después con ese
        horario.
      </p>
    </main>
  );
}
