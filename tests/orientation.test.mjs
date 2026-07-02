import assert from "node:assert/strict";
import test from "node:test";
import { azimuthToCardinal, getCameraPointing } from "../lib/orientation.ts";

function getSafariPointing(webkitCompassHeading) {
  return getCameraPointing({
    alpha: 0,
    beta: 90,
    gamma: 0,
    webkitCompassHeading,
  });
}

test("Safari compass heading is not inverted by 180 degrees", () => {
  const east = getSafariPointing(90);
  const southWest = getSafariPointing(225);

  assert.equal(east.azimuth, 90);
  assert.equal(azimuthToCardinal(east.azimuth), "Est");
  assert.equal(southWest.azimuth, 225);
  assert.equal(azimuthToCardinal(southWest.azimuth), "Sud-Ouest");
});
