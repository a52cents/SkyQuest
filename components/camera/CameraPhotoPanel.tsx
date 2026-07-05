import { AppButton } from "@/components/AppButton";
import type { PhotoCaptureStatus, PhotoDraft } from "./types";

type CameraPhotoPanelProps = {
  open: boolean;
  draft: PhotoDraft | null;
  status: PhotoCaptureStatus;
  error: string | null;
  submitting: boolean;
  onSaveWithPhoto: () => void;
  onContinueWithoutPhoto: () => void;
  onClose: () => void;
  onChoosePhoto: () => void;
};

export function CameraPhotoPanel(props: CameraPhotoPanelProps) {
  if (!props.open) return null;
  return (
    <div
      data-camera-control
      className="fixed inset-0 z-50 overflow-hidden bg-[#0a0a0b]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-title"
    >
      {props.draft ? (
        <div
          aria-label="Aperçu de la photo"
          className="absolute inset-0 bg-cover bg-center"
          role="img"
          style={{ backgroundImage: `url(${props.draft.photoDataUrl})` }}
        />
      ) : null}
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,12,0.72),transparent_28%,transparent_55%,rgba(3,5,12,0.92))]"
        aria-hidden="true"
      />
      <div className="camera-guide-safe-area relative z-20 flex h-[100dvh] flex-col justify-between">
        <div className="rounded-[18px] border border-white/[0.08] bg-[#0a0a0b]/78 px-4 py-3 text-center backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-cyan">
            Photo optionnelle
          </p>
          <h2
            id="photo-title"
            className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-lg font-normal text-white"
          >
            Ajoute un souvenir de cette observation
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Une étoile ou une planète peut ne pas apparaître sur une photo mobile. Cela ne change
            pas ton observation.
          </p>
        </div>
        <div className="rounded-[20px] border border-white/[0.08] bg-[#0a0a0b]/85 p-3 shadow-[0_-12px_44px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          {props.error ? (
            <p className="mb-3 rounded-[13px] border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
              {props.error}
            </p>
          ) : null}
          {props.status === "capturing" ? (
            <p className="py-4 text-center text-sm font-semibold text-muted">
              Préparation de ton souvenir…
            </p>
          ) : props.draft ? (
            <div className="grid gap-2">
              <AppButton
                variant="success"
                onClick={props.onSaveWithPhoto}
                fullWidth
                disabled={props.submitting}
                hapticFeedback={false}
              >
                Enregistrer avec cette photo
              </AppButton>
              <AppButton
                variant="secondary"
                onClick={props.onContinueWithoutPhoto}
                fullWidth
                disabled={props.submitting}
                hapticFeedback={false}
              >
                Continuer sans photo
              </AppButton>
              <AppButton variant="ghost" onClick={props.onClose} fullWidth>
                Retour au guidage
              </AppButton>
            </div>
          ) : (
            <div className="grid gap-2">
              <AppButton onClick={props.onChoosePhoto} fullWidth>
                Prendre ou choisir une photo
              </AppButton>
              <AppButton
                variant="secondary"
                onClick={props.onContinueWithoutPhoto}
                fullWidth
                disabled={props.submitting}
                hapticFeedback={false}
              >
                Continuer sans photo
              </AppButton>
              <AppButton variant="ghost" onClick={props.onClose} fullWidth>
                Retour au guidage
              </AppButton>
            </div>
          )}
          <p className="mt-3 text-center text-xs leading-5 text-faint">
            Photo compressée et conservée uniquement dans le journal local. Elle n’est ni envoyée ni
            analysée.
          </p>
        </div>
      </div>
    </div>
  );
}
