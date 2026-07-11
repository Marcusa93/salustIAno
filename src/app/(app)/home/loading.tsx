import { Skeleton } from '@/components/ui/skeleton';

export default function HomeLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      {/* Hub circular */}
      <div className="flex justify-center">
        <Skeleton className="h-56 w-56 rounded-full" />
      </div>

      {/* Barra de acciones rápidas */}
      <Skeleton className="h-12 w-full rounded-xl" />

      {/* Cards de contenido */}
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
