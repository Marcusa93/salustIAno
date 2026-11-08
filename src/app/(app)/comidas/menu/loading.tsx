import { Skeleton } from '@/components/ui/skeleton';

export default function MenuSemanalLoading() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 sm:px-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-60 w-full rounded-[2rem]" />
    </div>
  );
}
