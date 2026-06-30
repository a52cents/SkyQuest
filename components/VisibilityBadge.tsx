type VisibilityBadgeProps = {
  label: string;
  score: number;
  className?: string;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function VisibilityBadge({ label, score, className }: VisibilityBadgeProps) {
  const tone = score >= 80 ? "border-success/25 bg-success/12 text-success" :
    score >= 60 ? "border-accent-cyan/25 bg-accent-cyan/12 text-accent-cyan" :
    score >= 40 ? "border-warning/25 bg-warning/12 text-warning" :
    "border-danger/25 bg-danger/12 text-danger";

  return (
    <span className={joinClasses("inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold", tone, className)}>
      {label} {"\u00b7"} {score}
    </span>
  );
}
