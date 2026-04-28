import { cn } from '@/lib/utils';

interface IllustrationProps {
  className?: string;
}

export function HeartIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 80" className={cn('h-20 w-20', className)} fill="none" aria-hidden="true">
      <path
        d="M40 67C40 67 10 49 10 28.5C10 19 17.5 12 27 12C33 12 38.5 15.5 40 17C41.5 15.5 47 12 53 12C62.5 12 70 19 70 28.5C70 49 40 67 40 67Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

export function MoonIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 80" className={cn('h-20 w-20', className)} fill="none" aria-hidden="true">
      <path
        d="M44 14C30.7 14 20 24.7 20 38C20 51.3 30.7 62 44 62C50.4 62 56.2 59.4 60.4 55.1C57.5 56.3 54.3 57 51 57C38.3 57 28 46.7 28 34C28 24.2 33.9 15.8 42.4 12.5C42.9 12.8 43.5 14 44 14Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}
