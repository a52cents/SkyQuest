import { AppCard } from "@/components/AppCard";

export function LoadingState() {
  return (
    <AppCard className="rounded-[28px]">
      <p className="text-base font-bold text-text">On lit le ciel actuel...</p>
      <p className="mt-1 text-sm text-muted">Position, météo et objets visibles.</p>
      <div className="mt-5 grid gap-3">
        <div className="h-24 animate-pulse rounded-[22px] bg-white/[0.07]" />
        <div className="h-24 animate-pulse rounded-[22px] bg-white/[0.05]" />
      </div>
    </AppCard>
  );
}
