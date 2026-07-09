'use client';

import {
  getShareTokenAction,
  revokeAndRegenerateShareTokenAction,
} from '@/app/(app)/familia/share-token-actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Copy, Eye, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export function ShareLinkCard() {
  const [token, setToken] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const shareUrl = token ? `${window.location.origin}/salu/${token}` : null;

  const load = useCallback(async () => {
    setLoading(true);
    const r = await getShareTokenAction();
    if (r.ok) {
      setToken(r.token);
      setCreatedAt(r.createdAt);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No pudimos copiar el link.');
    }
  }

  async function handleRegenerate() {
    if (!confirm('¿Querés cambiar el link? El anterior dejará de funcionar.')) return;
    setRegenerating(true);
    const r = await revokeAndRegenerateShareTokenAction();
    if (r.ok) {
      setToken(r.token);
      setCreatedAt(r.createdAt);
      toast.success('Link renovado.');
    } else {
      toast.error(r.error);
    }
    setRegenerating(false);
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Eye className="size-4" aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground text-sm">Link para la familia</span>
          <span className="text-muted-foreground text-xs">
            Cualquiera con este link puede ver el estado de Salu sin necesidad de cuenta.
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      ) : shareUrl ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs">
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copiar link"
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-green-600" aria-hidden />
                  <span className="text-green-600">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden />
                  Copiar
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between">
            {createdAt && (
              <span className="text-[10.5px] text-muted-foreground">
                Activo desde el {formatDate(createdAt)}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="ml-auto text-xs"
            >
              <RefreshCw className={`size-3.5 ${regenerating ? 'animate-spin' : ''}`} aria-hidden />
              {regenerating ? 'Cambiando…' : 'Cambiar link'}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
