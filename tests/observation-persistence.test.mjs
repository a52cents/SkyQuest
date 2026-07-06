import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import {
  addStoredObservationWithPhotos,
  clearStoredObservations,
  countObservations,
  getObservation,
  getStoredPhoto,
} from "../lib/local-database.ts";
import { addObservation, getProgressProfile } from "../lib/storage.ts";

function observation(id) {
  return {
    id,
    createdAt: new Date().toISOString(),
    questTitle: "Jupiter",
    target: "Jupiter",
    status: "seen",
    visibilityScore: 80,
  };
}

function quest(id) {
  return {
    id,
    target: "Jupiter",
    targetType: "planet",
    title: "Jupiter",
    difficulty: "easy",
    azimuth: 120,
    altitude: 40,
    cardinalDirection: "sud-est",
    visibilityScore: 80,
    visibilityLabel: "Bonne chance",
    description: "Une cible de test.",
    tip: "Regarde vers le sud-est.",
    requiredGear: "naked_eye",
    generatedAt: new Date().toISOString(),
    weather: { cloudCover: 10, isDay: false },
  };
}

test("observation and photos commit in one IndexedDB transaction", async () => {
  const id = `atomic-success-${Date.now()}`;
  const saved = await addStoredObservationWithPhotos(observation(id), {
    photo: new Blob(["full"], { type: "image/webp" }),
    thumbnail: new Blob(["thumb"], { type: "image/webp" }),
  });

  assert.equal(saved.photoId, `${id}-photo`);
  assert.equal(saved.photoThumbnailId, `${id}-thumbnail`);
  assert.deepEqual(await getObservation(id), saved);
  assert.equal(await (await getStoredPhoto(saved.photoId)).text(), "full");
  assert.equal(await (await getStoredPhoto(saved.photoThumbnailId)).text(), "thumb");
});

test("a failed observation insert rolls back photos from the same transaction", async () => {
  const id = `atomic-rollback-${Date.now()}`;
  await addStoredObservationWithPhotos(observation(id), {});

  await assert.rejects(
    addStoredObservationWithPhotos(observation(id), {
      photo: new Blob(["orphan"], { type: "image/webp" }),
    }),
  );

  assert.equal(await getStoredPhoto(`${id}-photo`), null);
});

test("progression does not advance when observation persistence fails", async () => {
  const previousXp = getProgressProfile().totalXp;
  const result = await addObservation(quest(`invalid-photo-${Date.now()}`), "seen", undefined, {
    photoDataUrl: "not-a-data-url",
  });

  assert.deepEqual(result, {
    persisted: false,
    reason: "observation_persistence_failed",
  });
  assert.equal(getProgressProfile().totalXp, previousXp);
});

test("the durable journal keeps only 50 observations and removes pruned photos", async () => {
  await clearStoredObservations();
  const baseTime = new Date("2026-01-01T00:00:00.000Z").getTime();

  for (let index = 0; index < 51; index += 1) {
    const id = `bounded-${String(index).padStart(2, "0")}`;
    await addStoredObservationWithPhotos(
      {
        ...observation(id),
        createdAt: new Date(baseTime + index * 1_000).toISOString(),
      },
      { photo: new Blob([id], { type: "image/webp" }) },
    );
  }

  assert.equal(await countObservations(), 50);
  assert.equal(await getObservation("bounded-00"), null);
  assert.equal(await getStoredPhoto("bounded-00-photo"), null);
  assert.equal((await getObservation("bounded-50"))?.id, "bounded-50");
});

test("clearing the durable journal also clears its photos", async () => {
  const id = `clear-journal-${Date.now()}`;
  await addStoredObservationWithPhotos(observation(id), {
    photo: new Blob(["photo"], { type: "image/webp" }),
  });

  await clearStoredObservations();

  assert.equal(await countObservations(), 0);
  assert.equal(await getStoredPhoto(`${id}-photo`), null);
});
