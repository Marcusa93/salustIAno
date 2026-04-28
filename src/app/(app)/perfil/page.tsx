'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChevronRight, Download, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const actions = [
  { label: 'Editar perfil', icon: Pencil, destructive: false },
  { label: 'Cambiar contraseña', icon: KeyRound, destructive: false },
  { label: 'Exportar mis datos', icon: Download, destructive: false },
  { label: 'Eliminar cuenta', icon: Trash2, destructive: true },
];

export default function PerfilPage() {
  return (
    <div className="flex max-w-md flex-col gap-8">
      <h1 className="font-heading font-semibold text-3xl tracking-tight">Mi cuenta</h1>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <Avatar size="lg" className="size-20 text-xl">
            <AvatarFallback>M</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="font-semibold text-lg">Marco</p>
            <p className="text-muted-foreground text-sm">marco@placeholder.dev</p>
            <p className="mt-1 text-muted-foreground text-xs">Miembro desde abril 2026</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {actions.map(({ label, icon: Icon, destructive }, index) => (
            <div key={label}>
              {index > 0 && <Separator />}
              <button
                type="button"
                onClick={() => toast.info('Próximamente')}
                className={[
                  'flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-muted/50',
                  destructive ? 'text-destructive' : 'text-foreground',
                ].join(' ')}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
