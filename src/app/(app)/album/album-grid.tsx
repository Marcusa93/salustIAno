'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Check,
  Copy,
  FolderOpen,
  ImageIcon,
  Link2,
  Link2Off,
  Loader2,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type AlbumEntry,
  type PhotoEntry,
  assignPhotoToAlbumAction,
  createManualAlbumAction,
  deletePhotoAction,
  getPhotoUrlAction,
  retagPhotoAction,
  revokeAlbumShareAction,
  shareAlbumAction,
  updatePhotoAction,
  uploadPhotosAction,
} from './actions';

interface MonthGroup {
  monthKey: string; // 'YYYY-MM'
  monthLabel: string;
  photos: PhotoEntry[];
}

interface AlbumGridProps {
  initialPhotos: PhotoEntry[];
  initialAlbums: AlbumEntry[];
}

const CLIENT_IMAGE_MAX_DIMENSION = 1800;
const CLIENT_IMAGE_QUALITY = 0.78;
const CLIENT_SKIP_COMPRESSION_UNDER_BYTES = 1.5 * 1024 * 1024;
const MAX_BATCH_UPLOAD_BYTES = 18 * 1024 * 1024;
const MAX_BATCH_UPLOAD_FILES = 4;

/**
 * Grid principal del álbum. Agrupa fotos por mes (taken_at o created_at),
 * acepta multi-upload, y al click sobre una foto abre un modal con
 * caption + tags editables.
 *
 * Las URLs firmadas se piden lazy: solo cuando una thumbnail entra al
 * viewport (IntersectionObserver) y al abrir el modal.
 */
