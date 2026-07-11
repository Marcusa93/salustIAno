import { Skeleton } from '@/components/ui/skeleton';

export default function ChatLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      {/* Header con avatar + título */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-1 h-10 w-32" />
        </div>
      </div>

      {/* Card de disclaimer */}
      <Skeleton className="h-16 w-full rounded-2xl" />

      {/* Bubbles de chat */}
      <Skeleton className="ml-auto h-12 w-3/4 rounded-2xl" />
      <Skeleton className="h-12 w-2/3 rounded-2xl" />
      <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
    </div>
  );
}
