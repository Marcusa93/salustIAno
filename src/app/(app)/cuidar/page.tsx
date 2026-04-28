import { EmptyState } from '@/components/salu/empty-state';
import { Baby } from 'lucide-react';

export const metadata = {
  title: 'Cuidar — Salu',
};

export default function CuidarPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading font-semibold text-3xl tracking-tight">Cuidar</h1>
      <EmptyState
        icon={Baby}
        title="Acá vas a registrar el día a día de Salu."
        description="Tomas, sueños, baños, paseos, todo lo cotidiano."
        action={{ label: 'Próximamente', disabled: true }}
      />
    </div>
  );
}
