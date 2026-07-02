import Link from "next/link";
import { getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";

export function SupportSkyQuest() {
  return (
    <AppCard as="section" variant="subtle" padding="md" aria-labelledby="support-skyquest-title">
      <p className="premium-kicker">Projet indépendant</p>
      <h2
        id="support-skyquest-title"
        className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-xl font-normal text-text"
      >
        Soutenir SkyQuest
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Le soutien reste entièrement volontaire et ne bloque jamais l’accès aux quêtes.
      </p>
      <Link
        href="/support"
        className={getAppButtonClassName({ variant: "secondary", size: "sm", className: "mt-4" })}
      >
        Découvrir les options
      </Link>
    </AppCard>
  );
}
