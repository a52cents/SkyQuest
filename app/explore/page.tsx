"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AppCard } from "@/components/AppCard";
import { NasaHighlights } from "@/components/NasaHighlights";
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
  const container: Variants = prefersReducedMotion
    ? { hidden: {}, show: {} }
    : { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <PageShell eyebrow="Catalogue" title="Explorer le ciel" contentClassName="pb-4">
      <div className="mb-5">
        <p className="font-[Georgia,'Times_New_Roman',serif] text-[1.35rem] leading-snug text-text">
          {"Des repères simples pour reconnaître le ciel."}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          La disponibilité réelle dépend de ta position, de l’heure et de la météo. Lance «
          Maintenant » pour obtenir les cibles guidables.
        </p>
      </div>
      <section className="mb-8" aria-labelledby="nasa-highlights-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-cyan">
              En direct des catalogues NASA
            </p>
            <h2
              id="nasa-highlights-title"
              className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal text-text"
            >
              Aujourd’hui dans l’espace
            </h2>
          </div>
          <span className="text-xl text-accent" aria-hidden="true">
            ✦
          </span>
        </div>
        <NasaHighlights />
      </section>
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
          Repères à apprendre
        </p>
        <h2 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal text-text">
          Catalogue du ciel
        </h2>
      </div>
      <motion.div className="grid gap-3" variants={container} initial="hidden" animate="show">
        {catalogSkyObjects.map((object) => (
          <motion.div
            key={object.id}
            variants={item}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
          >
            <Link
              href={`/explore/${object.id}`}
              className="group block rounded-[20px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <AppCard
                as="article"
                padding="sm"
                className="overflow-hidden transition-colors hover:border-white/[0.14]"
              >
                <div className="relative aspect-[16/9] overflow-hidden rounded-[14px] bg-surface">
                  <Image
                    src={object.image.src}
                    alt=""
                    fill
                    sizes="(max-width: 600px) calc(100vw - 72px), 528px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <span className="absolute bottom-3 left-3 inline-flex rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
                    {typeLabels[object.type]}
                  </span>
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-[Georgia,'Times_New_Roman',serif] text-xl font-normal text-text">
                      {object.frenchName}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                      {object.description}
                    </p>
                  </div>
                  <span className="text-xl text-accent" aria-hidden="true">
                    →
                  </span>
                </div>
                <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs leading-5 text-faint">
                  {object.observationTip}
                </p>
              </AppCard>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </PageShell>
  );
}
