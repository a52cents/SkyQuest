"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { AppButton } from "@/components/AppButton";
import { getCurrentPosition } from "@/lib/browser-support";
import { saveLastLocation } from "@/lib/storage";

type OnboardingStep = 1 | 2;

const STEPS = [1, 2] as const;

const PROMISES = ["Ciel local", "Guidage simple", "Journal privé"] as const;

const PRIVACY_POINTS = [
  "Ta position sert uniquement à calculer le ciel près de toi.",
  "Ton journal reste sur cet appareil, sans compte.",
  "Caméra et orientation restent désactivées hors mission.",
] as const;

function PromiseIllustration() {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.08] shadow-[0_0_44px_rgba(124,92,255,0.16)]">
      <span className="absolute top-5 left-4 h-1.5 w-1.5 rounded-full bg-accent-cyan" />
      <span className="absolute top-4 right-5 h-1 w-1 rounded-full bg-white/70" />
      <span className="absolute right-3 bottom-5 h-1.5 w-1.5 rounded-full bg-accent" />
      <svg
        viewBox="0 0 64 64"
        className="h-14 w-14 text-accent-cyan"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 43 29 26l9 9-17 17z" fill="currentColor" opacity=".28" />
        <path
          d="m25 32 12-12 12 12-12 12zM37 20l9-9M20 51h31M28 51l-6 9M43 51l6 9"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function LocationIllustration() {
  return (
    <div className="hidden h-16 w-16 items-center justify-center rounded-[20px] border border-accent/20 bg-accent/[0.08] text-accent-cyan [@media(min-height:720px)]:flex">
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 fill-none stroke-current"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    </div>
  );
}

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestingPosition, setIsRequestingPosition] = useState(false);
  const prefersReducedMotion = useReducedMotion() ?? false;

  const stepVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, x: 24 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.22, ease: "easeOut" } },
        exit: { opacity: 0, x: -24, transition: { duration: 0.16, ease: "easeIn" } },
      };

  async function handleAuthorizePosition() {
    if (isRequestingPosition) return;
    setIsRequestingPosition(true);
    setErrorMessage(null);

    try {
      const position = await getCurrentPosition();
      saveLastLocation(position);
      onFinish();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de récupérer ta position. Tu peux continuer et réessayer plus tard.",
      );
    } finally {
      setIsRequestingPosition(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] overflow-hidden bg-[#0a0a0b]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(124,92,255,0.11),transparent_38%)]"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto grid h-[100dvh] w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="flex min-h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/newicon.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
              priority
            />
            <span className="font-[Georgia,'Times_New_Roman',serif] text-lg text-text">
              SkyQuest
            </span>
          </div>
          <button
            type="button"
            onClick={onFinish}
            className="min-h-11 rounded-full px-3 text-sm font-medium text-muted hover:text-text"
          >
            Passer
          </button>
        </header>

        <main className="flex min-h-0 items-start overflow-y-auto py-5 [@media(min-height:720px)]:items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="w-full"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {step === 1 ? (
                <div className="flex flex-col items-center text-center">
                  <PromiseIllustration />
                  <p className="premium-kicker mt-6">Bienvenue dehors</p>
                  <h1
                    id="onboarding-title"
                    className="mt-3 max-w-sm font-[Georgia,'Times_New_Roman',serif] text-[2.15rem] font-normal leading-[1.05] tracking-[-0.04em] text-text"
                  >
                    Le ciel a une quête pour toi
                  </h1>
                  <p className="mt-4 max-w-sm text-[0.95rem] leading-6 text-muted">
                    SkyQuest choisit des missions simples selon ton ciel, puis t’aide à regarder au
                    bon endroit.
                  </p>
                  <div className="mt-6 grid w-full grid-cols-3 gap-2">
                    {PROMISES.map((promise) => (
                      <div
                        key={promise}
                        className="flex min-h-16 items-center justify-center rounded-[16px] border border-white/[0.06] bg-white/[0.025] px-2 text-center text-xs font-semibold leading-4 text-text"
                      >
                        {promise}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <LocationIllustration />
                  <p className="premium-kicker mt-0 [@media(min-height:720px)]:mt-6">
                    Dernière étape
                  </p>
                  <h1
                    id="onboarding-title"
                    className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-[2.1rem] font-normal leading-[1.08] tracking-[-0.04em] text-text"
                  >
                    Ton ciel commence ici
                  </h1>
                  <p className="mt-4 text-[0.95rem] leading-6 text-muted">
                    Autorise ta position pour recevoir des quêtes adaptées à l’endroit où tu
                    observes.
                  </p>

                  <ul className="mt-6 grid gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-4">
                    {PRIVACY_POINTS.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-3 text-sm leading-5 text-muted"
                      >
                        <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[0.65rem] font-bold text-accent-cyan">
                          ✓
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  {errorMessage ? (
                    <div
                      role="status"
                      className="mt-4 rounded-[16px] border border-warning/20 bg-warning/[0.08] p-4 text-sm leading-5 text-muted"
                    >
                      <p className="font-semibold text-text">Tu peux continuer sans position.</p>
                      <p className="mt-1">{errorMessage}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="relative z-10 border-t border-white/[0.06] bg-[#0a0a0b]/95 pt-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
              Étape {step} sur 2
            </span>
            <div className="flex items-center gap-2" aria-hidden="true">
              {STEPS.map((item) => (
                <span
                  key={item}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${step === item ? "w-7 bg-accent" : "w-2 bg-white/20"}`}
                />
              ))}
            </div>
          </div>

          {step === 1 ? (
            <AppButton size="lg" fullWidth onClick={() => setStep(2)}>
              Découvrir mon ciel
            </AppButton>
          ) : (
            <div className="grid gap-2.5">
              <AppButton
                size="lg"
                fullWidth
                onClick={() => void handleAuthorizePosition()}
                isLoading={isRequestingPosition}
              >
                {isRequestingPosition ? "Localisation en cours…" : "Autoriser la position"}
              </AppButton>
              <AppButton variant="ghost" size="md" fullWidth onClick={onFinish}>
                {errorMessage ? "Continuer sans position" : "Plus tard"}
              </AppButton>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
