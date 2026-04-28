'use client';

import { Button } from '@/components/ui/button';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteMilestoneAction, toggleMilestoneCompletedAction } from '../../actions';

interface MilestoneActionsProps {
  id: string;
  title: string;
  isCompleted: boolean;
  canEdit: boolean;
}

export function MilestoneActions({ id, title, isCompleted, canEdit }: MilestoneActionsProps) {
  const [pendingToggle, startToggle] = useTransition();
  const [pendingDelete, startDelete] = useTransition();

  function handleToggle() {
    startToggle(async () => {
      const result = await toggleMilestoneCompletedAction(id, !isCompleted);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(isCompleted ? 'Marcado como pendiente.' : 'Marcado como hecho.');
      }
    });
  }

  function handleDelete() {
    if (!confirm(`¿Borrar "${title}"? Lo podés restaurar si te arrepentís.`)) return;
    startDelete(async () => {
      const result = await deleteMilestoneAction(id);
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  if (!canEdit) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={handleToggle} variant="default" size="sm" disabled={pendingToggle}>
        {isCompleted ? (
          <>
            <RotateCcw className="size-4" aria-hidden />
            Marcar como pendiente
          </>
        ) : (
          <>
            <Check className="size-4" aria-hidden />
            Marcar como hecho
          </>
        )}
      </Button>
      <Button onClick={handleDelete} variant="ghost" size="sm" disabled={pendingDelete}>
        <Trash2 className="size-4" aria-hidden />
        Borrar
      </Button>
    </div>
  );
}
