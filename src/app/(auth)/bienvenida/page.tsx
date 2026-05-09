import { createClient } from '@/lib/supabase/server';
import { Baby, BookHeart, ImageIcon, Sparkles } from 'lucide-react';
import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { WelcomeForm } from './_components/welcome-form';

export const metadata: Metadata = {
  title: '¡Bienvenida a Salu!',
};

const HIGHLIGHTS = [
  {
    icon: Baby,
    title: 'Anotá lo del día',
    desc: 'Tomas, sueño, pañales — lo que vas viendo, en segundos.',
  },
  {
    icon: BookHeart,
    title: 'Vivilo en timeline',
    desc: 'Todo lo que registramos como familia, ordenado por momento.',
  },
  {
    icon: ImageIcon,
    title: 'Sumá fotos',
    desc: 'Se agrupan por mes y se etiquetan solas con IA.',
  },
  {
    icon: Sparkles,
    title: 'Pedile a SalustIA',
    desc: 'Una nana, un cuento, una respuesta tranquila.',
  },
];

/**
 * Pantalla de bienvenida del miembro recién creado por un admin. Le explica
 * qué es Salu en tres bullets y le pide cambiar la contraseña temporal antes
 * de seguir. El proxy fuerza llegar acá; al guardar redirigimos a /home.
 */
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect('/login?next=/bienvenida' as Route);
  }

  const meta =
    (userData.user.user_metadata as
      | { display_name?: string; must_change_password?: boolean }
      | undefined) ?? {};

  // Si por algún motivo entra acá un user que ya completó el onboarding,
  // lo mandamos a /home (defensivo: el proxy ya hace lo mismo).
  if (meta.must_change_password !== true) {
    redirect('/home' as Route);
  }

  const firstName = meta.display_name?.split(' ')[0] ?? '';

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2.5">
        <span className="font-medium text-[10.5px] text-muted-foreground/80 uppercase tracking-[0.22em]">
          Te invitaron
        </span>
        <h1 className="font-display text-[clamp(1.625rem,5vw,2.25rem)] text-foreground leading-[1.1] tracking-tight">
          {firstName ? `¡Hola, ${firstName}!` : '¡Hola!'} Bienvenida a Salu.
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Es el lugar donde la familia guarda todo lo de Salustiano, mes a mes. Antes de empezar
          elegí una contraseña nueva — la temporal era solo para el primer login.
        </p>
      </header>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
          <li
            key={title}
            className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/60 p-3"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <Icon className="size-4" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground text-sm leading-tight">{title}</span>
              <span className="text-muted-foreground text-xs leading-snug">{desc}</span>
            </div>
          </li>
        ))}
      </ul>

      <WelcomeForm />
    </div>
  );
}
