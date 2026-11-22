'use client';

import { IosInstallSteps } from '@/components/pwa/ios-install-steps';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type PwaPlatform, readDeviceInfo } from '@/lib/pwa/platform';
import {
  type PushAvailability,
  type PushStatus,
  describeSubscribeError,
  getPushAvailability,
  readPushApis,
  resolvePushStatus,
  subscriptionMatchesKey,
  urlBase64ToUint8Array,
} from '@/lib/pwa/push-support';
import { registerServiceWorker } from '@/lib/pwa/service-worker';
import { cn } from '@/lib/utils';
import { Bell, BellOff, BellRing, Loader2, RefreshCw, Send } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  sendTestPushAction,
  subscribeUserToPushAction,
  unsubscribeUserFromPushAction,
} from '../push-actions';

interface Props {
  /** Public VAPID key (null si el server no la tiene). */
  publicKey: string | null;
  /** El server tiene las dos claves VAPID y puede mandar pushes. */
  serverConfigured: boolean;
}

const STATUS_LABEL: Record<PushStatus | 'checking', string> = {
  checking: 'Revisando…',
  on: 'Activadas',
  off: 'Apagadas',
  denied: 'Bloqueadas',
  'ios-install-required': 'Falta instalar',
  'ios-update-required': 'Falta actualizar',
  unsupported: 'No disponible',
  'server-off': 'No disponible',
};

const STATUS_DESCRIPTION: Record<PushStatus | 'checking', string> = {
  checking: 'Revisando este dispositivo…',
  on: 'Te llegan los avisos de la familia y los recordatorios de Salu.',
  off: 'Activalos para enterarte cuando alguien anota algo o toca un recordatorio.',
  denied: 'Bloqueaste los avisos para Salu. Para volver a activarlos:',
  'ios-install-required':
    'En iPhone los avisos solo funcionan con Salu instalada como app. Instalala así:',
  'ios-update-required':
    'Este iPhone tiene una versión de iOS sin notificaciones web. Actualizalo a iOS 16.4 o más nuevo desde Ajustes → General → Actualización de software.',
  unsupported:
    'Este navegador no soporta notificaciones web. Probá con Chrome en Android, o con Salu instalada en el iPhone.',
  'server-off':
    'Falta configurar las claves de notificaciones (VAPID) en el servidor. Avisale al admin.',
};

const UNBLOCK_STEPS: Record<PwaPlatform, string> = {
  ios: 'Ajustes del iPhone → Notificaciones → Salu → Permitir notificaciones. Después volvé acá.',
  android:
    'Mantené apretado el ícono de Salu → Información de la app → Notificaciones → Permitir. Si la usás en Chrome: candado junto a la dirección → Permisos → Notificaciones.',
  other:
    'Tocá el candado (o el ícono de ajustes) junto a la dirección → Notificaciones → Permitir, y recargá la página.',
};

function serializeSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    userAgent: navigator.userAgent.slice(0, 200),
  };
}

function keyOf(subscription: PushSubscription): ArrayBuffer | null {
  return subscription.options?.applicationServerKey ?? null;
}

/**
 * Tarjeta de notificaciones de /perfil. Muestra en qué estado está ESTE
 * dispositivo (falta instalar, bloqueadas, apagadas, activadas) y qué hacer
 * en cada caso. Con avisos activos ofrece "Mandarme una de prueba", que le
 * pega solo a este dispositivo para confirmar que llegan de verdad.
 */
