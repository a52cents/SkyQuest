import Link from "next/link";
import { getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { PageShell } from "@/components/PageShell";

function getSupportUrl(): string | null {
  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL;

  if (!supportUrl) return null;

  try {
    const parsedUrl = new URL(supportUrl);
    return parsedUrl.protocol === "https:" ? parsedUrl.toString() : null;
  } catch {
    return null;
  }
}

export default function SupportPage() {
  const supportUrl = getSupportUrl();

  return (
    <PageShell eyebrow="Soutien volontaire" title="Soutenir SkyQuest" contentClassName="pb-4">
      <div className="grid gap-5">
        <AppCard as="section" padding="lg">
          <p className="text-sm leading-6 text-muted">
            SkyQuest reste utilisable sans paiement et sans publicité imposée. Un soutien aide à
            financer son développement, sans changer l’accès au parcours principal.
          </p>
          {supportUrl ? (
            <a
              href={supportUrl}
              className={getAppButtonClassName({
                variant: "primary",
                fullWidth: true,
                className: "mt-6",
              })}
            >
              Faire un don volontaire
            </a>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm leading-6 text-faint">
              Le soutien financier sera proposé ici lorsqu’une solution simple et respectueuse de la
              vie privée sera disponible.
            </p>
          )}
        </AppCard>

        <AppCard as="section" variant="subtle" padding="md">
          <h2 className="font-[Georgia,'Times_New_Roman',serif] text-xl font-normal text-text">
            Un principe simple
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Aucune publicité avant une mission. Si une offre bonus apparaît plus tard, elle restera
            optionnelle et sera proposée après l’observation.
          </p>
        </AppCard>

        <Link
          href="/profile"
          className={getAppButtonClassName({ variant: "ghost", fullWidth: true })}
        >
          Retour au profil
        </Link>
      </div>
    </PageShell>
  );
}
