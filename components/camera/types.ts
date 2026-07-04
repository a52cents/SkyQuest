import type { ObservationPhotoDraft, SkyQuest } from "@/lib/types";

export type CameraStatus = "idle" | "starting" | "active" | "error";
export type OrientationStatus = "idle" | "active" | "denied" | "unsupported";
export type OrientationConfidence = "high" | "medium" | "low";
export type GuidanceReliability = "reliable" | "approximate" | "text_recommended";
export type PhotoCaptureStatus = "idle" | "capturing" | "ready" | "error";

export type CameraGuideProps = {
  quest: SkyQuest;
  onSeen: (photo?: ObservationPhotoDraft) => void;
  onMissed: () => void;
};

export type CameraZoomRange = { min: number; max: number; step: number };
export type CameraCapabilities = MediaTrackCapabilities & {
  zoom?: { min?: number; max?: number; step?: number };
};
export type CameraSettings = MediaTrackSettings & { zoom?: number };
export type CameraConstraintSet = MediaTrackConstraintSet & { zoom?: number };
export type PhotoDraft = { photoDataUrl: string; photoThumbnailDataUrl: string };

export type CameraGuidanceState = {
  isAligned: boolean;
  hasPrecisePoint: boolean;
  directionArrow: string;
  altitudeArrow: string;
  mainHint: string;
  targetAltitudeLabel: string;
};
