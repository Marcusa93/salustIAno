import { ThemeToggle } from '@/components/salu/theme-toggle';
import { BookOpen, Heart, Sparkles, Stethoscope } from 'lucide-react';

const PILARES = [
  {
    icon: Heart,
    titulo: 'Cuidar',
    descripcion: 'Sueño, comidas, pañales y mediciones registrados sin fricción.',
  },
  {
    icon: BookOpen,
    titulo: 'Recordar',
    descripcion: 'Una línea de tiempo viva con fotos, anécdotas y voces de la familia.',
  },
  {
    icon: Stethoscope,
    titulo: 'Acompañar',
    descripcion: 'Salud organizada para llevar al pediatra, sin diagnosticar.',
  },
  {
    icon: Sparkles,
    titulo: 'Crear',
    descripcion: 'Cuentos y canciones personalizadas con el universo de Salu.',
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Fondo decorativo: gradiente celeste muy suave */}
      <div
        aria-hidden="true"
        className="-z-10 -translate-x-1/2 pointer-events-none absolute top-0 left-1/2 h-[600px] w-[1200px] max-w-none rounded-full bg-primary-soft opacity-60 blur-3xl dark:opacity-30"
      />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
          >
            <span className="font-mono font-semibold text-sm">S</span>
          </div>
          <span className="font-medium text-foreground text-lg">Salu</span>
        </div>
        <ThemeToggle />
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-32">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-muted-foreground text-sm shadow-soft">
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
            aria-hidden="true"
          />
          En desarrollo · familia primero
        </p>

        <h1 className="text-balance font-semibold text-4xl text-foreground tracking-tight sm:text-6xl">
          Una memoria viva para acompañar a{' '}
          <span className="bg-gradient-to-br from-primary to-medical bg-clip-text text-transparent">
            Salustiano
          </span>
          .
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground leading-relaxed">
          Un espacio privado donde la familia registra, recuerda y acompaña la crianza de Salu.
          Cuidado por personas, con asistencia de algoritmos.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/Marcusa93/salustIAno"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 font-medium text-primary-foreground text-sm shadow-soft transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            Ver el repositorio
          </a>
          <a
            href="#pilares"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-6 font-medium text-foreground text-sm shadow-soft transition-all hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            Conocé los pilares
          </a>
        </div>
      </section>

      <section
        id="pilares"
        aria-labelledby="pilares-heading"
        className="mx-auto max-w-5xl px-6 py-12 sm:py-20"
      >
        <h2 id="pilares-heading" className="sr-only">
          Pilares del proyecto
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILARES.map(({ icon: Icon, titulo, descripcion }) => (
            <li
              key={titulo}
              className="group rounded-lg border border-border bg-card p-6 shadow-soft transition-all hover:shadow-md"
            >
              <div
                aria-hidden="true"
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md bg-primary-soft text-primary"
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold text-card-foreground text-lg">{titulo}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{descripcion}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-12 text-center text-muted-foreground text-sm">
        <p>Hecho con cuidado en Tucumán · {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
