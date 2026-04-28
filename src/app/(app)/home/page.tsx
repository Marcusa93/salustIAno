import { EmptyState } from '@/components/salu/empty-state';
import { HeartIllustration } from '@/components/salu/illustrations/heart';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Casa',
};

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl tracking-tight">Hola, Marco</h1>
        <p className="text-muted-foreground">Bienvenido de vuelta a Salu</p>
      </div>

      <EmptyState
        illustration={<HeartIllustration size={80} />}
        title="El lugar de Salustiano"
        description="Cuando Salustiano nazca, este va a ser su lugar. Cada toma, cada gramo, cada recuerdo — todo acá."
        action={{ label: 'Crear el perfil', href: '/onboarding' }}
      />
    </div>
  );
}
