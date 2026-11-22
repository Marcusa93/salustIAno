import { z } from 'zod';

/**
 * Endpoint de un servicio de push (FCM, Apple, Mozilla, WNS). Siempre https;
 * lo validamos porque viene del navegador y el server le va a hacer POST.
 */
export const pushEndpointSchema = z
  .string()
  .max(2048, 'Endpoint demasiado largo.')
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Endpoint inválido.');

/** `PushSubscription.toJSON()` + user agent, tal como lo manda /perfil. */
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
  userAgent: z.string().max(200).optional(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
