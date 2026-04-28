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

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-14 hidden max-h-[calc(100vh-3.5rem)] w-64 shrink-0 flex-col self-start overflow-y-auto md:flex">
      <nav aria-label="Navegación principal" className="flex flex-col gap-1 py-4">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors',
                isActive
                  ? 'border-primary border-l-4 bg-muted text-foreground'
                  : 'border-transparent border-l-4 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
