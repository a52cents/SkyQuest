import type { Observation } from "@/lib/types";

type JournalListProps = {
  observations: Observation[];
  onClear: () => void;
};

export function JournalList({ observations, onClear }: JournalListProps) {
  return (
    <div className="grid gap-4">
      <div className="glass-card rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8ea0ff]">Historique</p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white">Observations récentes</h2>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-[#ff6b8a]/25 bg-[#ff6b8a]/10 px-4 py-3 text-sm font-bold text-[#ffd2dc] transition active:scale-[0.98]"
          >
            Vider
          </button>
        </div>
      </div>

      {observations.map((observation) => (
        <article key={observation.id} className="glass-card rounded-[24px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[#9fa6d9]">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(observation.createdAt),
                )}
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">{observation.questTitle}</h3>
              <p className="mt-1 text-sm text-[#b8bde6]">Objet : {observation.target}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                observation.status === "seen" ? "bg-[#63e6a4]/12 text-[#9df0c4]" : "bg-white/[0.06] text-[#d8dcff]"
              }`}
            >
              {observation.status === "seen" ? "Vu" : "Pas trouvé"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#aeb5e8]">
            <span className="rounded-full bg-white/[0.05] px-3 py-1">Score {observation.visibilityScore}</span>
            {observation.latitude !== undefined && observation.longitude !== undefined ? (
              <span className="rounded-full bg-white/[0.05] px-3 py-1">
                {observation.latitude.toFixed(2)}, {observation.longitude.toFixed(2)}
              </span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
