import { SaluLogo } from '@/components/salu/salu-logo';
import { babyAgeFromBirth } from '@/lib/baby-age';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { Baby, Clock, Droplets, Milk, Moon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Salu',
  robots: 'noindex, nofollow',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

function elapsed(since: string): string {
  const mins = Math.floor((Date.now() - new Date(since).getTime()) / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
}

export default async function SaluPublicPage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const requestClient = await createClient();
  const supabase = env.SUPABASE_SECRET_KEY ? createAdminClient() : requestClient;
  // biome-ignore lint/suspicious/noExplicitAny: share_token es columna nueva, types stale
  const sb = supabase as any;

  const { data: child } = await sb
    .from('child_profiles')
    .select('id, name, birth_date, family_group_id')
    .eq('share_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (!child) notFound();

  const childId = child.id as string;

  // Midnight ART = 03:00 UTC del mismo día UTC si UTC hour >= 3, si no del día anterior.
  const now = new Date();
  const dayStartUTC = new Date(now);
  dayStartUTC.setUTCHours(3, 0, 0, 0);
  if (now.getUTCHours() < 3) {
    dayStartUTC.setUTCDate(dayStartUTC.getUTCDate() - 1);
  }
  const since = dayStartUTC.toISOString();

  const [
    { data: activeSleep },
    { count: feedingCount },
    { count: diaperCount },
    { data: lastFeedings },
    { data: recentPhotos },
  ] = await Promise.all([
    supabase
      .from('sleep_sessions')
      .select('started_at, is_nap')
      .eq('child_id', childId)
      .is('ended_at', null)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('feeding_events')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId)
      .is('deleted_at', null)
      .gte('occurred_at', since),
    supabase
      .from('diaper_events')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId)
      .is('deleted_at', null)
      .gte('occurred_at', since),
    supabase
      .from('feeding_events')
      .select('occurred_at, amount_ml')
      .eq('child_id', childId)
      .is('deleted_at', null)
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(10),
    // biome-ignore lint/suspicious/noExplicitAny: media_items types stale
    (sb as any)
      .from('media_items')
      .select('id, storage_path')
      .eq('child_id', childId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const age = babyAgeFromBirth(child.birth_date as string | null);

  type FeedingRow = { occurred_at: string; amount_ml: number | null };
  const feedings = (lastFeedings as FeedingRow[] | null) ?? [];
  const lastFeedingAt = feedings[0]?.occurred_at ?? null;
  const withAmount = feedings.filter((f) => f.amount_ml);
  const avgAmount =
    withAmount.length > 0
      ? Math.round(withAmount.reduce((s, f) => s + (f.amount_ml ?? 0), 0) / withAmount.length)
      : null;

  type PhotoRow = { id: string; storage_path: string };
  const photos = (recentPhotos as PhotoRow[] | null) ?? [];
  const photoUrls = await Promise.all(
    photos.map(async (p) => {
      const { data } = await supabase.storage
        .from('photos')
        .createSignedUrl(p.storage_path, 60 * 60 * 24);
      return data?.signedUrl ?? null;
    }),
  );

  const sleeping = activeSleep != null;
  const isNap = (activeSleep as { is_nap?: boolean } | null)?.is_nap === true;
  const sleepStartedAt = (activeSleep as { started_at?: string } | null)?.started_at ?? null;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <SaluLogo className="h-6 opacity-60" />
        <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Baby className="size-9" aria-hidden />
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-foreground text-2xl">{child.name as string}</h1>
          {age && !age.unborn && <span className="text-muted-foreground text-sm">{age.label}</span>}
        </div>
      </div>

      {/* Estado actual */}
      <div
        className={`flex items-center gap-3 rounded-2xl border p-4 ${
          sleeping ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'
        }`}
      >
        {sleeping ? (
          <Moon className="size-5 shrink-0 text-primary" aria-hidden />
        ) : (
          <span className="size-5 shrink-0 text-xl" aria-hidden>
            ☀️
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground text-sm">
            {sleeping ? (isNap ? 'Durmiendo siesta' : 'Durmiendo') : 'Despierto/a'}
          </span>
          {sleeping && sleepStartedAt && (
            <span className="text-muted-foreground text-xs">hace {elapsed(sleepStartedAt)}</span>
          )}
          {!sleeping && lastFeedingAt && (
            <span className="text-muted-foreground text-xs">
              última toma hace {elapsed(lastFeedingAt)}
            </span>
          )}
        </div>
      </div>

      {/* Stats del día */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4">
          <Milk className="size-5 text-primary/70" aria-hidden />
          <span className="font-display text-foreground text-3xl">{feedingCount ?? 0}</span>
          <span className="text-center text-muted-foreground text-xs">
            {feedingCount === 1 ? 'toma hoy' : 'tomas hoy'}
            {avgAmount ? ` · ~${avgAmount} ml` : ''}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4">
          <Droplets className="size-5 text-primary/70" aria-hidden />
          <span className="font-display text-foreground text-3xl">{diaperCount ?? 0}</span>
          <span className="text-center text-muted-foreground text-xs">
            {diaperCount === 1 ? 'pañal hoy' : 'pañales hoy'}
          </span>
        </div>
      </div>

      {/* Fotos recientes */}
      {photoUrls.filter(Boolean).length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            Fotos recientes
          </h2>
          <div className="grid grid-cols-3 gap-1.5">
            {photoUrls
              .filter((u): u is string => u !== null)
              .map((url, i) => (
                <div key={url} className="aspect-square overflow-hidden rounded-xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Foto de ${child.name as string} ${i + 1}`}
                    className="size-full object-cover"
                    loading={i < 3 ? 'eager' : 'lazy'}
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-muted-foreground/60">
        <Clock className="size-3" aria-hidden />
        <span>
          Actualizado{' '}
          {now.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Argentina/Buenos_Aires',
          })}
        </span>
      </div>
    </div>
  );
}
