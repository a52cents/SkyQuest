"use client";

import { useEffect, useRef, useState } from "react";
import {
  getCameraPointing,
  type CameraPointing,
  type DeviceOrientationReading,
} from "@/lib/orientation";

type AbsoluteOrientationSensorInstance = EventTarget & {
  quaternion: readonly number[] | null;
  start: () => void;
  stop: () => void;
};

type AbsoluteOrientationSensorConstructor = new (options?: {
  frequency?: number;
  referenceFrame?: "device" | "screen";
}) => AbsoluteOrientationSensorInstance;

type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

const UNAVAILABLE_POINTING: CameraPointing = {
  azimuth: null,
  altitude: null,
  source: "unavailable",
};

export function useDeviceOrientation(enabled: boolean): CameraPointing {
  const [pointing, setPointing] = useState<CameraPointing>(UNAVAILABLE_POINTING);
  const smoothedAzimuth = useRef<number | null>(null);
  const smoothedAltitude = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let sensor: AbsoluteOrientationSensorInstance | null = null;
    let fallbackStarted = false;

    const handleReading = (reading: DeviceOrientationReading) => {
      const raw = getCameraPointing(reading);

      if (raw.azimuth !== null) {
        if (smoothedAzimuth.current === null) {
          smoothedAzimuth.current = raw.azimuth;
        } else {
          let difference = raw.azimuth - smoothedAzimuth.current;
          if (difference > 180) difference -= 360;
          if (difference < -180) difference += 360;
          smoothedAzimuth.current = (smoothedAzimuth.current + difference * 0.2 + 360) % 360;
        }
      }

      if (raw.altitude !== null) {
        smoothedAltitude.current =
          smoothedAltitude.current === null
            ? raw.altitude
            : smoothedAltitude.current + (raw.altitude - smoothedAltitude.current) * 0.2;
      }

      setPointing({
        azimuth: smoothedAzimuth.current,
        altitude: smoothedAltitude.current,
        source: raw.source,
      });
    };

    const handleFallback = (event: Event) => {
      const orientationEvent = event as CompassEvent;
      handleReading({
        alpha: orientationEvent.alpha,
        beta: orientationEvent.beta,
        gamma: orientationEvent.gamma,
        webkitCompassHeading: orientationEvent.webkitCompassHeading,
      });
    };

    const startFallback = () => {
      if (fallbackStarted || !("DeviceOrientationEvent" in window)) {
        return;
      }
      fallbackStarted = true;
      window.addEventListener("deviceorientationabsolute", handleFallback);
      window.addEventListener("deviceorientation", handleFallback);
    };

    const SensorConstructor = (
      window as Window & {
        AbsoluteOrientationSensor?: AbsoluteOrientationSensorConstructor;
      }
    ).AbsoluteOrientationSensor;

    if (SensorConstructor) {
      try {
        sensor = new SensorConstructor({ frequency: 30, referenceFrame: "device" });
        sensor.addEventListener("reading", () => {
          const quaternion = sensor?.quaternion;
          if (
            !quaternion ||
            quaternion.length < 4 ||
            !quaternion.slice(0, 4).every(Number.isFinite)
          ) {
            return;
          }
          handleReading({
            alpha: null,
            beta: null,
            gamma: null,
            absoluteQuaternion: [quaternion[0], quaternion[1], quaternion[2], quaternion[3]],
          });
        });
        sensor.addEventListener("error", startFallback);
        sensor.start();
      } catch {
        startFallback();
      }
    } else {
      startFallback();
    }

    return () => {
      sensor?.stop();
      window.removeEventListener("deviceorientationabsolute", handleFallback);
      window.removeEventListener("deviceorientation", handleFallback);
    };
  }, [enabled]);

  return pointing;
}
