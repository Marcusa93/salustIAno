'use client';

import { cn } from '@/lib/utils';
import { Baby, BookHeart, Home, ImageIcon, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/home', label: 'Inicio', icon: Home },
  { href: '/cuidar', label: 'Cuidar', icon: Baby },
  { href: '/timeline', label: 'Registro', icon: BookHeart },
  { href: '/album', label: 'Álbum', icon: ImageIcon },
  { href: '/crear', label: 'Diversión', icon: Sparkles },
  { href: '/familia', label: 'Familia', icon: Users },
] as const;

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-14 hidden max-h-[calc(100vh-3.5rem)] w-64 shrink-0 flex-col self-start overflow-y-auto md:flex">
      <nav aria-label="Navegación principal" className="flex flex-col gap-1 py-4">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/home'
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group/nav relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-sm transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="-translate-y-1/2 absolute top-1/2 left-0 h-6 w-[3px] rounded-r-full bg-primary"
                />
              )}
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground group-hover/nav:bg-muted group-hover/nav:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
