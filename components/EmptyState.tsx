import { AppCard } from "@/components/AppCard";

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <AppCard className="py-9 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] border border-white/[0.06] bg-white/[0.025] text-xl text-accent">
        ✧
      </div>
      <h2 className="mt-4 font-[Georgia,'Times_New_Roman',serif] text-xl font-normal tracking-[-0.02em] text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{message}</p>
    </AppCard>
  );
}
