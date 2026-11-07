import { SpotifyEmbed } from '@/components/salu/spotify-embed';
import { YouTubeEmbed } from '@/components/salu/youtube-embed';
import { sinceLabel } from '@/lib/home-now';
import { cn } from '@/lib/utils';
import { ArrowRight, BookOpen, Moon, Music, Music2, Sparkles, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { listLullabiesAction } from './cancion/actions';
import { listStoriesAction } from './cuento/actions';

export const metadata: Metadata = {
  title: 'Diversión',
};

/**
 * Playlist de Spotify de la familia. Cuando Marco/Abril armen otra
 * para un momento distinto, basta con sumar otra entrada acá. Las URL
 * tienen que ser de spotify.com — el componente se encarga del embed.
 */
const SPOTIFY_PLAYLISTS: ReadonlyArray<{ url: string; title: string }> = [
  {
    url: 'https://open.spotify.com/playlist/3U5CcYIMZo3BRnD2JV4I0c',
    title: 'Música para Salu',
  },
];

/**
 * Playlists / videos de YouTube. Funciona para videos individuales,
 * playlists y mezclas. El componente usa youtube-nocookie + rel=0 así
 * que no aparecen recomendaciones turbias al terminar.
 */
const YOUTUBE_PLAYLISTS: ReadonlyArray<{ url: string; title: string }> = [
  {
    url: 'https://youtube.com/playlist?list=PLRYqBfd7pEKweV1tY8zxwX8KD1svZ4nlD',
    title: 'Videos para Salu',
  },
];

interface RecentCreation {
  id: string;
  kind: 'story' | 'lullaby';
  title: string;
  createdAt: string;
}

export default async function CrearPage() {
  const [stories, lullabies] = await Promise.all([listStoriesAction(), listLullabiesAction()]);
  const recent: RecentCreation[] = [
    ...stories.map((s) => ({
      id: s.id,
      kind: 'story' as const,
      title: s.title,
      createdAt: s.createdAt,
    })),
    ...lullabies.map((l) => ({
      id: l.id,
      kind: 'lullaby' as const,
      title: l.title,
      createdAt: l.createdAt,
    })),
  ]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Diversión
        </span>
        <h1 className="font-display text-[2.4rem] text-foreground leading-[1.05] tracking-tight">
          Crear para Salu.
        </h1>
        <p className="max-w-md text-muted-foreground">
          Un cuento para dormir o una canción hecha con lo que pasó hoy. Lo escribe SalustIA, lo
          guardan ustedes.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <CreateTile
          href={'/crear/cuento' as Route}
          tone="sleep"
          Icon={BookOpen}
          DecorIcons={[Moon, Star]}
          title="Un cuento"
          subtitle="Para la noche, con sus personajes y lo que vivió hoy."
          countLabel={
            stories.length === 0
              ? 'Crear el primero'
              : `${stories.length} ${stories.length === 1 ? 'cuento guardado' : 'cuentos guardados'}`
          }
        />
        <CreateTile
          href={'/crear/cancion' as Route}
          tone="feed"
          Icon={Music}
          DecorIcons={[Music2, Sparkles]}
          title="Una canción"
          subtitle="Una nana cantable, con letra propia y audio."
          countLabel={
            lullabies.length === 0
              ? 'Crear la primera'
              : `${lullabies.length} ${lullabies.length === 1 ? 'canción guardada' : 'canciones guardadas'}`
          }
        />
      </div>

      {recent.length > 0 && (
        <section aria-labelledby="ultimo" className="flex flex-col gap-3">
          <h2
            id="ultimo"
            className="px-1 font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]"
          >
            Lo último que creamos
          </h2>
          <ul className="flex flex-col gap-1">
            {recent.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={(item.kind === 'story' ? '/crear/cuento' : '/crear/cancion') as Route}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/50 active:bg-muted/70"
                >
                  <span
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-full',
                      item.kind === 'story'
                        ? 'bg-sleep-soft text-sleep-foreground'
                        : 'bg-feed-soft text-feed-foreground',
                    )}
                  >
                    {item.kind === 'story' ? (
                      <BookOpen className="size-4" aria-hidden />
                    ) : (
                      <Music className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {item.title}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {item.kind === 'story' ? 'Cuento' : 'Canción'} · {sinceLabel(item.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="musica" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 px-1">
          <h2
            id="musica"
            className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]"
          >
            Música de la familia
          </h2>
          <p className="text-muted-foreground text-sm">
            Elegida a mano, sin IA. Spotify reproduce entera con cuenta; YouTube anda sin login.
          </p>
        </div>
        <div className="flex flex-col gap-5">
          {SPOTIFY_PLAYLISTS.map((p) => (
            <SpotifyEmbed key={p.url} url={p.url} title={p.title} />
          ))}
          {YOUTUBE_PLAYLISTS.map((p) => (
            <YouTubeEmbed key={p.url} url={p.url} title={p.title} />
          ))}
        </div>
      </section>
    </div>
  );
}

const TILE_TONES = {
  sleep: {
    tile: 'bg-sleep-soft text-sleep-foreground ring-sleep/20',
    icon: 'bg-sleep text-primary-foreground',
    halo: 'bg-sleep/25',
  },
  feed: {
    tile: 'bg-feed-soft text-feed-foreground ring-feed/25',
    icon: 'bg-feed text-foreground',
    halo: 'bg-feed/30',
  },
} as const;

function CreateTile({
  href,
  tone,
  Icon,
  DecorIcons,
  title,
  subtitle,
  countLabel,
}: {
  href: Route;
  tone: keyof typeof TILE_TONES;
  Icon: LucideIcon;
  DecorIcons: [LucideIcon, LucideIcon];
  title: string;
  subtitle: string;
  countLabel: string;
}) {
  const [DecorA, DecorB] = DecorIcons;
  const styles = TILE_TONES[tone];
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-[2rem] p-6 shadow-[0_20px_40px_-28px_var(--elevation)] outline-none ring-1 transition-transform focus-visible:ring-4 focus-visible:ring-ring active:scale-[0.98]',
        styles.tile,
      )}
    >
      <span
        aria-hidden
        className={cn('-top-16 -right-12 absolute size-48 rounded-full blur-3xl', styles.halo)}
      />
      <DecorA
        aria-hidden
        className="absolute top-6 right-7 size-7 rotate-12 opacity-30 transition-transform duration-500 group-hover:rotate-0"
      />
      <DecorB aria-hidden className="absolute top-16 right-16 size-4 opacity-25" />

      <span
        className={cn(
          'relative grid size-12 place-items-center rounded-2xl shadow-md',
          styles.icon,
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="relative mt-6 flex flex-col gap-1">
        <span className="font-display text-[1.9rem] leading-none tracking-tight">{title}</span>
        <span className="text-sm opacity-80">{subtitle}</span>
      </span>
      <span className="relative mt-4 flex items-center justify-between font-medium text-xs uppercase tracking-wider opacity-80">
        {countLabel}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}
