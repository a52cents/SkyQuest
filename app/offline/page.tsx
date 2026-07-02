import { getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { OfflineRetryButton } from "@/components/OfflineRetryButton";
import { PageShell } from "@/components/PageShell";

export default function OfflinePage() {
  return (
    <PageShell
      eyebrow="Connexion indisponible"
      title="Tu es hors ligne"
      contentClassName="flex flex-col justify-center pb-4"
    >
      <AppCard padding="lg">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.08] text-2xl text-accent-cyan"
          aria-hidden="true"
        >
          ☾
        </div>
        <p className="mt-5 text-base leading-7 text-muted">
          Tu peux encore consulter ton journal, ton glossaire et les pages déjà chargées. Les
          nouvelles missions et la météo peuvent rester indisponibles jusqu’au retour du réseau.
        </p>
        <div className="mt-6 grid gap-3">
          <OfflineRetryButton />
          <form action="/" method="get">
            <button
              type="submit"
              className={getAppButtonClassName({ variant: "secondary", fullWidth: true })}
            >
              Retour à l’accueil
            </button>
          </form>
          <div className="grid grid-cols-2 gap-3">
            <form action="/journal" method="get">
              <button
                type="submit"
                className={getAppButtonClassName({
                  variant: "ghost",
                  size: "sm",
                  fullWidth: true,
                })}
              >
                Journal
              </button>
            </form>
            <form action="/glossary" method="get">
              <button
                type="submit"
                className={getAppButtonClassName({
                  variant: "ghost",
                  size: "sm",
                  fullWidth: true,
                })}
              >
                Glossaire
              </button>
            </form>
          </div>
        </div>
      </AppCard>
    </PageShell>
  );
}
