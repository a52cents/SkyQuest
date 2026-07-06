import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiscoveryAtlasProgress,
  discoveryAtlasEntries,
  filterDiscoveryAtlasEntries,
  normalizeDiscoveryTarget,
  resolveDiscoveryAtlasEntry,
} from "../lib/discovery-atlas.ts";
import { meteorShowers } from "../lib/meteor-showers.ts";
import { createEmptyProgressProfile } from "../lib/progression.ts";

function observation({ id, target, status, createdAt, targetType, photoThumbnailId }) {
  return {
    id,
    target,
    targetType,
    status,
    createdAt,
    questTitle: target,
    visibilityScore: 70,
    photoThumbnailId,
  };
}

test("atlas entries have stable unique ids and normalized aliases do not collide", () => {
  assert.equal(discoveryAtlasEntries.length, 21);
  assert.equal(
    new Set(discoveryAtlasEntries.map((entry) => entry.id)).size,
    discoveryAtlasEntries.length,
  );

  const aliases = discoveryAtlasEntries.flatMap((entry) =>
    [entry.id, entry.target, entry.frenchName, ...(entry.legacyTargetAliases ?? [])].map(
      (alias) => ({
        entryId: entry.id,
        alias: normalizeDiscoveryTarget(alias),
      }),
    ),
  );
  const owners = new Map();
  for (const alias of aliases) {
    const existing = owners.get(alias.alias);
    assert.ok(
      !existing || existing === alias.entryId,
      `alias ${alias.alias} belongs to two entries`,
    );
    owners.set(alias.alias, alias.entryId);
  }
});

test("current catalog, Solar System and meteor targets resolve to atlas entries", () => {
  const expectedCatalogIds = [
    "polaris",
    "ursa-major",
    "cassiopeia",
    "summer-triangle",
    "vega",
    "arcturus",
    "antares",
    "pleiades",
    "andromeda",
    "iss",
  ];
  for (const id of expectedCatalogIds) {
    assert.equal(resolveDiscoveryAtlasEntry(id)?.catalogId, id);
  }
  for (const target of ["Moon", "Venus", "Jupiter", "Saturn", "Mars"]) {
    assert.equal(resolveDiscoveryAtlasEntry(target)?.target, target);
  }
  for (const shower of meteorShowers) {
    assert.equal(
      resolveDiscoveryAtlasEntry(`meteor-${shower.name.toLowerCase()}`)?.id,
      `meteor-${shower.id}`,
    );
    assert.equal(
      resolveDiscoveryAtlasEntry(`meteor_shower_${shower.id}`)?.id,
      `meteor-${shower.id}`,
    );
  }
});

test("legacy aliases ignore case, accents and whitespace while FreeObservation stays excluded", () => {
  assert.equal(resolveDiscoveryAtlasEntry("  VÉNUS  ")?.id, "solar-venus");
  assert.equal(resolveDiscoveryAtlasEntry("Ursa Major")?.id, "catalog-ursa-major");
  assert.equal(resolveDiscoveryAtlasEntry("M31")?.id, "catalog-andromeda");
  assert.equal(resolveDiscoveryAtlasEntry("PERSÉIDES")?.id, "meteor-perseids");
  assert.equal(resolveDiscoveryAtlasEntry("FreeObservation", "free_observation"), null);
  assert.equal(resolveDiscoveryAtlasEntry(" free_observation "), null);
});

test("seen, missed and untouched observations derive the three exact statuses", () => {
  const profile = createEmptyProgressProfile();
  const progress = buildDiscoveryAtlasProgress({
    profile,
    observations: [
      observation({
        id: "seen",
        target: "Moon",
        status: "seen",
        targetType: "moon",
        createdAt: "2026-03-03T20:00:00.000Z",
      }),
      observation({
        id: "missed",
        target: "Venus",
        status: "missed",
        targetType: "planet",
        createdAt: "2026-03-03T21:00:00.000Z",
      }),
    ],
  });

  assert.equal(progress.entries.find((entry) => entry.id === "solar-moon")?.status, "discovered");
  assert.equal(progress.entries.find((entry) => entry.id === "solar-venus")?.status, "attempted");
  assert.equal(progress.entries.find((entry) => entry.id === "solar-jupiter")?.status, "locked");
});

