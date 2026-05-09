'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Copy, Loader2, Share2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { DayShareSnapshot } from '../share-day-actions';
import { getDayShareSnapshotAction } from '../share-day-actions';

interface ShareDayCardProps {
  /** Snapshot inicial cargado server-side. La card lo refresca al
   * abrirse o al apretar "Generar de nuevo". */
  initial: DayShareSnapshot | null;
}

/**
 * Card "Mandar a la familia". Arma un mensaje compacto con el día del
 * bebé (tomas / sueños / pañales) y la foto más reciente subida hoy,
 * lista para mandar por WhatsApp / Telegram con Web Share API. Si el
 * navegador no soporta share nativo (desktop sin permisos), cae a copy.
 *
 * El snapshot se refresca server-side bajo demanda (botón "Actualizar")
 * para no quedar desactualizado si la familia sigue cargando eventos.
 */
export function ShareDayCard({ initial }: ShareDayCardProps) {
  const [snapshot, setSnapshot] = useState<DayShareSnapshot | null>(initial);
  const [refreshing, startRefresh] = useTransition();
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  function refresh() {
    startRefresh(async () => {
      const fresh = await getDayShareSnapshotAction();
      setSnapshot(fresh);
    });
  }

  async function handleCopy() {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot.text);
      setCopied(true);
      toast.success('Texto copiado.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No pudimos copiar.');
    }
  }

  /**
   * Web Share API. Estrategia:
   *   1. Si hay foto, intentamos compartir como File (incluye la imagen
   *      al lado del texto en WhatsApp).
   *   2. Si la fetch de la foto falla o el browser no soporta files,
   *      compartimos solo texto + URL del álbum.
   *   3. Si no hay Web Share, fallback a copy.
   */
  async function handleShare() {
    if (!snapshot) return;
    setSharing(true);
    try {
      const navAny = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };

      if (typeof navAny.share !== 'function') {
        await handleCopy();
        return;
      }

      // Intento 1: compartir con file (foto) si tenemos.
      if (snapshot.photoUrl && typeof navAny.canShare === 'function') {
        try {
          const res = await fetch(snapshot.photoUrl);
          if (res.ok) {
            const blob = await res.blob();
            const file = new File([blob], 'salu.jpg', {
              type: blob.type || 'image/jpeg',
            });
            const dataWithFile: ShareData = { text: snapshot.text, files: [file] };
            if (navAny.canShare(dataWithFile)) {
              await navAny.share(dataWithFile);
              return;
            }
          }
        } catch {
          // Fall through al modo texto.
        }
      }

      // Intento 2: solo texto.
      await navAny.share({ text: snapshot.text });
    } catch (err) {
      // El usuario canceló — no es un error.
      if ((err as Error).name !== 'AbortError') {
        toast.error('No pudimos abrir el compartir.');
      }
    } finally {
      setSharing(false);
    }
  }

  if (!snapshot) {
    return null;
  }

  return (
    <section className="animate-stagger-up flex flex-col gap-3" style={{ animationDelay: '320ms' }}>
      <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
        Mandar a la familia
      </h2>
      <Card className="flex flex-col gap-3 border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-4">
        <div className="flex items-start gap-3">
          {snapshot.photoUrl ? (
            <img
              src={snapshot.photoUrl}
              alt="Foto de hoy"
              className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-border/60"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
            >
              <Share2 className="size-6" />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="whitespace-pre-line text-foreground/90 text-sm leading-snug">
              {snapshot.text}
            </p>
            <p className="text-muted-foreground/70 text-xs">
              {snapshot.photoUrl
                ? 'Incluye la foto más reciente del día.'
                : 'Sin foto de hoy todavía.'}{' '}
              Generado a las {snapshot.generatedAtAr}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            onClick={handleShare}
            disabled={sharing}
            className="flex-1 sm:flex-initial"
          >
            {sharing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Share2 className="size-4" aria-hidden />
            )}
            Compartir
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied ? 'Copiado' : 'Copiar texto'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={refresh}
            disabled={refreshing}
            className="text-muted-foreground"
          >
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Actualizar
          </Button>
        </div>
      </Card>
    </section>
  );
}
