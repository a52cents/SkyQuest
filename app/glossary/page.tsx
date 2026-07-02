import { GlossaryList } from "@/components/GlossaryList";
import { PageShell } from "@/components/PageShell";

export default function GlossaryPage() {
  return (
    <PageShell eyebrow="Repères simples" title="Glossaire du ciel" contentClassName="pb-4">
      <div className="mb-5">
        <p className="font-[Georgia,'Times_New_Roman',serif] text-[1.3rem] leading-snug text-text">
          Comprendre les mots utiles, sans cours compliqué.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Des définitions courtes pour mieux suivre tes missions et observer à ton rythme.
        </p>
      </div>
      <GlossaryList />
    </PageShell>
  );
}
