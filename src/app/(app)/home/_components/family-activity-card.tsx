import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Baby, BookHeart, Milk, Moon, Users } from 'lucide-react';
import type { MemberActivity } from '../family-activity-actions';

interface FamilyActivityCardProps {
  activity: MemberActivity[];
}

const ROLE_LABEL: Record<NonNullable<MemberActivity['role']>, string> = {
  admin: 'Admin',
  caregiver: 'Cuidador/a',
  family: 'Familia',
  viewer: 'Solo ver',
};

/**
 * Card "Hoy en familia": muestra qué miembros registraron actividad hoy
 * y cuántos eventos cada uno (tomas, sueños, pañales, notas). Si nadie
 * registró nada todavía, no se renderiza.
 *
 * Server Component — recibe la activity ya resuelta del page.
 */
export function FamilyActivityCard({ activity }: FamilyActivityCardProps) {
  if (activity.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Users className="size-4" />
        </span>
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
          Hoy en familia
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {activity.map((m) => {
          const initial = (m.displayName?.[0] ?? '?').toUpperCase();
          return (
            <li
              key={m.userId}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 p-2.5 transition-colors',
                m.isSelf && 'border-primary/30 bg-primary/5',
              )}
            >
              <Avatar size="sm">
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 truncate font-medium text-foreground text-sm">
                  {m.displayName ?? 'Alguien'}
                  {m.isSelf && (
                    <span className="font-normal text-muted-foreground text-xs">(vos)</span>
                  )}
                  {m.role && (
                    <span className="font-normal text-muted-foreground/70 text-[10px] uppercase tracking-wider">
                      · {ROLE_LABEL[m.role]}
                    </span>
                  )}
                </span>
                <ActivityBreakdown counts={m.counts} />
              </div>
              <span className="font-display text-foreground text-xl tabular-nums">
                {m.counts.total}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ActivityBreakdown({ counts }: { counts: MemberActivity['counts'] }) {
  const items: Array<{ Icon: typeof Milk; label: string; value: number }> = [];
  if (counts.feeding > 0) items.push({ Icon: Milk, label: 'tomas', value: counts.feeding });
  if (counts.sleep > 0) items.push({ Icon: Moon, label: 'sueños', value: counts.sleep });
  if (counts.diaper > 0) items.push({ Icon: Baby, label: 'pañales', value: counts.diaper });
  if (counts.note > 0) items.push({ Icon: BookHeart, label: 'notas', value: counts.note });
  if (items.length === 0) {
    return <span className="text-muted-foreground text-xs">Sin registros hoy.</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
      {items.map(({ Icon, label, value }, idx) => (
        <span key={label} className="inline-flex items-center gap-0.5">
          <Icon className="size-3" aria-hidden />
          <span>{value}</span>
          <span className="text-muted-foreground/70">{label}</span>
          {idx < items.length - 1 && <span className="px-0.5 text-muted-foreground/40">·</span>}
        </span>
      ))}
    </span>
  );
}
