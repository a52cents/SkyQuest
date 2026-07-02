"use client";

import { useMemo, useState } from "react";
import { AppCard } from "@/components/AppCard";
import {
  filterGlossaryTerms,
  glossaryCategories,
  glossaryCategoryLabels,
  type GlossaryCategory,
} from "@/lib/glossary";

type CategoryFilter = GlossaryCategory | "all";

export function GlossaryList() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const results = useMemo(() => filterGlossaryTerms(query, category), [query, category]);

  return (
    <div>
      <label htmlFor="glossary-search" className="sr-only">
        Rechercher un terme
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          id="glossary-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher amas, azimut…"
          autoComplete="off"
          className="min-h-13 w-full rounded-[16px] border border-white/[0.10] bg-surface-strong py-3 pl-12 pr-4 text-base text-text outline-none placeholder:text-faint focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20"
        />
      </div>

      <div
        className="-mx-5 mt-4 overflow-x-auto px-5 pb-2"
        role="group"
        aria-label="Catégories du glossaire"
      >
        <div className="flex w-max gap-2">
          <CategoryButton active={category === "all"} onClick={() => setCategory("all")}>
            Tous
          </CategoryButton>
          {glossaryCategories.map((item) => (
            <CategoryButton key={item} active={category === item} onClick={() => setCategory(item)}>
              {glossaryCategoryLabels[item]}
            </CategoryButton>
          ))}
        </div>
      </div>

      <p
        className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-faint"
        aria-live="polite"
      >
        {results.length} terme{results.length > 1 ? "s" : ""}
      </p>

      {results.length ? (
        <div className="mt-3 grid gap-3">
          {results.map((item) => (
            <AppCard key={item.id} as="article" variant="subtle" padding="sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                    {glossaryCategoryLabels[item.category]}
                  </p>
                  <h2 className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl font-normal text-text">
                    {item.term}
                  </h2>
                </div>
                <span className="text-lg text-accent-cyan" aria-hidden="true">
                  ✦
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{item.shortDefinition}</p>
              {item.longDefinition || item.examples?.length ? (
                <details className="group mt-3 border-t border-white/[0.06] pt-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-accent-cyan marker:content-none">
                    <span className="group-open:hidden">En savoir plus</span>
                    <span className="hidden group-open:inline">Réduire</span>
                  </summary>
                  {item.longDefinition ? (
                    <p className="mt-3 text-sm leading-6 text-muted">{item.longDefinition}</p>
                  ) : null}
                  {item.examples?.map((example) => (
                    <p key={example} className="mt-2 text-xs leading-5 text-faint">
                      Exemple : {example}
                    </p>
                  ))}
                </details>
              ) : null}
            </AppCard>
          ))}
        </div>
      ) : (
        <AppCard variant="subtle" className="mt-3 text-center">
          <p className="font-semibold text-text">Aucun terme trouvé</p>
          <p className="mt-1 text-sm text-muted">
            Essaie un autre mot ou affiche toutes les catégories.
          </p>
        </AppCard>
      )}
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${active ? "border-accent/40 bg-accent/[0.14] text-text" : "border-white/[0.08] bg-white/[0.025] text-muted hover:border-white/[0.16] hover:text-text"}`}
    >
      {children}
    </button>
  );
}
