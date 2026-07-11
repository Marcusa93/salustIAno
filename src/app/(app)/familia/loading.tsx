import { Skeleton } from '@/components/ui/skeleton';

export default function FamiliaLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      {/* PageHeader */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-10 w-48" />
      </div>

      {/* Card del bebé */}
      <Skeleton className="h-24 w-full rounded-2xl" />

      {/* Sección de miembros */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}
