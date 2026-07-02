import { AppCard } from "@/components/AppCard";

export function LoadingState() {
  return (
    <AppCard>
      <div className="mb-4 h-1 w-12 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-accent/70" />
      </div>
      <p className="font-[Georgia,'Times_New_Roman',serif] text-lg text-text">On lit le ciel actuel...</p>
      <p className="mt-1 text-sm text-muted">Position, météo et objets visibles.</p>
      <div className="mt-5 grid gap-3">
        <div className="h-20 animate-pulse rounded-[16px] bg-white/[0.055]" />
        <div className="h-20 animate-pulse rounded-[16px] bg-white/[0.035]" />
      </div>
    </AppCard>
  );
}
