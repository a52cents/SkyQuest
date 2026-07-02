"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { AppButton } from "@/components/AppButton";
import { getCurrentPosition } from "@/lib/browser-support";
import { saveLastLocation } from "@/lib/storage";

type OnboardingStep = 1 | 2 | 3;

const STEPS = [1, 2, 3] as const;

const HOW_IT_WORKS = [
  "On détecte ton ciel",
  "Tu choisis une mission",
  "Tu pointes ton téléphone vers le ciel",
  "Tu notes ton observation dans ton journal",
] as const;

function PromiseIllustration() {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.08] shadow-[0_0_50px_rgba(124,92,255,0.18)]">
      <span className="absolute left-5 top-6 h-1.5 w-1.5 rounded-full bg-accent-cyan" />
      <span className="absolute right-6 top-4 h-1 w-1 rounded-full bg-white/70" />
      <span className="absolute bottom-6 right-4 h-1.5 w-1.5 rounded-full bg-accent" />
      <svg
        viewBox="0 0 64 64"
        className="h-16 w-16 text-accent-cyan"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 43 29 26l9 9-17 17z" fill="currentColor" opacity=".35" />
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

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestingPosition, setIsRequestingPosition] = useState(false);
  const prefersReducedMotion = useReducedMotion() ?? false;

  const stepVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, x: 48 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.24, ease: "easeOut" } },
        exit: { opacity: 0, x: -48, transition: { duration: 0.18, ease: "easeIn" } },
      };

  function finishOnboarding() {
    onFinish();
  }

  async function handleAuthorizePosition() {
    if (isRequestingPosition) return;
    setIsRequestingPosition(true);
    setErrorMessage(null);

    try {
      const position = await getCurrentPosition();
      saveLastLocation(position);
      finishOnboarding();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de récupérer ta position pour l’instant. Tu pourras réessayer plus tard.",
      );
    } finally {
      setIsRequestingPosition(false);
    }
  }

  function renderStep() {
    if (step === 1) {
      return (
        <div className="flex flex-col items-center text-center">
          <PromiseIllustration />
          <h1
            id="onboarding-title"
            className="mt-8 font-[Georgia,'Times_New_Roman',serif] text-[2.35rem] font-normal leading-[1.02] tracking-[-0.04em] text-white sm:text-[3rem]"
          >
            Explore le ciel ce soir
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted sm:text-lg">
            SkyQuest te propose des missions simples pour trouver les planètes, étoiles et
            constellations visibles depuis chez toi.
          </p>
          <AppButton className="mt-8 max-w-sm" size="lg" fullWidth onClick={() => setStep(2)}>
            Commencer
          </AppButton>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="mx-auto w-full max-w-md">
          <p className="premium-kicker">En quelques minutes</p>
          <h2 className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-[2rem] font-normal leading-tight tracking-[-0.04em] text-white sm:text-[2.4rem]">
            Comment ça marche ?
          </h2>
          <ol className="mt-7 grid gap-3">
            {HOW_IT_WORKS.map((label, index) => (
              <li
                key={label}
                className="flex min-h-14 items-center gap-4 rounded-[16px] border border-white/[0.06] bg-white/[0.025] px-4 py-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/[0.12] text-sm font-bold text-accent-cyan">
                  {index + 1}
                </span>
                <span className="text-sm font-medium leading-5 text-text sm:text-base">
                  {label}
                </span>
              </li>
            ))}
          </ol>
          <AppButton className="mt-7" size="lg" fullWidth onClick={() => setStep(3)}>
            Continuer
          </AppButton>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-md">
        <p className="premium-kicker">Confidentialité</p>
        <h2 className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-[2rem] font-normal leading-tight tracking-[-0.04em] text-white sm:text-[2.4rem]">
          Ton ciel, sans profilage
        </h2>
        <div className="mt-6 rounded-[20px] border border-accent/20 bg-accent/[0.07] p-5">
          <ul className="grid gap-3 text-sm leading-6 text-muted sm:text-base">
            <li>
              Ta position sert à calculer le ciel visible et la météo locale. Elle ne sert pas à
              créer un profil.
            </li>
            <li>Tes observations restent sur ton appareil. Aucun compte n’est nécessaire.</li>
            <li>
              La caméra et l’orientation ne seront proposées que pendant une mission. Aucune photo
              n’est envoyée.
            </li>
          </ul>
        </div>

        {errorMessage ? (
          <div
            role="status"
            className="mt-4 rounded-[16px] border border-warning/20 bg-warning/[0.08] p-4 text-sm leading-6 text-muted"
          >
            <p className="font-semibold text-text">Tu peux continuer sans position.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          <AppButton
            size="lg"
            fullWidth
            onClick={() => void handleAuthorizePosition()}
            isLoading={isRequestingPosition}
          >
            {isRequestingPosition ? "Localisation en cours…" : "Autoriser la position"}
          </AppButton>
          <AppButton variant="ghost" size="lg" fullWidth onClick={finishOnboarding}>
            {errorMessage ? "Continuer sans position" : "Passer pour l’instant"}
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#0a0a0b]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Découvrir SkyQuest"
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col rounded-[20px] border border-white/[0.06] bg-[radial-gradient(circle_at_top,rgba(124,92,255,0.12),transparent_42%),#161619] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:p-8">
        <header className="flex items-center justify-between gap-4">
          <Image
            src="/newlogo.png"
            alt="SkyQuest"
            width={48}
            height={48}
            className="h-12 w-12 rounded-[12px] object-cover"
            priority
          />
          <button
            type="button"
            onClick={finishOnboarding}
            className="min-h-11 rounded-full px-3 text-sm font-medium text-muted hover:text-text"
          >
            Passer
          </button>
        </header>

        <div className="flex flex-1 items-center py-6 sm:py-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="w-full"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer
          className="flex items-center justify-between gap-4"
          aria-label={`Étape ${step} sur 3`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {step}/3
          </span>
          <div className="flex items-center gap-2" aria-hidden="true">
            {STEPS.map((item) => (
              <span
                key={item}
                className={`h-2 rounded-full transition-[width,background-color] duration-300 ${step === item ? "w-7 bg-accent" : "w-2 bg-white/20"}`}
              />
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
