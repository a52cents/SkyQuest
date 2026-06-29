export function LoadingState() {
  return (
    <div className="glass-card rounded-[28px] p-5">
      <p className="text-base font-bold text-white">On lit le ciel actuel...</p>
      <p className="mt-1 text-sm text-[#aeb5e8]">Position, météo et objets visibles.</p>
      <div className="mt-5 grid gap-3">
        <div className="h-24 animate-pulse rounded-[22px] bg-white/[0.07]" />
        <div className="h-24 animate-pulse rounded-[22px] bg-white/[0.05]" />
      </div>
    </div>
  );
}
