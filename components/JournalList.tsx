import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import type { Observation } from "@/lib/types";

type JournalListProps = {
  observations: Observation[];
  onClear: () => void;
};

export function JournalList({ observations, onClear }: JournalListProps) {
  return (
    <div className="grid gap-4">
      <AppCard className="rounded-[28px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-cyan">Historique</p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white">Observations récentes</h2>
          </div>
          <AppButton variant="danger" size="sm" onClick={onClear}>
            Vider
          </AppButton>
        </div>
      </AppCard>

      {observations.map((observation) => (
        <AppCard as="article" key={observation.id} className="rounded-[24px]" padding="sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-faint">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(observation.createdAt),
                )}
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">{observation.questTitle}</h3>
              <p className="mt-1 text-sm text-muted">Objet : {observation.target}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                observation.status === "seen" ? "bg-success/12 text-success" : "bg-white/[0.06] text-muted"
              }`}
            >
              {observation.status === "seen" ? "Vu" : "Pas trouvé"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
            <span className="rounded-full bg-white/[0.05] px-3 py-1">Score {observation.visibilityScore}</span>
            {observation.latitude !== undefined && observation.longitude !== undefined ? (
              <span className="rounded-full bg-white/[0.05] px-3 py-1">
                {observation.latitude.toFixed(2)}, {observation.longitude.toFixed(2)}
              </span>
            ) : null}
          </div>
        </AppCard>
      ))}
    </div>
  );
}
