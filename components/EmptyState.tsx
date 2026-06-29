import { AppCard } from "@/components/AppCard";

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <AppCard className="rounded-[28px] text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-brand-border bg-white/[0.06] text-2xl text-accent-cyan">
        ✧
      </div>
      <h2 className="mt-4 text-xl font-bold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{message}</p>
    </AppCard>
  );
}
