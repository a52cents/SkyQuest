import { AppCard } from "@/components/AppCard";

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <AppCard className="rounded-[24px] py-9 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] border border-white/[0.09] bg-white/[0.035] text-xl text-accent-cyan">
        ✧
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{message}</p>
    </AppCard>
  );
}
