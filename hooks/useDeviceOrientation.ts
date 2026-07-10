"use client";

import { useEffect, useRef, useState } from "react";
import { smoothCameraPointing, type CameraPointing } from "@/lib/orientation";
import {
  startOrientationTracking,
  type AbsoluteOrientationSensorConstructor,
} from "@/lib/orientation-tracker";
import { getCachedMagneticDeclination } from "@/lib/magnetic-declination";

type OrientationLocation = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number | null;
};

const UNAVAILABLE_POINTING: CameraPointing = {
  azimuth: null,
  rawAzimuth: null,
  northReference: "unavailable",
  magneticDeclination: null,
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

export function useDeviceOrientation(
  enabled: boolean,
  observerLocation: OrientationLocation | null = null,
): CameraPointing {
  const [pointing, setPointing] = useState<CameraPointing>(UNAVAILABLE_POINTING);
  const smoothedPointing = useRef<CameraPointing | null>(null);
  const observerLatitude = observerLocation?.latitude;
  const observerLongitude = observerLocation?.longitude;
  const observerAltitudeMeters = observerLocation?.altitudeMeters;

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
        getMagneticDeclination:
          observerLatitude !== undefined && observerLongitude !== undefined
            ? () =>
                getCachedMagneticDeclination({
                  latitude: observerLatitude,
                  longitude: observerLongitude,
                  altitudeMeters: observerAltitudeMeters,
                  date: new Date(),
                })
            : undefined,
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
  }, [enabled, observerAltitudeMeters, observerLatitude, observerLongitude]);

  return pointing;
}
