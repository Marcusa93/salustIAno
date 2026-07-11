import { Skeleton } from '@/components/ui/skeleton';

export default function NotasLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-10 sm:px-6 sm:py-14">
      {/* PageHeader */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-10 w-48" />
      </div>

      {/* Chips de categoría */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* Note cards */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}
