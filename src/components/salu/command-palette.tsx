'use client';

import { cn } from '@/lib/utils';
import {
  Activity,
  BookHeart,
  Calendar,
  CornerDownLeft,
  Heart,
  Home,
  ImageIcon,
  Mic,
  Search,
  Sparkles,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: 'Saltar a' | 'Anotar' | 'Cuidar';
  Icon: LucideIcon;
  href: Route;
  /**
   * Términos extra para matching. La label ya entra al matching, así que
   * acá ponemos sinónimos / palabras que la familia podría tipear pero no
   * estén en la label.
   */
  keywords?: string[];
}

const COMMANDS: ReadonlyArray<PaletteCommand> = [
  // Saltar a
  {
    id: 'home',
    label: 'Casa',
    group: 'Saltar a',
    Icon: Home,
    href: '/home',
    keywords: ['inicio', 'dashboard', 'home'],
  },
  {
    id: 'timeline',
    label: 'Timeline',
    group: 'Saltar a',
    Icon: Activity,
    href: '/timeline' as Route,
    keywords: ['historial', 'eventos', 'registro'],
  },
  {
    id: 'album',
    label: 'Álbum',
    group: 'Saltar a',
    Icon: ImageIcon,
    href: '/album',
    keywords: ['fotos', 'imágenes'],
  },
  {
    id: 'notas',
    label: 'Notas',
    group: 'Saltar a',
    Icon: BookHeart,
    href: '/notas' as Route,
    keywords: ['momentos', 'diario'],
  },
  {
    id: 'familia',
    label: 'Familia',
    group: 'Saltar a',
    Icon: Users,
    href: '/familia',
    keywords: ['miembros', 'invitar', 'permisos'],
  },
  {
    id: 'cuidar',
    label: 'Cuidar',
    group: 'Saltar a',
    Icon: Heart,
    href: '/cuidar',
    keywords: ['controles', 'pediatra', 'mediciones', 'vacunas'],
  },
  {
    id: 'chat',
    label: 'Chat con SalustIA',
    group: 'Saltar a',
    Icon: Sparkles,
    href: '/chat',
    keywords: ['salu', 'ia', 'asistente'],
  },
  {
    id: 'perfil',
    label: 'Mi cuenta',
    group: 'Saltar a',
    Icon: User,
    href: '/perfil',
    keywords: ['ajustes', 'configuración', 'notificaciones'],
  },

  // Anotar (rápido)
  {
    id: 'voice',
    label: 'Anotar por voz',
    hint: 'Abre el dictado de SaluIA',
    group: 'Anotar',
    Icon: Mic,
    href: '/home?voz=1' as Route,
    keywords: ['dictar', 'micrófono', 'voz', 'hablar'],
  },
  {
    id: 'note-new',
    label: 'Nueva nota',
    hint: 'Un momento, un detalle',
    group: 'Anotar',
    Icon: BookHeart,
    href: '/notas/nuevo' as Route,
    keywords: ['momento', 'diario', 'recuerdo'],
  },
  // Cuidar
  {
    id: 'control',
    label: 'Próximos controles',
    group: 'Cuidar',
    Icon: Stethoscope,
    href: '/cuidar/control' as Route,
    keywords: ['pediatra', 'vacunas', 'estudios', 'turno'],
  },
  {
    id: 'calendario',
    label: 'Calendario médico',
    group: 'Cuidar',
    Icon: Calendar,
    href: '/cuidar/calendario' as Route,
    keywords: ['agenda', 'turnos', 'mes'],
  },
  {
    id: 'mediciones',
    label: 'Mediciones',
    group: 'Cuidar',
    Icon: Activity,
    href: '/cuidar/mediciones' as Route,
    keywords: ['peso', 'altura', 'percentil'],
  },
];

/**
 * Normaliza para matching: minúsculas + remueve acentos. Permite tipear
 * "panal" y matchear "pañal", "musica" y matchear "música", etc.
 */
function normalize(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: rango Unicode de combining marks.
      .replace(/[̀-ͯ]/g, '')
  );
}

/**
 * Evento global usado por triggers visibles (header, etc.) para abrir el
 * palette sin acoplar refs ni context. Mantenemos el contrato chico:
 * dispatch del CustomEvent → el palette se abre.
 */
export const COMMAND_PALETTE_OPEN_EVENT = 'salu:command-palette:open';

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
}

function matches(cmd: PaletteCommand, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  if (normalize(cmd.label).includes(q)) return true;
  if (cmd.hint && normalize(cmd.hint).includes(q)) return true;
  if (cmd.keywords?.some((k) => normalize(k).includes(q))) return true;
  return false;
}

