'use client';

import { signOut } from '@/app/(app)/_actions/sign-out';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookHeart, LogOut, User, Users } from 'lucide-react';
import type { Route } from 'next';
import { useTheme } from 'next-themes';
import Link from 'next/link';

const themeOptions = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'night', label: 'Noche' },
];

export function UserMenu() {
  const { theme, setTheme } = useTheme();

  async function handleSignOut() {
    // signOut() redirige server-side a /login; no se llega a la línea
    // siguiente en happy path.
    await signOut();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menú de usuario"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Avatar size="sm">
          <AvatarFallback>M</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem render={<Link href="/perfil" />}>
          <User />
          Mi cuenta
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/familia" />}>
          <Users />
          Familia
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={'/notas' as Route} />}>
          <BookHeart />
          Notas
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Tema</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme ?? 'system'}
              onValueChange={(value) => setTheme(value as string)}
            >
              {themeOptions.map(({ value, label }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
