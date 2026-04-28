import { EmptyState } from '@/components/salu/empty-state';
import { BookHeart } from 'lucide-react';

export const metadata = {
  title: 'Recuerdos — Salu',
};

export default function TimelinePage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading font-semibold text-3xl tracking-tight">Recuerdos</h1>
      <EmptyState
        icon={BookHeart}
        title="La memoria de Salu va a vivir acá."
        description="Fotos, hitos, frases, primeros días."
        action={{ label: 'Próximamente', disabled: true }}
      />
    </div>
  );
}
