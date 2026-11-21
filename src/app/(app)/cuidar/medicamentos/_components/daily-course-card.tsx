import { DailyDoseButton } from '@/components/salu/daily-dose-button';
import { Card } from '@/components/ui/card';
import { formatTimeAr } from '@/lib/format-ar';
import type { DailyCourse, DailyDay } from '@/lib/medication/daily';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, Pill } from 'lucide-react';

const WEEKDAY_INITIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const WEEKDAY_NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function keyToDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

function shortDate(key: string): string {
  const d = keyToDate(key);
  return `${WEEKDAY_NAME[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

const DAY_LABEL: Record<DailyDay['status'], string> = {
  given: 'dado',
  double: 'dado dos veces',
  missed: 'no se anotó',
  pending: 'falta hoy',
};

function DayDot({ day }: { day: DailyDay }) {
  const d = keyToDate(day.key);
  const label = `${shortDate(day.key)}: ${DAY_LABEL[day.status]}`;
  return (
    <li className="flex w-5 flex-col items-center gap-1" title={label}>
      <span className="text-[10px] text-muted-foreground/80" aria-hidden>
        {WEEKDAY_INITIAL[d.getUTCDay()]}
      </span>
      <span
        role="img"
        aria-label={label}
        className={cn(
          'flex size-5 items-center justify-center rounded-full text-[10px]',
          day.status === 'given' && 'bg-green-600 text-white dark:bg-green-500',
          day.status === 'double' && 'bg-amber-500 font-semibold text-white',
          day.status === 'missed' && 'border border-red-400/70 bg-red-500/10',
          day.status === 'pending' && 'border border-muted-foreground/50 border-dashed',
        )}
      >
        {day.status === 'given' && <Check className="size-3" aria-hidden />}
        {day.status === 'double' && '2'}
      </span>
    </li>
  );
}

interface DailyCourseCardProps {
  course: DailyCourse;
  memberNames: Map<string, string>;
}

export function DailyCourseCard({ course, memberNames }: DailyCourseCardProps) {
  const last = course.today.at(-1);
  const givenToday = Boolean(last);
  const by = last?.created_by ? memberNames.get(last.created_by) : undefined;
  const missedDays = course.days.filter((d) => d.status === 'missed').length;

  return (
    <Card className="gap-4 px-4 py-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            givenToday
              ? 'bg-green-500/10 text-green-700 dark:text-green-400'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
          )}
        >
          {givenToday ? (
            <Check className="size-5" aria-hidden />
          ) : (
            <Pill className="size-5" aria-hidden />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium text-base text-foreground">
            {course.name}
            {course.doseAmount && (
              <span className="ml-1.5 font-normal text-muted-foreground text-sm">
                {course.doseAmount}
              </span>
            )}
          </span>
          <span className="text-muted-foreground text-xs">
            Una vez por día · desde el {shortDate(course.startKey)} · día {course.dayNumber}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5',
          givenToday ? 'bg-green-500/[0.07]' : 'bg-amber-500/10',
        )}
      >
        <p className="min-w-0 flex-1 text-sm">
          {last ? (
            <>
              <span className="font-medium text-foreground">Hoy ya se lo dieron</span>
              <span className="text-muted-foreground">
                {' '}
                a las {formatTimeAr(last.given_at)}
                {by ? ` · ${by}` : ''}
              </span>
            </>
          ) : (
            <span className="font-medium text-amber-800 dark:text-amber-300">Falta la de hoy</span>
          )}
        </p>
        {!givenToday && (
          <DailyDoseButton doseId={course.latestDoseId} medicationName={course.name} />
        )}
      </div>

      {course.today.length > 1 && (
        <p className="flex items-start gap-2 text-amber-800 text-xs leading-relaxed dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Hoy hay {course.today.length} dosis anotadas (
          {course.today.map((d) => formatTimeAr(d.given_at)).join(' y ')}). Si alguna fue un error,
          borrala en el historial de abajo.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <ol
          className={cn('flex', course.days.length >= 7 ? 'justify-between' : 'gap-4')}
          aria-label={`Últimos ${course.days.length} días`}
        >
          {course.days.map((day) => (
            <DayDot key={day.key} day={day} />
          ))}
        </ol>
        <p className="text-muted-foreground text-xs">
          {course.daysDue > 0
            ? `Se lo dieron ${course.daysGiven} de ${course.daysDue} ${
                course.daysDue === 1 ? 'día' : 'días'
              }`
            : 'Primer día del tratamiento'}
          {missedDays > 0 && ` · ${missedDays} ${missedDays === 1 ? 'día' : 'días'} sin anotar`}
        </p>
      </div>
    </Card>
  );
}
