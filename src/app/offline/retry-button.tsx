'use client';

import { Button } from '@/components/ui/button';
import { getRetryTarget } from '@/lib/pwa/offline';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

function retry() {
  const target = getRetryTarget(window.location.pathname);
  if (target) window.location.assign(target);
  else window.location.reload();
}

/** Reintenta a mano, y solo apenas el navegador avisa que volvió la red. */
export function RetryButton() {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setRetrying(true);
      retry();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return (
    <Button
      type="button"
      size="lg"
      className="h-11 px-5"
      disabled={retrying}
      onClick={() => {
        setRetrying(true);
        retry();
      }}
    >
      {retrying ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="size-4" aria-hidden />
      )}
      Reintentar
    </Button>
  );
}
