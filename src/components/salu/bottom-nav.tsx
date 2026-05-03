'use client';

import { cn } from '@/lib/utils';
import { Baby, BookHeart, Home, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/cuidar', label: 'Cuidar', icon: Baby },
  { href: '/timeline', label: 'Recordar', icon: BookHeart },
  { href: '/crear', label: 'Crear', icon: Sparkles },
  { href: '/familia', label: 'Familia', icon: Users },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-border/60 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Navegación principal"
    >
      <div className="flex">
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
                'group/bnav relative flex min-h-[52px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 py-2 font-medium text-[10px] tracking-wide transition-all duration-200 active:scale-95',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-b-full bg-primary"
                />
              )}
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full transition-all duration-200',
                  isActive ? 'bg-primary/12 text-primary' : 'group-hover/bnav:bg-muted/50',
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
