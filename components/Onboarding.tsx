"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { getCurrentPosition } from "@/lib/browser-support";

type OnboardingStep = 1 | 2 | 3;

function TelescopeIcon() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 text-accent-cyan" aria-hidden="true" fill="none">
      <defs>
        <linearGradient id="onboarding-glow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <circle cx="82" cy="28" r="6" fill="currentColor" opacity="0.95" />
      <path d="M22 76l28-28 12 12-28 28z" fill="url(#onboarding-glow)" opacity="0.95" />
      <path d="M44 60l18-18 22 22-18 18z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <path d="M63 44l16-16" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 87h54" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M45 87l-10 14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M73 87l10 14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M83 27l8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M89 35l10 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function StepShell({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute inset-0 flex flex-col justify-center transition-all duration-300 ease-out ${active ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"}`}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestingPosition, setIsRequestingPosition] = useState(false);

  const dots = useMemo(() => [1, 2, 3] as const, []);

  async function handleAuthorizePosition() {
    setIsRequestingPosition(true);
    setErrorMessage(null);

    try {
      await getCurrentPosition();
      setStep(3);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de récupérer la position pour le moment.");
    } finally {
      setIsRequestingPosition(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 px-5 py-6 backdrop-blur-md sm:px-8">
      <div className="mx-auto flex h-full w-full max-w-xl flex-col rounded-[32px] border border-white/[0.08] bg-[radial-gradient(circle_at_top,rgba(115,201,235,0.12),transparent_42%),linear-gradient(180deg,rgba(9,12,20,0.96),rgba(11,15,27,0.98))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="premium-kicker">Première visite</p>
            <p className="mt-1 text-sm text-muted">3 étapes pour démarrer sans surprise.</p>
          </div>
          <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-faint">SkyQuest</div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <StepShell active={step === 1}>
            <div className="flex flex-col items-start gap-6">
              <div className="rounded-[28px] border border-accent-cyan/20 bg-accent-cyan/[0.07] p-4">
                <TelescopeIcon />
              </div>
              <div className="max-w-md">
                <h1 className="text-[2.35rem] font-semibold leading-[0.96] tracking-[-0.06em] text-white sm:text-[3.1rem]">Le ciel a une quête pour toi</h1>
                <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
                  SkyQuest te dit quoi regarder dans le ciel maintenant, selon ta position et la météo.
                </p>
              </div>
              <div className="mt-2 w-full max-w-sm">
                <AppButton size="lg" fullWidth onClick={() => setStep(2)}>
                  Commencer
                </AppButton>
              </div>
            </div>
          </StepShell>

          <StepShell active={step === 2}>
            <div className="flex flex-col gap-6">
              <div className="space-y-3">
                <p className="premium-kicker">Position</p>
                <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.35rem]">Trouve ta position</h2>
                <p className="max-w-md text-base leading-7 text-muted sm:text-lg">
                  Pour te montrer ce qui est visible, j&apos;ai besoin de savoir où tu es.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4 text-sm leading-6 text-muted">
                La localisation ne sert qu&apos;à choisir des quêtes réalistes. Tu peux continuer même si tu refuses.
              </div>

              {errorMessage ? (
                <div className="rounded-[20px] border border-warning/20 bg-warning/[0.08] p-4 text-sm leading-6 text-[#f0d9a8]">
                  <p className="font-semibold text-white">Pas grave.</p>
                  <p className="mt-1">{errorMessage}</p>
                </div>
              ) : null}

              <div className="grid gap-3">
                <AppButton size="lg" fullWidth onClick={() => void handleAuthorizePosition()} isLoading={isRequestingPosition}>
                  {isRequestingPosition ? "Demande en cours..." : "Autoriser ma position"}
                </AppButton>
                {errorMessage ? (
                  <AppButton variant="ghost" size="lg" fullWidth onClick={() => setStep(3)}>
                    Passer
                  </AppButton>
                ) : null}
              </div>
            </div>
          </StepShell>

          <StepShell active={step === 3}>
            <div className="flex flex-col gap-6">
              <div className="rounded-[28px] border border-success/20 bg-success/[0.08] p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-success/20 bg-success/[0.08] text-2xl text-success" aria-hidden="true">✦</span>
                  <div>
                    <p className="premium-kicker">Prêt à observer</p>
                    <p className="mt-1 text-sm text-muted">Tu es prêt. Regarde le ciel, le bouton Maintenant t&apos;attend.</p>
                  </div>
                </div>
              </div>

              <div className="max-w-md">
                <h2 className="text-[2.1rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.55rem]">C&apos;est parti</h2>
                <p className="mt-4 text-base leading-7 text-muted sm:text-lg">Tu peux lancer ta première quête dès que tu fermes cet écran.</p>
              </div>

              <div className="mt-auto w-full max-w-sm">
                <AppButton size="lg" fullWidth onClick={onFinish}>
                  C&apos;est parti
                </AppButton>
              </div>
            </div>
          </StepShell>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2" aria-label="Progression onboarding">
          {dots.map((dot) => (
            <span
              key={dot}
              className={`h-2.5 rounded-full transition-all duration-300 ease-out ${step === dot ? "w-7 bg-accent-cyan" : "w-2.5 bg-white/25"}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}