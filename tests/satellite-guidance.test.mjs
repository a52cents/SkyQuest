import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSatellitePositionAt } from "../lib/satellite-guidance.ts";

const cameraGuideSource = readFileSync(
  new URL("../components/camera/CameraGuide.tsx", import.meta.url),
  "utf8",
);
const questGeneratorSource = readFileSync(
  new URL("../lib/quest-generator.ts", import.meta.url),
  "utf8",
);

const trajectory = [
  { at: "2026-07-05T01:12:00.000Z", azimuth: 350, altitude: 12 },
  { at: "2026-07-05T01:12:20.000Z", azimuth: 10, altitude: 32 },
  { at: "2026-07-05T01:12:40.000Z", azimuth: 40, altitude: 20 },
];

test("satellite guidance interpolates the current position across north", () => {
  const position = getSatellitePositionAt(trajectory, new Date("2026-07-05T01:12:10.000Z"));
  assert.ok(position);
  assert.ok(position.azimuth < 0.001 || position.azimuth > 359.999);
  assert.equal(position.altitude, 22);
});

test("satellite guidance refuses a stale point outside the sampled trajectory", () => {
  assert.equal(getSatellitePositionAt(trajectory, new Date("2026-07-05T01:11:59.000Z")), null);
  assert.equal(getSatellitePositionAt(trajectory, new Date("2026-07-05T01:15:00.000Z")), null);
  assert.equal(getSatellitePositionAt(undefined, new Date("2026-07-05T01:12:10.000Z")), null);
});

test("satellite camera guidance refreshes continuously and falls back to text safely", () => {
  assert.match(cameraGuideSource, /quest\.targetType === "satellite" \? 1_000 : 30_000/);
  assert.match(cameraGuideSource, /calibratedTargetAzimuth === null \? "text_recommended"/);
  assert.match(cameraGuideSource, /Le satellite se déplace vite/);
  assert.match(questGeneratorSource, /getSatellitePositionAt\(quest\.satelliteTrajectory, now\)/);
  assert.match(questGeneratorSource, /azimuth: null,[\s\S]+altitude: null/);
});
