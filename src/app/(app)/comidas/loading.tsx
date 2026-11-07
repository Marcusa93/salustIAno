import { Skeleton } from '@/components/ui/skeleton';

export default function ComidasLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 sm:px-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-64" />
      </div>
      <Skeleton className="h-52 w-full rounded-[2rem]" />
      <Skeleton className="h-24 w-full rounded-3xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-36 rounded-3xl" />
      </div>
    </div>
  );
}
