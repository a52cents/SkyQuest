import type { SkyQuest } from "@/lib/types";
import type { CameraCapabilities, CameraSettings, CameraZoomRange } from "./types";

export const DIRECTION_ALIGNMENT_THRESHOLD_DEGREES = 15;
export const ALTITUDE_ALIGNMENT_THRESHOLD_DEGREES = 10;

export function getDirectionArrow(delta: number | null): string {
  if (delta === null) return "";
  if (Math.abs(delta) <= DIRECTION_ALIGNMENT_THRESHOLD_DEGREES) return "◎";
  return delta > 0 ? "→" : "←";
}

export function getAltitudeArrow(delta: number | null): string {
  if (delta === null) return "";
  if (Math.abs(delta) <= ALTITUDE_ALIGNMENT_THRESHOLD_DEGREES) return "◎";
  return delta > 0 ? "↑" : "↓";
}

export function getGearLabel(quest: SkyQuest): string {
  return quest.requiredGear === "binoculars_recommended" ? "Jumelles" : "Oeil nu";
}

export function readCameraZoomRange(capabilities: CameraCapabilities): CameraZoomRange | null {
  const zoom = capabilities.zoom;
  if (
    !zoom ||
    typeof zoom.min !== "number" ||
    typeof zoom.max !== "number" ||
    zoom.max <= zoom.min
  ) {
    return null;
  }
  return {
    min: zoom.min,
    max: zoom.max,
    step: typeof zoom.step === "number" && zoom.step > 0 ? zoom.step : 0.5,
  };
}

export function readCameraCapabilities(track: MediaStreamTrack): CameraCapabilities | null {
  return typeof track.getCapabilities === "function"
    ? (track.getCapabilities() as CameraCapabilities)
    : null;
}

export function getCameraSettings(track: MediaStreamTrack): CameraSettings {
  return track.getSettings() as CameraSettings;
}

export function formatZoom(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

export function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera refusee. Verifie les permissions, puis relance le guidage.";
    }
    if (error.name === "NotFoundError") {
      return "Aucune camera disponible. Utilise le guidage texte.";
    }
    if (error.name === "NotReadableError") {
      return "La camera est deja utilisee ou indisponible momentanement.";
    }
  }
  return "Camera indisponible. Tu peux quand meme suivre la direction indiquee.";
}
