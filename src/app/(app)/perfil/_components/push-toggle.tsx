'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  getPushConfigAction,
  sendTestPushAction,
  subscribeUserToPushAction,
  unsubscribeUserFromPushAction,
} from '../push-actions';

interface State {
  loading: boolean;
  supported: boolean;
  permission: NotificationPermission | null;
  subscribed: boolean;
  publicKey: string | null;
  serverConfigured: boolean;
}

const INITIAL_STATE: State = {
  loading: true,
  supported: false,
  permission: null,
  subscribed: false,
  publicKey: null,
  serverConfigured: false,
};

/**
 * Convierte la public VAPID key (base64url) al ArrayBuffer que espera
 * `pushManager.subscribe`. Implementación canónica. Devolvemos el .buffer
 * concreto para evitar el lío de SharedArrayBuffer en algunos types lib.
 */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function PushToggle() {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [pending, startPending] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (typeof window === 'undefined') return;

      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) {
        if (!cancelled) setState({ ...INITIAL_STATE, loading: false });
        return;
      }

      const config = await getPushConfigAction();
      const permission = Notification.permission;

      // Registramos SW best-effort. Si falla, dejamos el toggle visible
      // pero las suscripciones rechazan después.
      let subscribed = false;
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const existing = await reg.pushManager.getSubscription();
        subscribed = existing !== null;
      } catch {
        /* SW puede fallar en http: o en modo privado */
      }

      if (cancelled) return;
      setState({
        loading: false,
        supported,
        permission,
        subscribed,
        publicKey: config.publicKey,
        serverConfigured: config.isConfigured,
      });
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubscribe() {
    if (!state.publicKey) {
      toast.error('El admin todavía no configuró las notificaciones.');
      return;
    }
    startPending(async () => {
      try {
        const permission =
          Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Necesitamos permiso para enviarte notificaciones.');
          setState((s) => ({ ...s, permission }));
          return;
        }

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBuffer(state.publicKey ?? ''),
        });

        const json = sub.toJSON() as {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        };
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          toast.error('La suscripción del navegador no devolvió las claves esperadas.');
          return;
        }

        const result = await subscribeUserToPushAction({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent.slice(0, 200),
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setState((s) => ({ ...s, subscribed: true, permission: 'granted' }));
        toast.success('Listo, vas a recibir avisos.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No pudimos activar las notificaciones.');
      }
    });
  }

  function handleUnsubscribe() {
    startPending(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await unsubscribeUserFromPushAction(sub.endpoint);
        }
        setState((s) => ({ ...s, subscribed: false }));
        toast.success('Notificaciones desactivadas en este device.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No pudimos desactivar.');
      }
    });
  }

  function handleTest() {
    startPending(async () => {
      const result = await sendTestPushAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Mandamos la prueba a ${result.sent} device(s).`);
    });
  }

  if (state.loading) return null;

  if (!state.supported) {
    return (
      <Card className="flex items-start gap-3 p-4">
        <BellOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-foreground">Notificaciones no disponibles</p>
          <p className="text-muted-foreground text-xs">
            Tu navegador no soporta web push. En iPhone tenés que instalar Salu primero como app
            (Compartir → Agregar a la pantalla de inicio) y abrirla desde ahí.
          </p>
        </div>
      </Card>
    );
  }

  if (!state.serverConfigured) {
    return (
      <Card className="flex items-start gap-3 p-4">
        <BellOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-foreground">Notificaciones todavía no disponibles</p>
          <p className="text-muted-foreground text-xs">
            El admin tiene que configurar las claves VAPID en el servidor antes de poder activarlas.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          {state.subscribed ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-medium text-foreground text-sm">Notificaciones en este device</p>
          <p className="text-muted-foreground text-xs">
            {state.subscribed
              ? 'Vas a recibir avisos de la familia y de Salu.'
              : 'Activá los avisos para enterarte cuando alguien anote algo nuevo.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state.subscribed ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Bell className="size-4" aria-hidden />
              )}
              Probar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleUnsubscribe}
              disabled={pending}
            >
              <BellOff className="size-4" aria-hidden />
              Desactivar
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" onClick={handleSubscribe} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Bell className="size-4" aria-hidden />
            )}
            Activar
          </Button>
        )}
      </div>
    </Card>
  );
}
