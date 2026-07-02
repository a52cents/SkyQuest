import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { CameraFallback } from "./CameraFallback";

type CameraSetupPanelProps = {
  open: boolean;
  starting: boolean;
  cameraError: string | null;
  orientationError: string | null;
  onActivate: () => void;
  onContinueWithoutSensors: () => void;
};

export function CameraSetupPanel(props: CameraSetupPanelProps) {
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0a0a0b]/90 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-title"
    >
      <AppCard className="w-full max-w-md select-text" padding="lg">
        <p className="premium-kicker">Avant de commencer</p>
        <h2
          id="setup-title"
          className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-3xl font-normal tracking-[-0.03em] text-white"
        >
          Prépare ton guidage
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          La caméra montre le ciel devant toi. L&apos;orientation aide SkyQuest à placer la cible.
          Aucune photo n&apos;est envoyée.
        </p>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
            <p className="font-bold text-white">Caméra</p>
            <p className="mt-1 text-sm text-muted">Active uniquement pendant cette mission.</p>
          </div>
          <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
            <p className="font-bold text-white">Mouvement et orientation</p>
            <p className="mt-1 text-sm text-muted">
              Utilisés pour les indications et le repère céleste.
            </p>
          </div>
        </div>
        {props.cameraError || props.orientationError ? (
          <div className="mt-4">
            <CameraFallback
              cameraError={props.cameraError}
              zoomError={null}
              orientationError={props.orientationError}
            />
          </div>
        ) : null}
        <div className="mt-5 grid gap-3">
          <AppButton onClick={props.onActivate} disabled={props.starting} fullWidth>
            {props.starting ? "Activation..." : "Activer le guidage"}
          </AppButton>
          <AppButton
            variant="ghost"
            onClick={props.onContinueWithoutSensors}
            disabled={props.starting}
            fullWidth
          >
            Continuer avec les indications simples
          </AppButton>
        </div>
      </AppCard>
    </div>
  );
}
