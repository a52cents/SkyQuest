import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const atlasSource = readFileSync(
  new URL("../components/DiscoveryAtlas.tsx", import.meta.url),
  "utf8",
);
const feedbackSource = readFileSync(
  new URL("../components/ProgressFeedback.tsx", import.meta.url),
  "utf8",
);

test("atlas attempts always request a fresh dashboard analysis instead of opening a stored quest", () => {
  assert.match(atlasSource, /\/?app=1&target=/);
  assert.match(atlasSource, /recalculera le ciel et les conditions/);
  assert.doesNotMatch(atlasSource, /href=[{\"']`?\/quest\//);
});

test("atlas local photo object URLs are revoked on cleanup", () => {
  assert.match(atlasSource, /photoThumbnailId \?\? entry\.recentMemory\?\.photoId/);
  assert.match(atlasSource, /revokePhotoObjectUrl\(createdUrl\)/);
});

test("first eligible discovery feedback announces and links to the atlas", () => {
  assert.match(feedbackSource, /Nouvelle entrée dans ton atlas/);
  assert.match(feedbackSource, /Voir dans mon atlas/);
  assert.match(feedbackSource, /resolveDiscoveryAtlasEntry/);
});
