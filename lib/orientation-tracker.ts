import {
  getCameraPointing,
  type CameraPointing,
  type DeviceOrientationReading,
} from "./orientation.ts";
import type { MagneticDeclinationResult } from "./magnetic-declination.ts";

export type AbsoluteOrientationSensorLike = EventTarget & {
  quaternion: readonly number[] | null;
  start: () => void;
  stop: () => void;
};

export type AbsoluteOrientationSensorConstructor = new (options?: {
  frequency?: number;
  referenceFrame?: "device" | "screen";
}) => AbsoluteOrientationSensorLike;

export type OrientationTrackerEnvironment = {
  windowTarget: EventTarget;
  screenOrientationTarget: EventTarget | null;
  hasDeviceOrientation: boolean;
  getScreenAngle: () => number;
  SensorConstructor?: AbsoluteOrientationSensorConstructor;
  getMagneticDeclination?: () => MagneticDeclinationResult | null;
};

type CompassOrientationEvent = Event & {
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  webkitCompassHeading?: number;
  absolute?: boolean;
};

export function startOrientationTracking(
  environment: OrientationTrackerEnvironment,
  onPointing: (pointing: CameraPointing) => void,
): () => void {
  let sensor: AbsoluteOrientationSensorLike | null = null;
  let fallbackStarted = false;
  let lastReading: DeviceOrientationReading | null = null;

  const publish = (reading: DeviceOrientationReading) => {
    lastReading = reading;
    onPointing(
      getCameraPointing(
        reading,
        environment.getScreenAngle(),
        environment.getMagneticDeclination?.() ?? null,
      ),
    );
  };
  const handleFallback = (event: Event) => {
    const reading = event as CompassOrientationEvent;
    publish({
      alpha: reading.alpha ?? null,
      beta: reading.beta ?? null,
      gamma: reading.gamma ?? null,
      webkitCompassHeading: reading.webkitCompassHeading,
      northReference:
        typeof reading.webkitCompassHeading === "number" &&
        Number.isFinite(reading.webkitCompassHeading)
          ? "magnetic"
          : reading.absolute === true || event.type === "deviceorientationabsolute"
            ? "magnetic"
            : reading.absolute === false
              ? "relative"
              : "unknown",
    });
  };
  const startFallback = () => {
    if (fallbackStarted || !environment.hasDeviceOrientation) return;
    fallbackStarted = true;
    environment.windowTarget.addEventListener("deviceorientationabsolute", handleFallback);
    environment.windowTarget.addEventListener("deviceorientation", handleFallback);
  };
  const handleScreenChange = () => {
    if (lastReading) publish(lastReading);
  };

  environment.screenOrientationTarget?.addEventListener("change", handleScreenChange);
  environment.windowTarget.addEventListener("orientationchange", handleScreenChange);

  if (environment.SensorConstructor) {
    try {
      sensor = new environment.SensorConstructor({ frequency: 30, referenceFrame: "device" });
      sensor.addEventListener("reading", () => {
        const quaternion = sensor?.quaternion;
        if (!quaternion) return;
        publish({
          alpha: null,
          beta: null,
          gamma: null,
          absoluteQuaternion:
            quaternion.length >= 4
              ? [quaternion[0], quaternion[1], quaternion[2], quaternion[3]]
              : null,
          northReference: "magnetic",
        });
      });
      sensor.addEventListener("error", startFallback);
      sensor.start();
    } catch {
      sensor = null;
      startFallback();
    }
  } else {
    startFallback();
  }

  return () => {
    sensor?.stop();
    environment.screenOrientationTarget?.removeEventListener("change", handleScreenChange);
    environment.windowTarget.removeEventListener("orientationchange", handleScreenChange);
    environment.windowTarget.removeEventListener("deviceorientationabsolute", handleFallback);
    environment.windowTarget.removeEventListener("deviceorientation", handleFallback);
  };
}
