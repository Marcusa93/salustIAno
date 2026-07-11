import { Skeleton } from '@/components/ui/skeleton';

export default function CuidarLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      {/* PageHeader */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-10 w-48" />
        <Skeleton className="mt-3 h-4 w-full" />
      </div>

      {/* Sección 1 */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-16" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>

      {/* Sección 2 */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-16" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>

      {/* Sección 3 */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-16" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
