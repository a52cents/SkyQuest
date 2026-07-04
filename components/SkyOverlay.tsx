"use client";

import { type RefObject, useEffect, useRef } from "react";
import { equatorialJ2000ToHorizontal } from "@/lib/astro";
import { getSkyFigure } from "@/lib/constellation-figures";
import { meteorShowers } from "@/lib/meteor-showers";
import type { CameraPointing } from "@/lib/orientation";
import {
  crossProduct,
  horizontalCoordinatesToVector,
  normalizeVector,
  projectHorizontalTarget,
  smoothCameraBasis,
  type CameraBasis,
  type ScreenProjection,
  type Vector3,
} from "@/lib/sky-projection";
import type { SkyQuest } from "@/lib/types";

type ObserverLocation = { latitude: number; longitude: number };

type OverlayPoint = {
  id: string;
  label?: string;
  magnitude?: number;
  vector: Vector3;
};

type OverlayScene = {
  kind: "point" | "figure" | "cluster" | "galaxy" | "meteor" | "satellite";
  label: string;
  points: OverlayPoint[];
  segments: Array<readonly [string, string]>;
};

type SkyOverlayProps = {
  quest: SkyQuest;
  location: ObserverLocation | null;
  orientationRef: RefObject<CameraPointing | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  zoom: number | null;
  enabled: boolean;
};

function pointFromQuest(quest: SkyQuest, label = quest.title): OverlayPoint | null {
  return quest.azimuth === null || quest.altitude === null
    ? null
    : {
        id: quest.target,
        label,
        vector: horizontalCoordinatesToVector(quest.azimuth, quest.altitude),
      };
}

function buildScene(
  quest: SkyQuest,
  location: ObserverLocation | null,
  date: Date,
): OverlayScene | null {
  if (quest.targetType === "free_observation") {
    return null;
  }

  const figure = getSkyFigure(quest.target);
  if (figure && location) {
    const points = figure.stars.map((star) => {
      const horizontal = equatorialJ2000ToHorizontal({
        rightAscensionHours: star.rightAscensionHours,
        declinationDegrees: star.declinationDegrees,
        latitude: location.latitude,
        longitude: location.longitude,
        date,
      });
      return {
        id: star.id,
        label: star.label,
        magnitude: star.magnitude,
        vector: horizontalCoordinatesToVector(horizontal.azimuth, horizontal.altitude),
      };
    });
    return {
      kind: figure.kind === "cluster" ? "cluster" : "figure",
      label: figure.name,
      points,
      segments: figure.segments,
    };
  }

  if (quest.targetType === "meteor_shower" && location) {
    const shower = meteorShowers.find(
      (candidate) => quest.target === `meteor-${candidate.name.toLowerCase()}`,
    );
    if (!shower) {
      return null;
    }
    const horizontal = equatorialJ2000ToHorizontal({
      rightAscensionHours: shower.radiantRightAscensionHours,
      declinationDegrees: shower.radiantDeclinationDegrees,
      latitude: location.latitude,
      longitude: location.longitude,
      date,
    });
    return {
      kind: "meteor",
      label: "Regarde large autour de cette zone",
      points: [
        {
          id: shower.id,
          vector: horizontalCoordinatesToVector(horizontal.azimuth, horizontal.altitude),
        },
      ],
      segments: [],
    };
  }

  const point = pointFromQuest(quest, quest.title.replace(/^(Trouve|Repère|Tente)\s+/i, ""));
  if (!point) {
    return null;
  }

  if (quest.targetType === "satellite") {
    const targetTime = quest.targetTime ? new Date(quest.targetTime).getTime() : Number.NaN;
    if (!Number.isFinite(targetTime) || Math.abs(targetTime - date.getTime()) > 45 * 60_000) {
      return null;
    }
    return {
      kind: "satellite",
      label: "Passage prévu dans cette zone",
      points: [point],
      segments: [],
    };
  }

  const kind =
    quest.targetType === "galaxy"
      ? "galaxy"
      : quest.targetType === "star_cluster"
        ? "cluster"
        : "point";
  return { kind, label: point.label ?? quest.title, points: [point], segments: [] };
}

export function questSupportsSkyOverlay(quest: SkyQuest): boolean {
  if (quest.targetType === "free_observation") {
    return false;
  }
  if (getSkyFigure(quest.target) || quest.targetType === "meteor_shower") {
    return true;
  }
  return quest.azimuth !== null && quest.altitude !== null;
}

function drawLabel(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  context.font = "600 12px Inter, system-ui, sans-serif";
  context.fillStyle = "rgba(248, 250, 252, 0.92)";
  context.shadowColor = "rgba(0, 0, 0, 0.9)";
  context.shadowBlur = 5;
  context.fillText(text, x, y);
  context.shadowBlur = 0;
}

