type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="glass-card rounded-[28px] p-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.06] text-2xl">
        ✧
      </div>
      <h2 className="mt-4 text-xl font-bold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#aeb5e8]">{message}</p>
    </div>
  );
}
