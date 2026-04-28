'use client';

import { EmptyState } from '@/components/salu/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { toast } from 'sonner';

export default function FamiliaPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading font-semibold text-3xl tracking-tight">Familia</h1>

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <Avatar size="lg">
              <AvatarFallback>M</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Marco</span>
              <span className="text-muted-foreground text-xs">Vos</span>
            </div>
            <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 font-medium text-secondary-foreground text-xs">
              Admin
            </span>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          disabled
          className="self-start"
          onClick={() => toast.info('Próximamente')}
        >
          Invitar familiar
        </Button>
      </div>

      <EmptyState
        icon={Users}
        title="Cuando invites a alguien, va a aparecer acá."
        description=""
      />
    </div>
  );
}
