import { EmptyState } from '@/components/salu/empty-state';
import { Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Crear — Salu',
};

export default function CrearPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading font-semibold text-3xl tracking-tight">Crear</h1>
      <EmptyState
        icon={Sparkles}
        title="Cuentos y canciones personalizadas."
        description="Próximamente vas a poder generar historias con el nombre de Salu y sus cosas favoritas."
        action={{ label: 'Próximamente', disabled: true }}
      />
    </div>
  );
}
