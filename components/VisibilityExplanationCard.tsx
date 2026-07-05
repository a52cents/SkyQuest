import { AppCard } from "@/components/AppCard";

export function VisibilityExplanationContent() {
  return (
    <div className="text-sm leading-6 text-muted">
      <p>
        SkyQuest combine la hauteur de la cible, les nuages et la lumière du jour, du crépuscule ou
        de la nuit. La Lune et les planètes brillantes sont souvent plus faciles ; les étoiles, amas
        et galaxies demandent un ciel plus sombre.
      </p>
      <p className="mt-2">
        Si la météo manque, une estimation prudente prend le relais. L’indice aide à choisir : ce
        n’est jamais une garantie d’observation ni une probabilité scientifique.
      </p>
    </div>
  );
}

export function VisibilityExplanationCard({ compact = false }: { compact?: boolean }) {
  return (
    <AppCard
      as="section"
      variant="subtle"
      padding="sm"
      id={compact ? undefined : "visibility-score"}
      className={compact ? "mb-6" : undefined}
      aria-labelledby={compact ? undefined : "visibility-explanation-title"}
    >
      <details open={!compact} className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="premium-kicker block">Indice de visibilité</span>
            <span
              id={compact ? undefined : "visibility-explanation-title"}
              className="mt-1 block font-[Georgia,'Times_New_Roman',serif] text-lg text-text"
            >
              Comment SkyQuest l’estime
            </span>
          </span>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.08] text-accent transition-transform group-open:rotate-45"
            aria-hidden="true"
          >
            +
          </span>
        </summary>
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <VisibilityExplanationContent />
        </div>
      </details>
    </AppCard>
  );
}