function drawScene(
  context: CanvasRenderingContext2D,
  scene: OverlayScene,
  projections: Map<string, ScreenProjection>,
  time: number,
  reducedMotion: boolean,
) {
  const pulse = reducedMotion ? 0 : Math.sin(time / 850) * 2;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (scene.kind === "figure" || scene.kind === "cluster") {
    context.strokeStyle = "rgba(139, 112, 255, 0.72)";
    context.lineWidth = 1.25;
    for (const [fromId, toId] of scene.segments) {
      const from = projections.get(fromId);
      const to = projections.get(toId);
      if (!from || !to) {
        continue;
      }
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
  }

  if (scene.kind === "cluster") {
    const visiblePoints = [...projections.values()].filter((projection) => projection.onScreen);
    if (visiblePoints.length > 0) {
      const centerX =
        visiblePoints.reduce((total, point) => total + point.x, 0) / visiblePoints.length;
      const centerY =
        visiblePoints.reduce((total, point) => total + point.y, 0) / visiblePoints.length;
      const gradient = context.createRadialGradient(centerX, centerY, 2, centerX, centerY, 34);
      gradient.addColorStop(0, "rgba(125, 211, 252, 0.28)");
      gradient.addColorStop(1, "rgba(124, 92, 255, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(centerX, centerY, 34, 0, Math.PI * 2);
      context.fill();
    }
  }

  for (const point of scene.points) {
    const projected = projections.get(point.id);
    if (!projected || !projected.onScreen) {
      continue;
    }

    if (scene.kind === "galaxy") {
      const radius = 42;
      const gradient = context.createRadialGradient(
        projected.x,
        projected.y,
        2,
        projected.x,
        projected.y,
        radius,
      );
      gradient.addColorStop(0, "rgba(125, 211, 252, 0.3)");
      gradient.addColorStop(1, "rgba(124, 92, 255, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(projected.x, projected.y, radius, radius * 0.58, -0.35, 0, Math.PI * 2);
      context.fill();
    }

    if (scene.kind === "meteor" || scene.kind === "satellite") {
      context.save();
      context.setLineDash(scene.kind === "satellite" ? [7, 7] : [3, 8]);
      context.strokeStyle = "rgba(125, 211, 252, 0.72)";
      context.lineWidth = 1.4;
      context.beginPath();
      context.ellipse(
        projected.x,
        projected.y,
        scene.kind === "meteor" ? 76 : 82,
        scene.kind === "meteor" ? 55 : 30,
        -0.28,
        0,
        Math.PI * 2,
      );
      context.stroke();
      context.restore();
      drawLabel(context, scene.label, Math.max(12, projected.x - 78), projected.y + 74);
      continue;
    }

    const starRadius =
      point.magnitude === undefined ? 3.2 : Math.max(1.8, 4.2 - point.magnitude * 0.45);
    context.fillStyle = "rgba(226, 240, 255, 0.96)";
    context.beginPath();
    context.arc(projected.x, projected.y, starRadius, 0, Math.PI * 2);
    context.fill();

    if (scene.kind === "point") {
      context.strokeStyle = "rgba(139, 112, 255, 0.9)";
      context.lineWidth = 1.7;
      context.beginPath();
      context.arc(projected.x, projected.y, 18 + pulse, 0, Math.PI * 2);
      context.stroke();
    }
    if (point.label) {
      drawLabel(context, point.label, projected.x + 10, projected.y - 10);
    }
  }

  if (scene.kind === "figure") {
    const anchor = [...projections.values()].find((projection) => projection.onScreen);
    if (anchor) {
      drawLabel(context, scene.label, anchor.x + 12, anchor.y + 22);
    }
  }
}

export function SkyOverlay({
  quest,
  location,
  orientationRef,
  videoRef,
  zoom,
  enabled,
}: SkyOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<OverlayScene | null>(null);
  const zoomRef = useRef(zoom);
  const enabledRef = useRef(enabled);
  const smoothedBasisRef = useRef<CameraBasis | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const refresh = () => {
      sceneRef.current = buildScene(quest, location, new Date());
    };
    refresh();
    const intervalId = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(intervalId);
  }, [location, quest]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) {
      return;
    }

    let width = 0;
    let height = 0;
    let rafId = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const bounds = parent.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();

    const render = (time: number) => {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, width, height);
      const pointing = orientationRef.current;
      const scene = sceneRef.current;
      if (
        context &&
        enabledRef.current &&
        pointing &&
        pointing.azimuth !== null &&
        pointing.altitude !== null &&
        scene
      ) {
        const forward = horizontalCoordinatesToVector(pointing.azimuth, pointing.altitude);
        const right = normalizeVector(crossProduct(forward, { x: 0, y: 0, z: 1 }));
        const up = right ? normalizeVector(crossProduct(right, forward)) : null;
        if (!right || !up) {
          rafId = window.requestAnimationFrame(render);
          return;
        }
        const nextBasis: CameraBasis = {
          forward,
          right,
          up,
          confidence: pointing.source === "absolute-sensor" ? "high" : "medium",
        };
        const basis = smoothCameraBasis(smoothedBasisRef.current, nextBasis);
        smoothedBasisRef.current = basis;
        const video = videoRef.current;
        const projections = new Map<string, ScreenProjection>();
        for (const point of scene.points) {
          const projection = projectHorizontalTarget({
            target: point.vector,
            basis,
            viewportWidth: width,
            viewportHeight: height,
            videoWidth: video?.videoWidth || width,
            videoHeight: video?.videoHeight || height,
            zoom: zoomRef.current ?? 1,
          });
          if (projection) {
            projections.set(point.id, projection);
          }
        }
        drawScene(context, scene, projections, time, reducedMotion);
      }
      rafId = window.requestAnimationFrame(render);
    };
    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
      smoothedBasisRef.current = null;
    };
  }, [orientationRef, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5]"
    />
  );
}
