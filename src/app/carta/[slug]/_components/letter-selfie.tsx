'use client';

import type { Letter, LetterPhoto } from '@/lib/carta/manifest';
import { shrinkPhoto } from '@/lib/carta/shrink-photo';
import { cn } from '@/lib/utils';
import { Camera, Check, Loader2, RotateCcw } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState, useTransition } from 'react';
import { saveLetterPhotoAction } from '../actions';
import { Polaroid } from './polaroid';

type PhotoCopy = NonNullable<Letter['finale']['photo']>;

interface Shot {
  key: string;
  photo: LetterPhoto;
  status: 'saving' | 'saved' | 'error';
  error?: string;
  /** Solo las sacadas ahora: para reintentar si falla la subida. */
  upload?: { blob: Blob; width: number | null; height: number | null };
}

const TILTS = [-2.2, 1.8, -1.4, 2.4];

/**
 * "Faltaba una foto: la de hoy." Abre la cámara del celu (selector nativo,
 * frontal por defecto), muestra la foto como la última polaroid de la carta
 * y la guarda en el álbum. Las que ya se sacaron antes vuelven a aparecer.
 */
export function LetterSelfie({
  slug,
  copy,
  memories,
}: {
  slug: string;
  copy: PhotoCopy;
  memories: LetterPhoto[];
}) {
  const [shots, setShots] = useState<Shot[]>(() =>
    memories.map((photo) => ({ key: photo.src, photo, status: 'saved' })),
  );
  const [, startTransition] = useTransition();
  const objectUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const update = (key: string, patch: Partial<Shot>) =>
    setShots((prev) => prev.map((shot) => (shot.key === key ? { ...shot, ...patch } : shot)));

  const save = (key: string, upload: NonNullable<Shot['upload']>) => {
    update(key, { status: 'saving', error: undefined });
    startTransition(async () => {
      const formData = new FormData();
      formData.append(
        'photo',
        new File([upload.blob], 'carta.jpg', { type: upload.blob.type || 'image/jpeg' }),
      );
      formData.append('caption', copy.caption);
      if (upload.width) formData.append('width', String(upload.width));
      if (upload.height) formData.append('height', String(upload.height));
      const result = await saveLetterPhotoAction(slug, formData);
      update(key, result.ok ? { status: 'saved' } : { status: 'error', error: result.error });
    });
  };

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const upload = await shrinkPhoto(file);
    const src = URL.createObjectURL(upload.blob);
    objectUrls.current.push(src);
    const photo: LetterPhoto = {
      kind: 'photo',
      src,
      width: upload.width ?? 1200,
      height: upload.height ?? 1600,
      takenAt: new Date().toISOString(),
      alt: 'Mamá y Salu, el día de la carta.',
      caption: copy.caption,
    };
    setShots((prev) => [...prev, { key: src, photo, status: 'saving', upload }]);
    save(src, upload);
  };

  return (
    <section aria-label="Una foto para el final" className="flex flex-col items-center gap-8">
      <p className="text-balance font-hand text-[2.1rem] text-carta-night-foreground leading-tight">
        {copy.prompt}
      </p>

      {shots.map((shot, i) => (
        <div key={shot.key} className="flex w-full flex-col items-center gap-3">
          <Polaroid
            photo={shot.photo}
            tilt={TILTS[i % TILTS.length] ?? 0}
            size="lg"
            className="w-full max-w-[19rem]"
          />
          {shot.upload && (
            <p
              aria-live="polite"
              className={cn(
                'flex items-center gap-2 text-sm',
                shot.status === 'error' ? 'text-carta-rose' : 'text-carta-night-foreground/75',
              )}
            >
              {shot.status === 'saving' && (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Guardándola en el álbum…
                </>
              )}
              {shot.status === 'saved' && (
                <>
                  <Check className="size-4 text-carta-glow" aria-hidden />
                  {copy.saved}
                </>
              )}
              {shot.status === 'error' && (
                <>
                  {shot.error}
                  <button
                    type="button"
                    onClick={() => shot.upload && save(shot.key, shot.upload)}
                    className="inline-flex items-center gap-1 font-medium text-carta-glow underline underline-offset-4"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Reintentar
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      ))}

      {/* Label + input: en iOS es la forma más confiable de abrir la cámara. */}
      <label className="flex cursor-pointer items-center gap-2 rounded-full bg-carta-glow px-6 py-3.5 font-medium text-base text-carta-night shadow-[0_10px_30px_-10px_var(--carta-glow)] transition-transform focus-within:ring-4 focus-within:ring-carta-glow/50 active:scale-95">
        <Camera className="size-5" aria-hidden />
        {shots.length > 0 ? 'Sacar otra' : copy.button}
        <input type="file" accept="image/*" capture="user" onChange={onPick} className="sr-only" />
      </label>
    </section>
  );
}
