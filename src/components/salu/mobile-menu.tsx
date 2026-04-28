'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Baby, BookHeart, Home, Menu, Sparkles, Users } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/cuidar', label: 'Cuidar', icon: Baby },
  { href: '/timeline', label: 'Recordar', icon: BookHeart },
  { href: '/crear', label: 'Crear', icon: Sparkles },
  { href: '/familia', label: 'Familia', icon: Users },
] as const;

const themeOptions = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'night', label: 'Noche' },
];

export function MobileMenu() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Abrir menú" className="md:hidden">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="sr-only">Menú</SheetTitle>
        </SheetHeader>

        <nav aria-label="Navegación principal" className="flex flex-col gap-1 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sm transition-colors',
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

        <div className="px-4 pt-4">
          <p className="mb-2 px-3 font-medium text-muted-foreground text-xs">Tema</p>
          <div className="flex flex-wrap gap-2 px-3">
            {themeOptions.map(({ value, label }) => (
              <button
                type="button"
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium text-xs transition-colors',
                  theme === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto p-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-xs">
              M
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sm">Marco</span>
              <span className="text-muted-foreground text-xs">Admin</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
