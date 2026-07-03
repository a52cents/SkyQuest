import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { PageShell } from "@/components/PageShell";
import { catalogSkyObjects, getCatalogSkyObject } from "@/lib/sky-catalog";

const typeLabels = {
  star: "Étoile",
  asterism: "Astérisme",
  constellation: "Constellation",
  star_cluster: "Amas d’étoiles",
  galaxy: "Galaxie",
  meteor_shower: "Météores",
  satellite: "Satellite",
} as const;

const difficultyLabels = {
  easy: "Facile",
  medium: "Intermédiaire",
  hard: "Difficile",
} as const;

const gearLabels = {
  naked_eye: "À l’œil nu",
  binoculars_recommended: "Jumelles recommandées",
} as const;

type CatalogDetailPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return catalogSkyObjects.map((object) => ({ id: object.id }));
}

export async function generateMetadata({ params }: CatalogDetailPageProps): Promise<Metadata> {
  const object = getCatalogSkyObject((await params).id);
  if (!object) return { title: "Objet introuvable · SkyQuest" };

  return {
    title: `${object.frenchName} · SkyQuest`,
    description: object.description,
  };
}

export default async function CatalogDetailPage({ params }: CatalogDetailPageProps) {
  const object = getCatalogSkyObject((await params).id);
  if (!object) notFound();

  return (
    <PageShell eyebrow={typeLabels[object.type]} title={object.frenchName} contentClassName="pb-4">
      <Link
        href="/explore"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-cyan hover:underline"
      >
        <span aria-hidden="true">←</span> Retour à Explorer
      </Link>

      <AppCard as="article" padding="sm" className="overflow-hidden">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-surface">
          <Image
            src={object.image.src}
            alt={object.image.alt}
            fill
            priority
            sizes="(max-width: 600px) calc(100vw - 72px), 528px"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-12 pb-3">
            <p className="text-[11px] leading-4 text-white/75">
              Image réelle · {object.image.credit}
            </p>
          </div>
        </div>
        <p className="mt-4 text-base leading-7 text-text">{object.introduction}</p>
        <a
          href={object.image.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-semibold text-accent-cyan hover:underline"
        >
          Source et licence · {object.image.license} ↗
        </a>
      </AppCard>

      <section className="mt-4" aria-labelledby="quick-facts-title">
        <h2 id="quick-facts-title" className="mb-3 text-base font-semibold text-text">
          En bref
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <AppCard padding="sm" variant="subtle">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Difficulté
            </p>
            <p className="mt-1 text-sm font-semibold text-text">
              {difficultyLabels[object.difficulty]}
            </p>
          </AppCard>
          <AppCard padding="sm" variant="subtle">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Matériel
            </p>
            <p className="mt-1 text-sm font-semibold text-text">
              {gearLabels[object.requiredGear]}
            </p>
          </AppCard>
          {object.quickFacts.map((fact) => (
            <AppCard key={fact.label} padding="sm" variant="subtle" className="col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
                {fact.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-text">{fact.value}</p>
            </AppCard>
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-3">
        <AppCard as="section" padding="md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
            Comment le trouver
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">{object.howToFind}</p>
        </AppCard>
        <AppCard as="section" padding="md" variant="solid">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-cyan">
            À quoi t’attendre vraiment
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">{object.whatToExpect}</p>
        </AppCard>
        {object.warning ? (
          <p className="rounded-[16px] border border-warning/20 bg-warning/[0.06] px-4 py-3 text-sm leading-5 text-muted">
            {object.warning}
          </p>
        ) : null}
      </div>

      <Link href="/" className={getAppButtonClassName({ fullWidth: true, className: "mt-5" })}>
        Voir ce qui est observable maintenant
      </Link>
    </PageShell>
  );
}
