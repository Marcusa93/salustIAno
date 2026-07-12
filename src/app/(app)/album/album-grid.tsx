'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  ImageIcon,
  Link2,
  Link2Off,
  Loader2,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Square,
  Star,
  Trash2,
  Trophy,
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
  bulkAssignAlbumAction,
  bulkDeletePhotosAction,
  createManualAlbumAction,
  deleteAlbumAction,
  deletePhotoAction,
  getPhotoDownloadUrlAction,
  getPhotoUrlAction,
  renameAlbumAction,
  retagPhotoAction,
  revokeAlbumShareAction,
  setCoverPhotoAction,
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
  // Selección múltiple
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
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

  // Tags únicos ordenados por frecuencia descendente, máx 12 chips.
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

  function toggleSelectionMode() {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
    if (active) setActive(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `¿Borrar ${selectedIds.size} foto${selectedIds.size === 1 ? '' : 's'}? No se puede deshacer.`,
      )
    )
      return;
    const ids = Array.from(selectedIds);
    startBulk(async () => {
      const result = await bulkDeletePhotosAction(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setSelectionMode(false);
      toast.success(`Borramos ${result.deleted} foto${result.deleted === 1 ? '' : 's'}.`);
    });
  }

  function handleBulkAssign(albumId: string | null) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    startBulk(async () => {
      const result = await bulkAssignAlbumAction(ids, albumId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPhotos((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, albumId } : p)));
      setSelectedIds(new Set());
      setSelectionMode(false);
      const albumName = albumId
        ? (albums.find((a) => a.id === albumId)?.name ?? 'el álbum')
        : 'sin álbum';
      toast.success(
        `Movimos ${result.updated} foto${result.updated === 1 ? '' : 's'} a ${albumName}.`,
      );
    });
  }

  function handleSetCover(albumId: string, storagePath: string) {
    void setCoverPhotoAction(albumId, storagePath).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setAlbums((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, coverPath: storagePath } : a)),
      );
      toast.success('Portada actualizada.');
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
          {photos.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant={selectionMode ? 'secondary' : 'ghost'}
              onClick={toggleSelectionMode}
              disabled={uploading || bulkPending}
            >
              <Square className="size-4" aria-hidden />
              {selectionMode ? 'Cancelar selección' : 'Seleccionar'}
            </Button>
          )}
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

      {/* Barra de acciones en bulk */}
      {selectionMode && (
        <Card className="flex flex-wrap items-center gap-3 border-primary/25 bg-primary/[0.04] p-3">
          <span className="font-medium text-foreground text-sm">
            {selectedIds.size === 0
              ? 'Tocá una foto para seleccionarla.'
              : `${selectedIds.size} foto${selectedIds.size === 1 ? '' : 's'} seleccionada${selectedIds.size === 1 ? '' : 's'}`}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {selectedIds.size > 0 && (
              <>
                <select
                  aria-label="Mover selección a álbum"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__placeholder__') return;
                    handleBulkAssign(v === '__pool__' ? null : v);
                  }}
                  value="__placeholder__"
                  disabled={bulkPending}
                  className="h-8 rounded-lg border border-input bg-background px-2 font-medium text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="__placeholder__" disabled>
                    Mover a…
                  </option>
                  <option value="__pool__">Sin álbum</option>
                  {albums.map((al) => (
                    <option key={al.id} value={al.id}>
                      {al.kind === 'milestone'
                        ? `🏆 ${al.name}`
                        : al.kind === 'monthly'
                          ? `📅 ${al.name}`
                          : al.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkPending}
                >
                  {bulkPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" aria-hidden />
                  )}
                  Borrar
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

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
          {albumsWithCounts
            .slice()
            .sort((a, b) => {
              // milestone primero, ordenados por nombre ("1 mes" < "2 meses" etc.)
              if (a.kind === 'milestone' && b.kind !== 'milestone') return -1;
              if (b.kind === 'milestone' && a.kind !== 'milestone') return 1;
              if (a.kind === 'milestone' && b.kind === 'milestone') {
                return parseMilestoneIndex(a.name) - parseMilestoneIndex(b.name);
              }
              return 0;
            })
            .map((al) => (
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
                {al.kind === 'milestone' && <Trophy className="size-3" aria-hidden />}
                {al.shareToken && al.kind !== 'milestone' && (
                  <Link2 className="size-3" aria-hidden />
                )}
                {al.coverPath && al.kind !== 'milestone' && (
                  <Star className="size-3 fill-current" aria-hidden />
                )}
                {al.name}
                <span className="text-muted-foreground/70">{al.count}</span>
              </button>
            ))}
        </div>
      )}

      {activeAlbum && (
        <div className="flex flex-col gap-2.5">
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
          {activeAlbum.kind === 'manual' && (
            <ManualAlbumActions
              album={activeAlbum}
              onRenamed={(newName) =>
                setAlbums((prev) =>
                  prev.map((a) => (a.id === activeAlbum.id ? { ...a, name: newName } : a)),
                )
              }
              onDeleted={() => {
                setAlbums((prev) => prev.filter((a) => a.id !== activeAlbum.id));
                setPhotos((prev) =>
                  prev.map((p) => (p.albumId === activeAlbum.id ? { ...p, albumId: null } : p)),
                );
                setActiveAlbumId(null);
              }}
            />
          )}
        </div>
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
        <Card className="flex flex-col items-center gap-5 border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card p-10 text-center sm:p-12">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
            <ImageIcon className="size-8" aria-hidden />
          </div>
          <div className="flex max-w-md flex-col gap-2">
            <h3 className="font-display text-foreground text-xl tracking-tight">
              Empezá el álbum de Salu.
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Subí varias fotos a la vez. Se agrupan automáticamente por mes ("Mayo 2026", "Junio
              2026"…). Si querés un álbum propio para un hito (cumpleaños, viaje), lo creás con
              "Nuevo álbum".
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Cualquier álbum se puede compartir con la familia que no usa la app: te genera un link
              público (sin login) que mandás por WhatsApp.
            </p>
          </div>
          <Button type="button" size="lg" onClick={handlePickFiles} disabled={uploading}>
            <Upload className="size-4" aria-hidden />
            Subir las primeras fotos
          </Button>
          <p className="text-muted-foreground/80 text-xs">
            También podés mandarle una foto al chat de SalustIA y queda guardada acá.
          </p>
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
                  <Thumbnail
                    key={p.id}
                    photo={p}
                    onClick={selectionMode ? () => toggleSelect(p.id) : () => setActive(p)}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(p.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {active && (
        <PhotoModal
          key={active.id}
          photo={active}
          photos={filteredPhotos}
          albums={albums}
          onClose={() => setActive(null)}
          onDelete={() => handleDelete(active.id)}
          onUpdate={(updates) => {
            handleUpdate(active.id, updates);
            setActive((prev) => (prev ? { ...prev, ...updates } : prev));
          }}
          onAssignAlbum={(albumId) => handleAssignPhotoToAlbum(active.id, albumId)}
          onNavigate={(photo) => setActive(photo)}
          onSetCover={handleSetCover}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// AlbumShareBar
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
        if ((err as Error).name !== 'AbortError') {
          toast.error('No pudimos abrir el compartir.');
        }
      }
      return;
    }
    handleCopy();
  }

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const sharedSinceLabel = album.sharedAt
    ? new Date(album.sharedAt).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    : null;

  return (
    <Card className="flex flex-col gap-3 border-primary/25 bg-gradient-to-br from-primary/[0.06] to-card p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/15">
        {isShared ? (
          <Link2 className="size-5" aria-hidden />
        ) : (
          <Share2 className="size-5" aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {isShared ? (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground text-sm">
                "{album.name}" — link activo
                {sharedSinceLabel ? ` desde el ${sharedSinceLabel}` : ''}
              </span>
              <span className="line-clamp-1 break-all text-muted-foreground text-xs">
                {fullUrl}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {canNativeShare && (
                <Button type="button" size="sm" variant="default" onClick={handleNativeShare}>
                  <Share2 className="size-4" aria-hidden />
                  Compartir
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copied ? 'Copiado' : 'Copiar link'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                render={
                  <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    Ver cómo se ve
                  </a>
                }
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRevoke}
                disabled={pending}
                className="text-muted-foreground"
              >
                <Link2Off className="size-4" aria-hidden />
                Revocar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground text-sm">Compartir "{album.name}"</span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                Generamos un link público (sin login) para mandar por WhatsApp a la familia que no
                usa la app. Lo podés revocar cuando quieras.
              </span>
            </div>
            <div>
              <Button type="button" size="sm" onClick={handleShare} disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Link2 className="size-4" aria-hidden />
                )}
                Generar link de este álbum
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// ManualAlbumActions
// ----------------------------------------------------------------------------

function ManualAlbumActions({
  album,
  onRenamed,
  onDeleted,
}: {
  album: AlbumEntry;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(album.name);
  const [pending, startPending] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function handleRename() {
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      toast.error('El nombre no puede estar vacío.');
      return;
    }
    if (trimmed === album.name) {
      setEditing(false);
      return;
    }
    startPending(async () => {
      const result = await renameAlbumAction(album.id, trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onRenamed(trimmed);
      setEditing(false);
      toast.success('Álbum renombrado.');
    });
  }

  function handleDelete() {
    const ok = window.confirm(
      `¿Eliminar el álbum "${album.name}"? Las fotos no se borran — vuelven al pool general (sin álbum).`,
    );
    if (!ok) return;
    startPending(async () => {
      const result = await deleteAlbumAction(album.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDeleted();
      toast.success('Álbum eliminado.');
    });
  }

  if (editing) {
    return (
      <Card className="flex flex-col gap-2 border-border/60 p-3 sm:flex-row sm:items-center">
        <Input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleRename();
            }
            if (e.key === 'Escape') {
              setDraftName(album.name);
              setEditing(false);
            }
          }}
          maxLength={80}
          disabled={pending}
          className="flex-1"
          aria-label="Nuevo nombre del álbum"
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleRename} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Guardar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraftName(album.name);
              setEditing(false);
            }}
            disabled={pending}
          >
            Cancelar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex items-center gap-2 border-border/60 p-2 pl-3">
      <span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-[0.18em]">
        Álbum manual
      </span>
      <div className="ml-auto flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          disabled={pending}
        >
          <Pencil className="size-4" aria-hidden />
          Renombrar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={pending}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
          Eliminar
        </Button>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Thumbnail: lazy signed URL + overlay de selección en modo bulk.
// ----------------------------------------------------------------------------

function Thumbnail({
  photo,
  onClick,
  selectionMode = false,
  selected = false,
}: {
  photo: PhotoEntry;
  onClick: () => void;
  selectionMode?: boolean;
  selected?: boolean;
}) {
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
        selected && 'ring-2 ring-primary ring-offset-1',
      )}
    >
      {url ? (
        <img
          src={url}
          alt={photo.caption ?? 'Foto'}
          className={cn(
            'size-full object-cover transition-transform',
            !selectionMode && 'group-hover:scale-105',
            selected && 'brightness-90',
          )}
          loading="lazy"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/40">
          <ImageIcon className="size-6" aria-hidden />
        </div>
      )}

      {/* Overlay de selección */}
      {selectionMode && (
        <div
          className={cn(
            'absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded-full border-2 transition-all',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-white/80 bg-black/20',
          )}
          aria-hidden
        >
          {selected && <Check className="size-3" aria-hidden />}
        </div>
      )}

      {/* Caption/tags overlay — solo en modo normal */}
      {!selectionMode && (photo.tags.length > 0 || photo.caption) && (
        <span className="absolute right-0 bottom-0 left-0 truncate bg-gradient-to-t from-foreground/60 to-transparent p-2 text-left font-medium text-[11px] text-white">
          {photo.caption ?? photo.tags.slice(0, 2).join(' · ')}
        </span>
      )}
    </button>
  );
}

// ----------------------------------------------------------------------------
// PhotoModal — lightbox con navegación, descarga y portada.
// ----------------------------------------------------------------------------

function PhotoModal({
  photo,
  photos,
  albums,
  onClose,
  onDelete,
  onUpdate,
  onAssignAlbum,
  onNavigate,
  onSetCover,
}: {
  photo: PhotoEntry;
  photos: PhotoEntry[];
  albums: AlbumEntry[];
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (updates: { caption?: string; tags?: string[] }) => void;
  onAssignAlbum: (albumId: string | null) => void;
  onNavigate: (photo: PhotoEntry) => void;
  onSetCover: (albumId: string, storagePath: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [tagsInput, setTagsInput] = useState(photo.tags.join(', '));
  const [retagging, startRetag] = useTransition();
  const [downloading, setDownloading] = useState(false);

  const currentIndex = photos.findIndex((p) => p.id === photo.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;
  const total = photos.length;

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
      if (e.key === 'ArrowLeft' && hasPrev) {
        const prev = photos[currentIndex - 1];
        if (prev) onNavigate(prev);
      }
      if (e.key === 'ArrowRight' && hasNext) {
        const next = photos[currentIndex + 1];
        if (next) onNavigate(next);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, hasPrev, hasNext, currentIndex, photos]);

  function saveCaption() {
    const next = caption.trim();
    if (next === (photo.caption ?? '')) return;
    onUpdate({ caption: next });
    toast.success('Descripción guardada.');
  }

  function saveTags() {
    const next = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (JSON.stringify(next) === JSON.stringify(photo.tags)) return;
    onUpdate({ tags: next });
    toast.success('Etiquetas guardadas.');
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

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const slug = (photo.caption ?? photo.takenAt ?? 'foto')
        .replace(/[^a-z0-9áéíóúüñ]/gi, '-')
        .toLowerCase()
        .slice(0, 40)
        .replace(/-+$/, '');
      const filename = `salu-${slug}.jpg`;
      const result = await getPhotoDownloadUrlAction(photo.storagePath, filename);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const a = document.createElement('a');
      a.href = result.url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error('No pudimos descargar la foto.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <dialog
      open
      aria-modal="true"
      aria-label="Detalle de foto"
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-stretch justify-center bg-transparent text-foreground sm:items-center sm:p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 bg-foreground/60 backdrop-blur-sm"
      />
      <div
        className={cn(
          'relative z-10 flex w-full flex-col overflow-hidden bg-card text-left shadow-2xl',
          'h-[100dvh] max-h-none rounded-none',
          'sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:flex-row sm:gap-3 sm:rounded-2xl sm:p-4',
        )}
      >
        {/* Botón cerrar */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Cerrar"
          className={cn(
            'absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-20 size-11 bg-background/85 shadow-md ring-1 ring-foreground/10 backdrop-blur-md',
            'sm:top-2 sm:right-2 sm:size-8 sm:bg-background/80 sm:shadow-none sm:ring-0 sm:backdrop-blur-none',
          )}
        >
          <X className="size-5 sm:size-4" aria-hidden />
        </Button>

        {/* Contador de posición */}
        {total > 1 && (
          <span
            className={cn(
              'absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-20 rounded-full bg-background/85 px-2.5 py-1 font-mono text-[11px] text-muted-foreground shadow-md backdrop-blur-md',
              'sm:top-2 sm:left-2',
            )}
          >
            {currentIndex + 1} / {total}
          </span>
        )}

        {/* Foto + botones de navegación */}
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center bg-foreground/[0.04]',
            'h-[48dvh] w-full',
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

          {/* Flecha anterior */}
          {hasPrev && (
            <button
              type="button"
              onClick={() => {
                const prev = photos[currentIndex - 1];
                if (prev) onNavigate(prev);
              }}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm transition-all hover:bg-background hover:shadow-lg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </button>
          )}

          {/* Flecha siguiente */}
          {hasNext && (
            <button
              type="button"
              onClick={() => {
                const next = photos[currentIndex + 1];
                if (next) onNavigate(next);
              }}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm transition-all hover:bg-background hover:shadow-lg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Panel de detalles + botonera: wrapper transparente en mobile, columna en desktop */}
        <div className="contents sm:flex sm:min-w-0 sm:flex-1 sm:flex-col sm:overflow-hidden">
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-0',
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

            <div className="flex flex-col gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.04] p-3">
              <Label htmlFor="ph-album" className="flex items-center gap-1.5 text-foreground">
                <FolderOpen className="size-4 text-primary" aria-hidden />
                Mover a otro álbum
              </Label>
              <select
                id="ph-album"
                value={photo.albumId ?? ''}
                onChange={(e) => onAssignAlbum(e.target.value === '' ? null : e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2.5 font-medium text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Sin álbum (pool general)</option>
                {albums.map((al) => (
                  <option key={al.id} value={al.id}>
                    {al.kind === 'milestone'
                      ? `🏆 ${al.name}`
                      : al.kind === 'monthly'
                        ? `📅 ${al.name}`
                        : al.name}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Se guarda al instante. Si querés un álbum nuevo, creá uno desde la grilla con "Nuevo
                álbum" y volvé acá a moverla.
              </p>
            </div>
          </div>
          {/* Botonera fuera del scroll — siempre visible */}
          <div
            className={cn(
              'shrink-0 flex flex-wrap gap-2 border-t border-border/40 bg-card px-4 py-3',
              'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
              'sm:border-t-0 sm:bg-transparent sm:px-3 sm:pb-3 sm:pt-2',
            )}
          >
            {/* Descargar foto */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={!url || downloading}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              {downloading ? 'Descargando…' : 'Descargar'}
            </Button>

            {/* Usar como portada */}
            {photo.albumId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSetCover(photo.albumId as string, photo.storagePath)}
              >
                <Star className="size-4" aria-hidden />
                Portada del álbum
              </Button>
            )}

            {/* Auto-etiquetar IA */}
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

            {/* Borrar */}
            <Button type="button" size="sm" variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" aria-hidden />
              Borrar foto
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function parseMilestoneIndex(name: string): number {
  const m = /^(\d+)/.exec(name);
  return m ? Number(m[1]) : 999;
}

function groupByMonth(photos: PhotoEntry[]): MonthGroup[] {
  const map = new Map<string, PhotoEntry[]>();
  for (const p of photos) {
    const ts = p.takenAt ?? p.createdAt;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(p);
  }
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
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, 15, 12, 0, 0));
  const label = d.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}
