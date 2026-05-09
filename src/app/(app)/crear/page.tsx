import { PageHeader } from '@/components/salu/page-header';
import { SpotifyEmbed } from '@/components/salu/spotify-embed';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BookOpen, Music, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Diversión',
};

interface CreateOption {
  href: Route;
  title: string;
  description: string;
  Icon: LucideIcon;
  badge?: string;
}

const AI_OPTIONS: CreateOption[] = [
  {
    href: '/crear/cuento' as Route,
    title: 'Cuento personalizado',
    description:
      'Una historia hecha para Salu, con sus personajes y el momento del día. La IA arma el relato; vos lo guardás como recuerdo.',
    Icon: BookOpen,
    badge: 'IA',
  },
  {
    href: '/crear/cancion' as Route,
    title: 'Canción para Salu',
    description:
      'Una nana cantable, pensada para el momento que estés viviendo. Letra propia + audio generado.',
    Icon: Music,
    badge: 'IA',
  },
];

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

export default function CrearPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Diversión"
        title="Cuentos, canciones y música."
        description="Pequeñas obras hechas con IA y la playlist que la familia eligió a mano."
      />

      {/* Sección "Generado con IA" — los creadores que ya teníamos. */}
      <section
        className="animate-stagger-up flex flex-col gap-4"
        style={{ animationDelay: '60ms' }}
      >
        <header className="flex flex-col gap-1">
          <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            Generado con IA
          </span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cuentos y nanas hechos a medida. La IA escribe, vos guardás.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {AI_OPTIONS.map((opt, idx) => (
            <CreateCard key={opt.title} option={opt} index={idx} />
          ))}
        </div>
      </section>

      {/* Sección "Sin IA" — música humana que la familia eligió. */}
      <section
        className="animate-stagger-up flex flex-col gap-4"
        style={{ animationDelay: '140ms' }}
      >
        <header className="flex flex-col gap-1">
          <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
            Sin IA
          </span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            La playlist de Spotify que la familia eligió. Reproducción completa con cuenta de
            Spotify; sin cuenta, previews de 30 segundos.
          </p>
        </header>
        <div className="flex flex-col gap-4">
          {SPOTIFY_PLAYLISTS.map((p) => (
            <SpotifyEmbed key={p.url} url={p.url} title={p.title} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CreateCard({ option, index }: { option: CreateOption; index: number }) {
  const { Icon } = option;
  const delay = `${60 + index * 40}ms`;
  return (
    <Link
      href={option.href}
      className="animate-stagger-up rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ animationDelay: delay }}
    >
      <Card
        className={cn(
          'group/crear relative flex h-full flex-col gap-3 overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.05] p-5 transition-all duration-300',
          'hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
        )}
      >
        {/* Sparkle decorativa para reforzar "esto lo hace IA". */}
        <span
          aria-hidden
          className="-right-4 -top-4 absolute size-24 rounded-full bg-primary/5 blur-2xl"
        />
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10 transition-transform duration-300 group-hover/crear:scale-110 group-hover/crear:bg-primary/15">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-medium text-base text-foreground leading-snug tracking-tight">
                {option.title}
              </h2>
              {option.badge && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/40 px-2 py-0.5 font-medium text-[10px] text-accent-foreground uppercase tracking-wider">
                  <Sparkles className="size-2.5" aria-hidden />
                  {option.badge}
                </span>
              )}
            </div>
            <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">
              {option.description}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
