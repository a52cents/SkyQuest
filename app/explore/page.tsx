"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AppCard } from "@/components/AppCard";
import { NasaHighlights } from "@/components/NasaHighlights";
import { PageShell } from "@/components/PageShell";
import {
  catalogSkyObjects,
  type CatalogObjectType,
  type CatalogSkyObject,
} from "@/lib/sky-catalog";

const typeLabels = {
  star: "Étoile",
  asterism: "Astérisme",
  constellation: "Constellation",
  star_cluster: "Amas",
  galaxy: "Galaxie",
  meteor_shower: "Météores",
  satellite: "Satellite",
} as const;

const typeOptions: Array<{ value: CatalogObjectType; label: string }> = [
  { value: "star", label: "Étoiles" },
  { value: "asterism", label: "Astérismes" },
  { value: "constellation", label: "Constellations" },
  { value: "star_cluster", label: "Amas" },
  { value: "galaxy", label: "Galaxies" },
  { value: "meteor_shower", label: "Météores" },
  { value: "satellite", label: "Satellites" },
];

const difficultyLabels: Record<CatalogSkyObject["difficulty"], string> = {
  easy: "Facile",
  medium: "Intermédiaire",
  hard: "Difficile",
};

type TypeFilter = "all" | CatalogObjectType;
type DifficultyFilter = "all" | CatalogSkyObject["difficulty"];

export default function ExplorePage() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");
  const filteredObjects = useMemo(
    () =>
      catalogSkyObjects.filter(
        (object) =>
          (typeFilter === "all" || object.type === typeFilter) &&
          (difficultyFilter === "all" || object.difficulty === difficultyFilter),
      ),
    [difficultyFilter, typeFilter],
  );
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
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
          Repères à apprendre
        </p>
        <h2
          id="catalog-title"
          className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal text-text"
        >
          Catalogue du ciel
        </h2>
      </div>
      <section aria-labelledby="catalog-title">
        <AppCard variant="subtle" padding="sm" className="mb-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-xs font-medium text-muted">
              Type
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="mt-1.5 min-h-11 w-full min-w-0 rounded-brand border border-white/[0.10] bg-surface-strong px-3 text-sm text-text outline-none focus:border-accent-cyan/50 focus:ring-2 focus:ring-accent-cyan/20"
              >
                <option value="all">Tous</option>
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-xs font-medium text-muted">
              Difficulté
              <select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value as DifficultyFilter)}
                className="mt-1.5 min-h-11 w-full min-w-0 rounded-brand border border-white/[0.10] bg-surface-strong px-3 text-sm text-text outline-none focus:border-accent-cyan/50 focus:ring-2 focus:ring-accent-cyan/20"
              >
                <option value="all">Toutes</option>
                {Object.entries(difficultyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-faint" aria-live="polite">
            {filteredObjects.length} repère{filteredObjects.length > 1 ? "s" : ""} à découvrir
          </p>
        </AppCard>
        <motion.div className="grid gap-3" variants={container} initial="hidden" animate="show">
          {filteredObjects.map((object) => (
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
                    <span className="absolute right-3 bottom-3 inline-flex rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                      {difficultyLabels[object.difficulty]}
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
        {filteredObjects.length === 0 ? (
          <AppCard variant="subtle" padding="sm" className="text-center">
            <p className="text-sm font-medium text-text">Aucun repère avec ces filtres.</p>
            <button
              type="button"
              className="mt-2 min-h-11 px-3 text-sm font-semibold text-accent-cyan"
              onClick={() => {
                setTypeFilter("all");
                setDifficultyFilter("all");
              }}
            >
              Voir tout le catalogue
            </button>
          </AppCard>
        ) : null}
      </section>
      <section className="mt-10" aria-labelledby="nasa-highlights-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-cyan">
              Actualités spatiales
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
    </PageShell>
  );
}