export function PushToggle({ publicKey, serverConfigured }: Props) {
  const [availability, setAvailability] = useState<PushAvailability | null>(null);
  const [platform, setPlatform] = useState<PwaPlatform>('other');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function inspectDevice() {
      const device = readDeviceInfo();
      const nextAvailability = getPushAvailability(device, readPushApis());
      let nextPermission: NotificationPermission = 'default';
      let current: PushSubscription | null = null;

      if (nextAvailability === 'available') {
        nextPermission = Notification.permission;
        const registration = await registerServiceWorker();
        current = (await registration?.pushManager.getSubscription()) ?? null;

        if (current && publicKey && !subscriptionMatchesKey(keyOf(current), publicKey)) {
          // Se hizo con claves VAPID viejas: el server ya no puede usarla.
          const stale = current;
          current = null;
          await stale.unsubscribe().catch(() => false);
          void unsubscribeUserFromPushAction(stale.endpoint);
        }
        if (current && nextPermission === 'granted' && serverConfigured) {
          // Re-sincronizamos por si la fila del server se perdió o se invalidó.
          void subscribeUserToPushAction(serializeSubscription(current));
        }
      }

      if (cancelled) return;
      setPlatform(device.platform);
      setPermission(nextPermission);
      setSubscription(current);
      setAvailability(nextAvailability);
    }

    void inspectDevice();
    return () => {
      cancelled = true;
    };
  }, [publicKey, serverConfigured]);

  const status: PushStatus | 'checking' =
    availability === null
      ? 'checking'
      : resolvePushStatus({
          availability,
          serverConfigured: serverConfigured && publicKey !== null,
          permission,
          subscribed: subscription !== null,
        });

  function handleEnable() {
    if (!publicKey) return;
    // iOS exige que el pedido de permiso salga en el mismo toque, antes de
    // cualquier await. Por eso lo disparamos acá y lo esperamos adentro.
    const permissionRequest: Promise<NotificationPermission> =
      Notification.permission === 'granted'
        ? Promise.resolve('granted')
        : Notification.requestPermission();

    startTransition(async () => {
      try {
        const result = await permissionRequest;
        setPermission(result);
        if (result !== 'granted') {
          if (result === 'denied')
            toast.error('Quedaron bloqueados. Abajo te contamos cómo habilitarlos.');
          return;
        }

        if (!(await registerServiceWorker())) {
          toast.error('No pudimos preparar Salu para recibir avisos en este navegador.');
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        let current = await registration.pushManager.getSubscription();
        if (current && !subscriptionMatchesKey(keyOf(current), publicKey)) {
          await current.unsubscribe();
          current = null;
        }
        current ??= await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const saved = await subscribeUserToPushAction(serializeSubscription(current));
        if (!saved.ok) {
          toast.error(saved.error);
          return;
        }
        setSubscription(current);
        setTestSent(false);
        toast.success('Listo: este dispositivo va a recibir avisos.');
      } catch (error) {
        toast.error(describeSubscribeError(error));
      }
    });
  }

  function handleDisable() {
    const current = subscription;
    startTransition(async () => {
      if (current) {
        await current.unsubscribe().catch(() => false);
        await unsubscribeUserFromPushAction(current.endpoint);
      }
      setSubscription(null);
      setTestSent(false);
      toast.success('Listo, este dispositivo no recibe más avisos.');
    });
  }

  function handleTest() {
    const current = subscription;
    if (!current) return;
    startTransition(async () => {
      const result = await sendTestPushAction(current.endpoint);
      if (result.ok) {
        setTestSent(true);
        toast.success('Prueba enviada. Debería llegarte en unos segundos.');
        return;
      }
      toast.error(result.error);
      if (result.resubscribe) {
        await current.unsubscribe().catch(() => false);
        setSubscription(null);
      }
    });
  }

  const isOn = status === 'on';

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          {isOn ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium text-foreground text-sm">
              Notificaciones en este dispositivo
            </h2>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[11px]',
                isOn && 'bg-primary/12 text-primary',
                status === 'denied' && 'bg-destructive/10 text-destructive',
                !isOn && status !== 'denied' && 'bg-muted text-muted-foreground',
              )}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {STATUS_DESCRIPTION[status]}
          </p>
        </div>
      </div>

      {status === 'ios-install-required' && (
        <IosInstallSteps
          className="pl-[3.25rem]"
          finalStep="Abrí Salu desde el ícono nuevo, entrá a Mi cuenta y tocá Activar avisos."
        />
      )}

      {status === 'denied' && (
        <div className="flex flex-col gap-3 pl-12">
          <p className="text-muted-foreground text-xs leading-relaxed">{UNBLOCK_STEPS[platform]}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => window.location.reload()}
          >
            <RefreshCw aria-hidden />
            Ya lo cambié, revisar de nuevo
          </Button>
        </div>
      )}

      {status === 'off' && (
        <Button
          type="button"
          size="lg"
          className="self-start"
          onClick={handleEnable}
          disabled={pending}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Bell aria-hidden />}
          Activar avisos
        </Button>
      )}

      {isOn && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" onClick={handleTest} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              Mandarme una de prueba
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={handleDisable}
              disabled={pending}
            >
              <BellOff aria-hidden />
              Desactivar
            </Button>
          </div>
          {testSent && (
            <p className="text-muted-foreground text-xs leading-relaxed" aria-live="polite">
              ¿No llegó? Revisá que No molestar o Concentración estén apagados y que Salu tenga
              permiso en los ajustes de notificaciones del celu.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