test("seen after missed becomes discovered with correct first and last dates", () => {
  const progress = buildDiscoveryAtlasProgress({
    profile: createEmptyProgressProfile(),
    observations: [
      observation({
        id: "latest",
        target: "polaris",
        status: "missed",
        targetType: "star",
        createdAt: "2026-04-04T23:00:00.000Z",
      }),
      observation({
        id: "seen-2",
        target: "Étoile Polaire",
        status: "seen",
        targetType: "star",
        createdAt: "2026-04-03T22:00:00.000Z",
      }),
      observation({
        id: "seen-1",
        target: "Polaris",
        status: "seen",
        targetType: "star",
        createdAt: "2026-04-02T21:00:00.000Z",
        photoThumbnailId: "thumb",
      }),
    ],
  });
  const polaris = progress.entries.find((entry) => entry.id === "catalog-polaris");
  assert.equal(polaris?.status, "discovered");
  assert.equal(polaris?.firstDiscoveredAt, "2026-04-02T21:00:00.000Z");
  assert.equal(polaris?.lastObservedAt, "2026-04-04T23:00:00.000Z");
  assert.equal(polaris?.successfulObservationCount, 2);
  assert.equal(polaris?.missedObservationCount, 1);
  assert.equal(polaris?.recentMemory?.id, "seen-2");
});

test("profile discoveries unlock entries even when the bounded journal no longer contains them", () => {
  const profile = createEmptyProgressProfile();
  profile.discoveredTargets = [
    { target: "M45", targetType: "star_cluster", discoveredAt: "2025-11-01T20:00:00.000Z" },
  ];
  const progress = buildDiscoveryAtlasProgress({ profile, observations: [] });
  const pleiades = progress.entries.find((entry) => entry.id === "catalog-pleiades");
  assert.equal(pleiades?.status, "discovered");
  assert.equal(pleiades?.successfulObservationCount, 0);
  assert.equal(pleiades?.firstDiscoveredAt, "2025-11-01T20:00:00.000Z");
});

test("ISS is main collection content while dynamic satellites stay special and outside completion", () => {
  const profile = createEmptyProgressProfile();
  profile.discoveredTargets = [
    { target: "ISS", targetType: "satellite", discoveredAt: "2026-01-01T20:00:00.000Z" },
    {
      target: "satellite-25544-other",
      targetType: "satellite",
      discoveredAt: "2026-01-02T20:00:00.000Z",
    },
  ];
  const progress = buildDiscoveryAtlasProgress({ profile, observations: [] });

  assert.equal(progress.totalCount, 21);
  assert.equal(progress.discoveredCount, 1);
  assert.equal(progress.entries.find((entry) => entry.id === "catalog-iss")?.status, "discovered");
  assert.equal(progress.specialDiscoveries.length, 1);
  assert.equal(progress.specialDiscoveries[0].target, "satellite-25544-other");
  assert.equal(progress.completionPercent, (1 / 21) * 100);
});

test("status filters and category filters return only matching atlas entries", () => {
  const progress = buildDiscoveryAtlasProgress({
    profile: createEmptyProgressProfile(),
    observations: [
      observation({
        id: "missed",
        target: "Mars",
        status: "missed",
        targetType: "planet",
        createdAt: "2026-02-01T20:00:00.000Z",
      }),
    ],
  });
  assert.deepEqual(
    filterDiscoveryAtlasEntries(progress.entries, "attempted").map((entry) => entry.id),
    ["solar-mars"],
  );
  assert.equal(filterDiscoveryAtlasEntries(progress.entries, "all", "Planètes").length, 4);
});

test("unknown and corrupted data is ignored and an atlas without photos remains usable", () => {
  const profile = createEmptyProgressProfile();
  profile.discoveredTargets = /** @type {any} */ ([
    null,
    { target: 42, targetType: "planet", discoveredAt: "nope" },
    { target: "Unknown", targetType: "planet", discoveredAt: "2026-01-01T20:00:00.000Z" },
  ]);
  const progress = buildDiscoveryAtlasProgress({
    profile,
    observations: /** @type {any} */ ([null, { id: "broken" }]),
  });
  assert.equal(progress.entries.length, 21);
  assert.equal(progress.discoveredCount, 0);
  assert.ok(progress.entries.every((entry) => entry.recentMemory === null));
});
