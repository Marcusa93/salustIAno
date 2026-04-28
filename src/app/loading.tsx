import { HeartIllustration } from '@/components/salu/illustrations';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-breathe text-primary">
        <HeartIllustration className="h-24 w-24" />
      </div>
    </div>
  );
}