export function AlbumGrid({ initialPhotos, initialAlbums }: AlbumGridProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [albums, setAlbums] = useState(initialAlbums);
  const [active, setActive] = useState<PhotoEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [creatingAlbum, startCreateAlbum] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const newAlbumRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  useEffect(() => {
    setAlbums(initialAlbums);
  }, [initialAlbums]);

  useEffect(() => {
    if (showCreateAlbum) {
      newAlbumRef.current?.focus();
    }
  }, [showCreateAlbum]);

  const albumCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of photos) {
      if (!photo.albumId) continue;
      counts.set(photo.albumId, (counts.get(photo.albumId) ?? 0) + 1);
    }
    return counts;
  }, [photos]);

  const albumsWithCounts = useMemo(
    () =>
      albums.map((album) => ({
        ...album,
        count: albumCounts.get(album.id) ?? 0,
      })),
    [albums, albumCounts],
  );

  const activeAlbum = albumsWithCounts.find((a) => a.id === activeAlbumId) ?? null;

  // Tags únicos del set actual de fotos, ordenados por frecuencia descendente
  // y luego alfabéticamente. Mostramos hasta 12 chips para no abarrotar la UI.
  const tagChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of photos) {
      for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    let result = photos;
    if (activeAlbumId) result = result.filter((p) => p.albumId === activeAlbumId);
    if (activeTag) result = result.filter((p) => p.tags.includes(activeTag));
    return result;
  }, [photos, activeTag, activeAlbumId]);

  const groups = groupByMonth(filteredPhotos);

  function handlePickFiles() {
    fileRef.current?.click();
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files);

    startUpload(async () => {
      setUploadStatus(
        `Optimizando ${selectedFiles.length} foto${selectedFiles.length === 1 ? '' : 's'}...`,
      );

      try {
        const optimizedFiles = await optimizeUploadFiles(selectedFiles);
        const batches = chunkUploadFiles(optimizedFiles);

        let uploaded = 0;
        let failed = 0;

        for (const [index, batch] of batches.entries()) {
          setUploadStatus(
            `Subiendo lote ${index + 1} de ${batches.length} (${batch.length} foto${batch.length === 1 ? '' : 's'})...`,
          );

          const fd = new FormData();
          for (const file of batch) {
            fd.append('photos', file);
          }

          const result = await uploadPhotosAction(fd);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }

          uploaded += result.uploaded;
          failed += result.failed;
        }

        if (uploaded === 0) {
          toast.error('No pudimos subir ninguna foto.');
          return;
        }

        const msg =
          failed > 0
            ? `Subimos ${uploaded}. ${failed} fallaron.`
            : `Subimos ${uploaded} foto${uploaded === 1 ? '' : 's'}.`;
        toast.success(msg);
        router.refresh();
      } finally {
        setUploadStatus(null);
      }
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleDelete(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (active?.id === id) setActive(null);
    void deletePhotoAction(id).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  }

  function handleUpdate(id: string, updates: { caption?: string; tags?: string[] }) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    void updatePhotoAction(id, updates).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  }

  function handleCreateAlbum() {
    const trimmed = newAlbumName.trim();
    if (trimmed.length === 0) return;

    startCreateAlbum(async () => {
      const result = await createManualAlbumAction(trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAlbums((prev) => [result.album, ...prev]);
      setActiveAlbumId(result.album.id);
      setNewAlbumName('');
      setShowCreateAlbum(false);
      toast.success(`Álbum "${result.album.name}" creado.`);
    });
  }

  function handleAssignPhotoToAlbum(photoId: string, albumId: string | null) {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, albumId } : p)));
    setActive((prev) => (prev && prev.id === photoId ? { ...prev, albumId } : prev));
    void assignPhotoToAlbumAction(photoId, albumId).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {photos.length === 0
            ? 'Subí las primeras fotos de Salu.'
            : activeAlbum
              ? `${filteredPhotos.length} foto${filteredPhotos.length === 1 ? '' : 's'} en ${activeAlbum.name}.`
              : activeTag
                ? `${filteredPhotos.length} foto${filteredPhotos.length === 1 ? '' : 's'} con #${activeTag}.`
                : `${photos.length} foto${photos.length === 1 ? '' : 's'} en ${groups.length} mes${groups.length === 1 ? '' : 'es'}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowCreateAlbum((prev) => !prev);
              setNewAlbumName('');
            }}
            disabled={creatingAlbum}
          >
            {creatingAlbum ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            {showCreateAlbum ? 'Cancelar' : 'Nuevo álbum'}
          </Button>
          <Button type="button" size="sm" onClick={handlePickFiles} disabled={uploading}>
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {uploading ? (uploadStatus ?? 'Subiendo...') : 'Subir fotos'}
          </Button>
        </div>
      </div>

      {showCreateAlbum && (
        <Card className="border-border/60 p-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateAlbum();
            }}
          >
            <Input
              ref={newAlbumRef}
              value={newAlbumName}
              onChange={(event) => setNewAlbumName(event.target.value)}
              placeholder="Nombre del álbum"
              maxLength={80}
              disabled={creatingAlbum}
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={creatingAlbum || newAlbumName.trim() === ''}
              >
                {creatingAlbum ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Crear
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCreateAlbum(false);
                  setNewAlbumName('');
                }}
                disabled={creatingAlbum}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {albums.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 pr-1 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
            <FolderOpen className="size-3" aria-hidden />
            Álbumes
          </span>
          <button
            type="button"
            onClick={() => setActiveAlbumId(null)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 font-medium text-[11px] transition-colors',
              activeAlbumId === null
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            Todos
          </button>
          {albumsWithCounts.map((al) => (
            <button
              key={al.id}
              type="button"
              onClick={() => setActiveAlbumId((prev) => (prev === al.id ? null : al.id))}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium text-[11px] transition-colors',
                activeAlbumId === al.id
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {al.shareToken && <Link2 className="size-3" aria-hidden />}
              {al.name}
              <span className="text-muted-foreground/70">{al.count}</span>
            </button>
          ))}
        </div>
      )}

      {activeAlbum && (
        <AlbumShareBar
          album={activeAlbum}
          onShared={(shareToken, sharedAt) =>
            setAlbums((prev) =>
              prev.map((a) => (a.id === activeAlbum.id ? { ...a, shareToken, sharedAt } : a)),
            )
          }
          onRevoked={() =>
            setAlbums((prev) =>
              prev.map((a) =>
                a.id === activeAlbum.id ? { ...a, shareToken: null, sharedAt: null } : a,
              ),
            )
          }
        />
      )}

      {tagChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 pr-1 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
            <Sparkles className="size-3" aria-hidden />
            Filtrar
          </span>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 font-medium text-[11px] transition-colors',
              activeTag === null
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            Todas
          </button>
          {tagChips.map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
              className={cn(
                'rounded-full border px-2.5 py-0.5 font-medium text-[11px] transition-colors',
                activeTag === tag
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tag}
              <span className="ml-1 text-muted-foreground/70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {photos.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10">
            <ImageIcon className="size-7" aria-hidden />
          </div>
          <p className="max-w-sm text-muted-foreground leading-relaxed">
            Todavía no hay fotos. Subí las primeras y se van a agrupar automáticamente por mes.
          </p>
          <Button type="button" onClick={handlePickFiles} disabled={uploading}>
            <Upload className="size-4" aria-hidden />
            Subir fotos
          </Button>
        </Card>
      ) : filteredPhotos.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-muted-foreground text-sm">No hay fotos con #{activeTag} todavía.</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setActiveTag(null)}>
            Quitar filtro
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.monthKey} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display font-medium text-foreground text-lg tracking-tight sm:text-xl">
                  {g.monthLabel}
                </h2>
                <span className="text-muted-foreground text-xs">
                  {g.photos.length} foto{g.photos.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {g.photos.map((p) => (
                  <Thumbnail key={p.id} photo={p} onClick={() => setActive(p)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {active && (
        <PhotoModal
          photo={active}
          albums={albums}
          onClose={() => setActive(null)}
          onDelete={() => handleDelete(active.id)}
          onUpdate={(updates) => {
            handleUpdate(active.id, updates);
            setActive((prev) => (prev ? { ...prev, ...updates } : prev));
          }}
          onAssignAlbum={(albumId) => handleAssignPhotoToAlbum(active.id, albumId)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// AlbumShareBar: cuando hay álbum activo, ofrece compartir/revocar.
// ----------------------------------------------------------------------------

function AlbumShareBar({
  album,
  onShared,
  onRevoked,
}: {
  album: AlbumEntry;
  onShared: (shareToken: string, sharedAt: string) => void;
  onRevoked: () => void;
}) {
  const [pending, startPending] = useTransition();
  const [copied, setCopied] = useState(false);

  const isShared = !!album.shareToken;
  const fullUrl =
    typeof window !== 'undefined' && album.shareToken
      ? `${window.location.origin}/compartir/album/${album.shareToken}`
      : '';

  function handleShare() {
    startPending(async () => {
      const result = await shareAlbumAction(album.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // El action devuelve la URL relativa; reconstruimos el token desde ahí.
      const token = result.url.split('/').pop() ?? '';
      onShared(token, new Date().toISOString());
      toast.success('Link generado.');
    });
  }

  function handleRevoke() {
    if (!window.confirm('¿Revocar el link? Quien lo tenga deja de poder ver el álbum.')) return;
    startPending(async () => {
      const result = await revokeAlbumShareAction(album.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onRevoked();
      toast.success('Link revocado.');
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Link copiado.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No pudimos copiar.');
    }
  }

  /**
   * Web Share API: en mobile abre el sheet nativo de compartir (WhatsApp,
   * Telegram, mail, etc.). En desktop sin soporte cae al copy del link.
   * Usuario cancelando el share NO es un error — lo silenciamos.
   */
  async function handleNativeShare() {
    const data = {
      title: `Álbum: ${album.name}`,
      text: `Mirá las fotos del álbum "${album.name}" de Salu:`,
      url: fullUrl,
    };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(data);
      } catch (err) {
        // El user canceló el sheet — no logueamos error.
        if ((err as Error).name !== 'AbortError') {
          toast.error('No pudimos abrir el compartir.');
        }
      }
      return;
    }
    // Fallback: copy.
    handleCopy();
  }

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Card className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center">
      {isShared ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-foreground text-sm">{album.name}</span>
            <span className="truncate text-muted-foreground text-xs">{fullUrl}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:flex-nowrap">
            {canNativeShare && (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleNativeShare}
                className="flex-1 sm:flex-initial"
              >
                <Share2 className="size-4" aria-hidden />
                Compartir
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="flex-1 sm:flex-initial"
            >
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRevoke}
              disabled={pending}
              className="flex-1 sm:flex-initial"
            >
              <Link2Off className="size-4" aria-hidden />
              Revocar
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-foreground text-sm">{album.name}</span>
            <span className="text-muted-foreground text-xs">
              Compartilo con la familia extensa con un link público sin login.
            </span>
          </div>
          <Button type="button" size="sm" onClick={handleShare} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Link2 className="size-4" aria-hidden />
            )}
            Compartir álbum
          </Button>
        </>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Thumbnail: lazy-load del signed URL cuando entra al viewport.
// ----------------------------------------------------------------------------

function Thumbnail({ photo, onClick }: { photo: PhotoEntry; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (url) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            getPhotoUrlAction(photo.storagePath).then((r) => {
              if (r.ok) setUrl(r.url);
            });
            obs.disconnect();
          }
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [photo.storagePath, url]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        'group relative aspect-square overflow-hidden rounded-xl bg-muted/40 transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
      )}
    >
      {url ? (
        <img
          src={url}
          alt={photo.caption ?? 'Foto'}
          className="size-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/40">
          <ImageIcon className="size-6" aria-hidden />
        </div>
      )}
      {(photo.tags.length > 0 || photo.caption) && (
        <span className="absolute right-0 bottom-0 left-0 truncate bg-gradient-to-t from-foreground/60 to-transparent p-2 text-left font-medium text-[11px] text-white">
          {photo.caption ?? photo.tags.slice(0, 2).join(' · ')}
        </span>
      )}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Modal de detalle: caption + tags editables, borrar.
// ----------------------------------------------------------------------------

function PhotoModal({
  photo,
  albums,
  onClose,
  onDelete,
  onUpdate,
  onAssignAlbum,
}: {
  photo: PhotoEntry;
  albums: AlbumEntry[];
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (updates: { caption?: string; tags?: string[] }) => void;
  onAssignAlbum: (albumId: string | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [tagsInput, setTagsInput] = useState(photo.tags.join(', '));
  const [retagging, startRetag] = useTransition();

  useEffect(() => {
    let mounted = true;
    getPhotoUrlAction(photo.storagePath).then((r) => {
      if (mounted && r.ok) setUrl(r.url);
    });
    return () => {
      mounted = false;
    };
  }, [photo.storagePath]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function saveCaption() {
    const next = caption.trim();
    if (next === (photo.caption ?? '')) return;
    onUpdate({ caption: next });
    toast.success('Caption guardado.');
  }

  function saveTags() {
    const next = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (JSON.stringify(next) === JSON.stringify(photo.tags)) return;
    onUpdate({ tags: next });
    toast.success('Tags guardadas.');
  }

  function handleDelete() {
    if (!window.confirm('¿Borrar esta foto del álbum? No se puede deshacer.')) return;
    onDelete();
  }

  function handleRetag() {
    if (
      photo.tags.length > 0 &&
      !window.confirm(
        '¿Pisar las etiquetas actuales con las que sugiera la IA? Lo que escribiste a mano se pierde.',
      )
    ) {
      return;
    }
    startRetag(async () => {
      const result = await retagPhotoAction(photo.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const newCaption = result.caption ?? '';
      setCaption(newCaption);
      setTagsInput(result.tags.join(', '));
      onUpdate({ tags: result.tags, caption: newCaption });
      toast.success('Etiquetas actualizadas con IA.');
    });
  }

  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Cerrar"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-foreground/60 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <span
        role="presentation"
        onClickCapture={(e) => e.stopPropagation()}
        className={cn(
          // Mobile: full-screen sin gaps ni rounded — la foto ocupa toda la
          // pantalla y abajo tiene el panel scrollable.
          'relative flex w-full flex-col overflow-hidden bg-card text-left shadow-2xl',
          // Mobile: full viewport con safe-area insets para iPhone notch.
          'h-[100dvh] max-h-none rounded-none',
          // Desktop: caja flotante centrada con altura cómoda.
          'sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:flex-row sm:gap-3 sm:rounded-2xl sm:p-4',
        )}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Cerrar"
          className={cn(
            // Mobile: tap target grande (44px+) sobre la foto, alto contraste.
            'absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-20 size-11 bg-background/85 shadow-md ring-1 ring-foreground/10 backdrop-blur-md',
            // Desktop: chiquito en la esquina del card.
            'sm:top-2 sm:right-2 sm:size-8 sm:bg-background/80 sm:shadow-none sm:ring-0 sm:backdrop-blur-none',
          )}
        >
          <X className="size-5 sm:size-4" aria-hidden />
        </Button>

        {/* Foto */}
        <div
          className={cn(
            // Mobile: la foto ocupa ~55% del alto disponible arriba.
            'flex shrink-0 items-center justify-center bg-foreground/[0.04]',
            'h-[55dvh] w-full',
            // Desktop: lado izquierdo del card, máx 60% del ancho, alto cómodo.
            'sm:h-auto sm:max-h-[80dvh] sm:max-w-[60%] sm:flex-1 sm:bg-transparent',
          )}
        >
          {url ? (
            <img
              src={url}
              alt={photo.caption ?? 'Foto'}
              className="size-full object-contain sm:rounded-xl"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground sm:aspect-square sm:rounded-xl sm:bg-muted/40">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          )}
        </div>

        {/* Detalles — scrollable en mobile, side-panel en desktop */}
        <div
          className={cn(
            'flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4',
            'pb-[max(1rem,env(safe-area-inset-bottom))]',
            'sm:px-3 sm:pb-0',
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              {photo.takenAt ? formatDate(photo.takenAt) : 'Sin fecha'}
            </span>
            <h3 className="font-display text-foreground text-lg tracking-tight sm:text-xl">
              {photo.caption || 'Sin descripción'}
            </h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-caption">Descripción</Label>
            <Textarea
              id="ph-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={saveCaption}
              rows={2}
              placeholder="Hoy, en los brazos de papá…"
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-tags">Etiquetas (separadas por coma)</Label>
            <Input
              id="ph-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={saveTags}
              placeholder="papa, primer baño, sonriendo"
              maxLength={300}
            />
            {photo.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {photo.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-album">Álbum</Label>
            <select
              id="ph-album"
              value={photo.albumId ?? ''}
              onChange={(e) => onAssignAlbum(e.target.value === '' ? null : e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 font-medium text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Sin álbum</option>
              {albums.map((al) => (
                <option key={al.id} value={al.id}>
                  {al.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleRetag}
              disabled={retagging}
            >
              {retagging ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {retagging ? 'Analizando…' : 'Auto-etiquetar'}
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" aria-hidden />
              Borrar foto
            </Button>
          </div>
        </div>
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function groupByMonth(photos: PhotoEntry[]): MonthGroup[] {
  const map = new Map<string, PhotoEntry[]>();
  for (const p of photos) {
    const ts = p.takenAt ?? p.createdAt;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(p);
  }
  // Sort keys desc.
  const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return keys.map((k) => ({
    monthKey: k,
    monthLabel: formatMonth(k),
    photos: map.get(k) ?? [],
  }));
}

async function optimizeUploadFiles(files: File[]): Promise<File[]> {
  const optimized: File[] = [];
  for (const file of files) {
    optimized.push(await compressUploadFile(file));
  }
  return optimized;
}

async function compressUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= CLIENT_SKIP_COMPRESSION_UNDER_BYTES) return file;

  try {
    const image = await loadImageFromFile(file);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale =
      longestSide > CLIENT_IMAGE_MAX_DIMENSION ? CLIENT_IMAGE_MAX_DIMENSION / longestSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    // El álbum es 100% fotográfico: si el browser re-encodea a JPEG,
    // priorizamos peso y velocidad sobre transparencia.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToJpegBlob(canvas);
    if (!blob || blob.size >= file.size * 0.95) return file;

    return new File([blob], replaceFileExtension(file.name, 'jpg'), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No pudimos abrir la imagen.'));
    };

    image.src = objectUrl;
  });
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', CLIENT_IMAGE_QUALITY);
  });
}

function replaceFileExtension(fileName: string, nextExtension: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '');
  return `${baseName || 'foto'}.${nextExtension}`;
}

function chunkUploadFiles(files: File[]): File[][] {
  const batches: File[][] = [];
  let currentBatch: File[] = [];
  let currentBatchBytes = 0;

  for (const file of files) {
    const wouldOverflowCount = currentBatch.length >= MAX_BATCH_UPLOAD_FILES;
    const wouldOverflowBytes =
      currentBatch.length > 0 && currentBatchBytes + file.size > MAX_BATCH_UPLOAD_BYTES;

    if (wouldOverflowCount || wouldOverflowBytes) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchBytes = 0;
    }

    currentBatch.push(file);
    currentBatchBytes += file.size;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function formatMonth(key: string): string {
  const [year, month] = key.split('-');
  if (!year || !month) return key;
  const d = new Date(Number(year), Number(month) - 1, 1);
  const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
