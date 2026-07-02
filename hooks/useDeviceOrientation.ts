"use client";

import { useEffect, useRef, useState } from "react";
import { getCameraPointing, CameraPointing, DeviceOrientationReading } from "@/lib/orientation";

export function useDeviceOrientation() {
  const [pointing, setPointing] = useState<CameraPointing>({
    azimuth: null,
    altitude: null,
    source: "unavailable",
  });

  // Références pour le lissage (Lerp)
  const smoothedAzimuth = useRef<number | null>(null);
  const smoothedAltitude = useRef<number | null>(null);

  useEffect(() => {
    let absoluteSensor: any = null;
    let fallbackActive = false;

    const lerp = (a: number | null, b: number, t: number) => (a === null ? b : a + (b - a) * t);

    const handleReading = (reading: DeviceOrientationReading) => {
      const rawPointing = getCameraPointing(reading);

      // Lissage des valeurs (facteur 0.2)
      if (rawPointing.azimuth !== null) {
        // Gestion de la boucle 360° pour le lerp
        if (smoothedAzimuth.current !== null) {
          let diff = rawPointing.azimuth - smoothedAzimuth.current;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          smoothedAzimuth.current = smoothedAzimuth.current + diff * 0.2;
          smoothedAzimuth.current = (smoothedAzimuth.current + 360) % 360;
        } else {
          smoothedAzimuth.current = rawPointing.azimuth;
        }
      }

      if (rawPointing.altitude !== null) {
        smoothedAltitude.current = lerp(smoothedAltitude.current, rawPointing.altitude, 0.2);
      }

      setPointing({
        azimuth: smoothedAzimuth.current,
        altitude: smoothedAltitude.current,
        source: rawPointing.source,
      });
    };

    // PRIORITÉ 1 : AbsoluteOrientationSensor
    if (typeof window !== "undefined" && "AbsoluteOrientationSensor" in window) {
      try {
        absoluteSensor = new (window as any).AbsoluteOrientationSensor({ frequency: 60 });
        
        absoluteSensor.addEventListener("reading", () => {
          const q = absoluteSensor.quaternion; // [x, y, z, w]
          if (q) {
            handleReading({
              alpha: null,
              beta: null,
              gamma: null,
              absoluteQuaternion: [q[0], q[1], q[2], q[3]] as [number, number, number, number],
            });
          }
        });

        absoluteSensor.addEventListener("error", (event: any) => {
          if (event.error.name === "NotReadableError") {
            console.warn("AbsoluteOrientationSensor non lisible, fallback sur deviceorientation.");
            fallbackActive = true;
            startFallback();
          }
        });

        absoluteSensor.start();
      } catch (e) {
        console.warn("AbsoluteOrientationSensor instantiation failed, fallback.", e);
        fallbackActive = true;
        startFallback();
      }
    } else {
      fallbackActive = true;
      startFallback();
    }

    // FALLBACK : deviceorientation
    function startFallback() {
      const handler = (event: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
        handleReading({
          alpha: event.alpha,
          beta: event.beta,
          gamma: event.gamma,
          webkitCompassHeading: event.webkitCompassHeading,
        });
      };

      // iOS 13+ nécessite une demande de permission
      if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
        (DeviceOrientationEvent as any).requestPermission()
          .then((response: string) => {
            if (response === "granted") {
              window.addEventListener("deviceorientation", handler);
            }
          })
          .catch(console.error);
      } else {
        window.addEventListener("deviceorientationabsolute", handler as any);
        window.addEventListener("deviceorientation", handler as any);
      }

      // Cleanup du fallback
      return () => {
        window.removeEventListener("deviceorientationabsolute", handler as any);
        window.removeEventListener("deviceorientation", handler as any);
      };
    }

    return () => {
      if (absoluteSensor) {
        absoluteSensor.stop();
      }
    };
  }, []);

  return pointing;
}
