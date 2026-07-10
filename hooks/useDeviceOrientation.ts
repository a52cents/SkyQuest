"use client";

import { useEffect, useRef, useState } from "react";
import { smoothCameraPointing, type CameraPointing } from "@/lib/orientation";
import {
  startOrientationTracking,
  type AbsoluteOrientationSensorConstructor,
} from "@/lib/orientation-tracker";

const UNAVAILABLE_POINTING: CameraPointing = {
  azimuth: null,
  altitude: null,
  roll: null,
  quaternion: null,
  basis: null,
  screenAngle: 0,
  source: "unavailable",
};

function readScreenAngle(): number {
  const modernAngle = window.screen.orientation?.angle;
  if (typeof modernAngle === "number" && Number.isFinite(modernAngle)) return modernAngle;
  const legacyAngle = (window as Window & { orientation?: number }).orientation;
  return typeof legacyAngle === "number" && Number.isFinite(legacyAngle) ? legacyAngle : 0;
}

export function useDeviceOrientation(enabled: boolean): CameraPointing {
  const [pointing, setPointing] = useState<CameraPointing>(UNAVAILABLE_POINTING);
  const smoothedPointing = useRef<CameraPointing | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const SensorConstructor = (
      window as Window & {
        AbsoluteOrientationSensor?: AbsoluteOrientationSensorConstructor;
      }
    ).AbsoluteOrientationSensor;

    const stop = startOrientationTracking(
      {
        windowTarget: window,
        screenOrientationTarget: window.screen.orientation ?? null,
        hasDeviceOrientation: "DeviceOrientationEvent" in window,
        getScreenAngle: readScreenAngle,
        SensorConstructor,
      },
      (rawPointing) => {
        const smoothed = smoothCameraPointing(smoothedPointing.current, rawPointing);
        smoothedPointing.current = smoothed;
        setPointing(smoothed);
      },
    );

    return () => {
      stop();
      smoothedPointing.current = null;
    };
  }, [enabled]);

  return pointing;
}
