import assert from "node:assert/strict";
import test from "node:test";
import { getUpcomingCelestialEvents } from "../lib/celestial-events.ts";

test("celestial events stay inside the requested window and chronological order", () => {
  const start = new Date("2026-07-02T00:00:00Z");
  const end = new Date(start.getTime() + 60 * 86_400_000);
  const events = getUpcomingCelestialEvents(start, 60);

  assert.ok(events.length > 0);
  events.forEach((event, index) => {
    assert.ok(event.date >= start);
    assert.ok(event.date <= end);
    if (index > 0) assert.ok(events[index - 1].date <= event.date);
  });
});

test("eclipses replace their simultaneous ordinary moon phase", () => {
  const events = getUpcomingCelestialEvents(new Date("2026-08-01T00:00:00Z"), 40);
  const solarEclipse = events.find((event) => event.type === "solar_eclipse");
  const lunarEclipse = events.find((event) => event.type === "lunar_eclipse");

  assert.ok(solarEclipse);
  assert.ok(lunarEclipse);
  assert.equal(
    events.some(
      (event) =>
        event.type === "new_moon" && Math.abs(event.date - solarEclipse.date) < 12 * 60 * 60 * 1000,
    ),
    false,
  );
  assert.equal(
    events.some(
      (event) =>
        event.type === "full_moon" &&
        Math.abs(event.date - lunarEclipse.date) < 12 * 60 * 60 * 1000,
    ),
    false,
  );
});

test("supermoons are backed by a computed perigee below 360000 km", () => {
  const events = getUpcomingCelestialEvents(new Date("2026-12-01T00:00:00Z"), 60);
  const supermoons = events.filter((event) => event.type === "supermoon");

  assert.ok(supermoons.length > 0);
  supermoons.forEach((event) => {
    assert.ok(typeof event.details?.distanceKm === "number");
    assert.ok(event.details.distanceKm < 360_000);
  });
});

test("non-positive windows return no events", () => {
  assert.deepEqual(getUpcomingCelestialEvents(new Date("2026-01-01T00:00:00Z"), 0), []);
});
