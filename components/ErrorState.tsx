type ErrorStateProps = {
  message: string;
  tone?: "info" | "warning" | "error";
};

export function ErrorState({ message, tone = "error" }: ErrorStateProps) {
  const color =
    tone === "info"
      ? "border-accent-cyan/25 bg-accent-cyan/10 text-accent-cyan"
      : tone === "warning"
        ? "border-warning/25 bg-warning/10 text-warning"
        : "border-danger/25 bg-danger/10 text-danger";

  return (
    <AppCard variant="subtle" padding="sm" className={`mb-4 text-sm leading-6 ${color}`}>
      {message}
    </AppCard>
  );
}
import { AppCard } from "@/components/AppCard";