/**
 * Command palette estilo Cmd+K. Atajos:
 *  - Cmd+K (Mac) / Ctrl+K (Win/Linux): abrir
 *  - "/" desde cualquier input vacío: abrir (deshabilitado dentro de
 *    inputs/textarea para no robar el teclado).
 *  - Esc: cerrar
 *  - ↑/↓: mover selección
 *  - Enter: navegar al item seleccionado
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Cerrar el palette cuando cambia la ruta — si el user navegó usando
  // Enter, ya no queremos seguir mostrándolo encima de la página nueva.
  // biome-ignore lint/correctness/useExhaustiveDependencies: queremos disparar SOLO al cambiar pathname.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Atajo global. Cmd+K o Ctrl+K para abrir; "/" si no estamos editando.
  // También escuchamos un CustomEvent para que cualquier botón visible
  // (header, etc.) pueda abrir el palette sin acoplar refs.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === '/' && !open) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const editable =
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          (target?.isContentEditable ?? false);
        if (editable) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    };
  }, [open]);

  // Reset al abrir + foco en input.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Lock scroll del body mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const filtered = useMemo(() => COMMANDS.filter((c) => matches(c, query)), [query]);

  const grouped = useMemo(() => {
    const map = new Map<PaletteCommand['group'], PaletteCommand[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.group) ?? [];
      arr.push(cmd);
      map.set(cmd.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const flat = useMemo(() => filtered, [filtered]);

  // Si el activeIndex queda fuera de rango (p.ej. al filtrar), lo reseteamos.
  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(0);
  }, [activeIndex, flat.length]);

  // Asegurar que el item activo sea visible al usar arrow keys.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const runCommand = useCallback(
    (cmd: PaletteCommand) => {
      setOpen(false);
      router.push(cmd.href);
    },
    [router],
  );

  function handleInputKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flat[activeIndex];
      if (cmd) runCommand(cmd);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <dialog
      open
      aria-modal="true"
      aria-label="Búsqueda y comandos"
      className="fixed inset-0 z-[60] m-0 flex h-full max-h-none w-full max-w-none items-start justify-center bg-transparent p-4 text-foreground sm:pt-[10vh]"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/60 bg-popover text-popover-foreground shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-150',
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 border-border/50 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKey}
            placeholder="Buscar o ejecutar… (probá ‘pañal’, ‘álbum’, ‘voz’)"
            aria-label="Buscar comando"
            className="h-12 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-medium font-mono text-[10px] text-muted-foreground sm:inline-flex">
            ESC
          </kbd>
        </div>

        {/* Lista */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
              Nada coincide con “{query}”. Probá otra palabra.
            </div>
          ) : (
            grouped.map(([group, cmds]) => (
              <div key={group} className="mb-1.5 last:mb-0">
                <div className="px-2 pt-2 pb-1 font-medium text-[10px] text-muted-foreground/70 uppercase tracking-[0.18em]">
                  {group}
                </div>
                <ul className="flex flex-col">
                  {cmds.map((cmd) => {
                    const flatIdx = flat.indexOf(cmd);
                    const isActive = flatIdx === activeIndex;
                    return (
                      <li key={cmd.id}>
                        <Link
                          href={cmd.href}
                          data-cmd-index={flatIdx}
                          onClick={() => setOpen(false)}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-2.5 py-2 outline-none transition-colors',
                            isActive
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-md ring-1 transition-colors',
                              isActive
                                ? 'bg-primary/15 text-primary ring-primary/20'
                                : 'bg-muted text-muted-foreground ring-border/40',
                            )}
                          >
                            <cmd.Icon className="size-3.5" aria-hidden />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium text-foreground text-sm">
                              {cmd.label}
                            </span>
                            {cmd.hint && (
                              <span className="truncate text-muted-foreground/80 text-xs">
                                {cmd.hint}
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <CornerDownLeft
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer con tips */}
        <div className="flex flex-wrap items-center gap-3 border-border/50 border-t bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border/60 bg-background px-1 py-0.5 font-mono">
              ↑↓
            </kbd>
            <span>navegar</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border/60 bg-background px-1 py-0.5 font-mono">
              ⏎
            </kbd>
            <span>ir</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <kbd className="rounded border border-border/60 bg-background px-1 py-0.5 font-mono">
              ⌘K
            </kbd>
            <span className="hidden sm:inline">para abrir desde cualquier lado</span>
            <span className="sm:hidden">abrir</span>
          </span>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Botón visible para que la familia descubra el palette sin saber el
 * atajo. Lo mostramos en el header (md+) — en mobile la barra es chica y
 * el atajo no aplica, así que sólo lo dejamos en desktop.
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  // Detección rudimentaria de Mac para mostrar ⌘ vs Ctrl.
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Abrir búsqueda y comandos"
      title="Buscar (⌘K)"
      className={cn(
        'hidden h-9 items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 text-muted-foreground text-xs transition-colors md:inline-flex',
        'hover:border-border hover:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <Search className="size-3.5" aria-hidden />
      <span>Buscar…</span>
      <kbd className="ml-1 inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-medium font-mono text-[10px] text-muted-foreground">
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
    </button>
  );
}
