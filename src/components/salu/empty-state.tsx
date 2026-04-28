import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  illustration?: ReactNode;
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: Route;
    onClick?: () => void;
    disabled?: boolean;
  };
  className?: string;
}

export function EmptyState({
  illustration,
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const visual =
    illustration ??
    (Icon ? (
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden />
      </div>
    ) : null);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-border border-dashed bg-muted/30 px-6 py-12 text-center',
        className,
      )}
    >
      {visual}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-semibold text-base text-foreground">{title}</h3>
        <p className="max-w-xs text-muted-foreground text-sm">{description}</p>
      </div>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className={cn(
              buttonVariants({ size: 'sm' }),
              action.disabled && 'pointer-events-none opacity-50',
            )}
            aria-disabled={action.disabled}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={buttonVariants({ size: 'sm' })}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
