"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AppCard } from "@/components/AppCard";
import { PageShell } from "@/components/PageShell";
import { catalogSkyObjects } from "@/lib/sky-catalog";

const typeLabels = {
  star: "Étoile",
  asterism: "Astérisme",
  constellation: "Constellation",
  star_cluster: "Amas",
  galaxy: "Galaxie",
  meteor_shower: "Météores",
  satellite: "Satellite",
} as const;

export default function ExplorePage() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const container: Variants = prefersReducedMotion ? { hidden: {}, show: {} } : { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <PageShell eyebrow="Catalogue" title="Explorer le ciel" contentClassName="pb-4">
      <div className="mb-5">
        <p className="font-[Georgia,'Times_New_Roman',serif] text-[1.35rem] leading-snug text-text">{"Des repères simples pour reconnaître le ciel."}</p>
        <p className="mt-2 text-sm leading-6 text-muted">La disponibilité réelle dépend de ta position, de l’heure et de la météo. Lance « Maintenant » pour obtenir les cibles guidables.</p>
      </div>
      <motion.div className="grid gap-3" variants={container} initial="hidden" animate="show">
        {catalogSkyObjects.map((object) => (
          <motion.div key={object.id} variants={item} whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}>
            <AppCard as="article" padding="sm" className="transition-colors hover:border-white/[0.14]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex rounded-full border border-accent/20 bg-accent/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">{typeLabels[object.type]}</span>
                  <h2 className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-xl font-normal text-text">{object.frenchName}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{object.description}</p>
                </div>
                <span className="text-xl text-accent" aria-hidden="true">✦</span>
              </div>
              <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs leading-5 text-faint">{object.observationTip}</p>
            </AppCard>
          </motion.div>
        ))}
      </motion.div>
    </PageShell>
  );
}
