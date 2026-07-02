import assert from "node:assert/strict";
import test from "node:test";
import * as Astronomy from "astronomy-engine";
import { equatorialJ2000ToHorizontal } from "../lib/astro.ts";

test("J2000 coordinates are rotated into the local horizon frame", () => {
  const date = new Date("2026-07-01T22:00:00Z");
  const input = {
    rightAscensionHours: 18.6156,
    declinationDegrees: 38.7837,
    latitude: 48.8566,
    longitude: 2.3522,
    date,
  };
  const actual = equatorialJ2000ToHorizontal(input);
  const observer = new Astronomy.Observer(input.latitude, input.longitude, 0);
  const vector = Astronomy.VectorFromSphere(
    new Astronomy.Spherical(input.declinationDegrees, input.rightAscensionHours * 15, 1),
    date,
  );
  const expected = Astronomy.HorizonFromVector(
    Astronomy.RotateVector(Astronomy.Rotation_EQJ_HOR(date, observer), vector),
    "normal",
  );
  assert.ok(Math.abs(actual.azimuth - expected.lon) < 1e-10);
  assert.ok(Math.abs(actual.altitude - expected.lat) < 1e-10);
});
