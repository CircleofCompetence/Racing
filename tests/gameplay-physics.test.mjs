import assert from "node:assert/strict";
import test from "node:test";
import {
  JET_ALTITUDE,
  choosePickupKind,
  fallingFruitSpawnY,
  flightMotionStep,
  fruitHitsCar,
  groundObstacleCanDamage,
  impactDirections,
} from "../public/game-physics.js";

test("Jet rises smoothly to flight altitude and lands smoothly", () => {
  let altitude = 0, velocity = 0;
  for (let frame = 0; frame < 240; frame++) ({ altitude, velocity } = flightMotionStep(altitude, velocity, true, 1 / 60));
  assert.ok(altitude > JET_ALTITUDE - .01 && altitude <= JET_ALTITUDE);

  let previousAltitude = altitude;
  for (let frame = 0; frame < 180; frame++) {
    ({ altitude, velocity } = flightMotionStep(altitude, velocity, false, 1 / 60));
    assert.ok(altitude <= previousAltitude + 1e-9);
    previousAltitude = altitude;
  }
  assert.equal(altitude, 0);
  assert.equal(velocity, 0);
});

test("boost and Jet durations remain independent game rules", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../public/game.js", import.meta.url), "utf8");
  assert.match(source, /boostTimer=5/);
  assert.match(source, /jetTimer=7/);
  assert.match(source, /speed=baseSpeed\+\(boostTimer>0\?475:0\)\+\(jetTimer>0\?360:0\)/);
  assert.match(source, /function createBoostPickup\(\)/);
  assert.match(source, /strokeText\("JET",256,132\)/);
  assert.match(source, /vy:-7-Math\.random\(\)\*3/);
  assert.match(source, /gravity:22\+Math\.random\(\)\*5/);
  assert.match(source, /fruitClock=3\.8\+Math\.random\(\)\*2\.8/);
  assert.match(source, /audio\.jet\(\)/);
  assert.match(source, /this\.jetNoise\.loop=true/);
});

test("a flying Jet clears ground props but collides with tall dolls at its altitude", () => {
  const base = { jumpY: 0, impactY: 0, jumpable: false, clearance: 0 };
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 4, flightY: 6.2 }), false);
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 4, flightY: 6.2, tallCharacter: true, obstacleMinY: 0, obstacleMaxY: 8.5, carCenterY: 6.54 }), true);
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 4, flightY: 6.2, tallCharacter: true, obstacleMinY: 0, obstacleMaxY: 5.5, carCenterY: 6.54 }), false);
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 0, flightY: .71 }), false);
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 0, flightY: 0 }), true);
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 0, flightY: 0, jumpable: true, jumpY: 1, clearance: .6 }), false);
});

test("boost and Jet selection stays random without three identical pickups in a row", () => {
  assert.equal(choosePickupKind(.2, "", 0, false), "jet");
  assert.equal(choosePickupKind(.8, "", 0, false), "boost");
  assert.equal(choosePickupKind(.1, "jet", 2, false), "boost");
  assert.equal(choosePickupKind(.9, "boost", 2, false), "jet");
  assert.equal(choosePickupKind(.1, "jet", 1, true), "boost");
});

test("falling fruit can be timed for both ground and Jet-height threats", () => {
  const velocity = -5.2, gravity = 16.5, travelTime = 1.2;
  for (const targetY of [1.3, JET_ALTITUDE]) {
    const spawnY = fallingFruitSpawnY(targetY, velocity, gravity, travelTime);
    const arrivalY = spawnY + velocity * travelTime - .5 * gravity * travelTime * travelTime;
    assert.ok(Math.abs(arrivalY - targetY) < 1e-10);
  }
});

test("fruit collision uses height as well as lane and distance", () => {
  const fruit = { x: 0, y: 1.3, z: 3.2, radius: 1.3 };
  assert.equal(fruitHitsCar(fruit, { x: 0, y: .34, z: 3.2 }), true);
  assert.equal(fruitHitsCar({ ...fruit, y: 6.2 }, { x: 0, y: 6.54, z: 3.2 }), true);
  assert.equal(fruitHitsCar({ ...fruit, y: 6.2 }, { x: 0, y: .34, z: 3.2 }), false);
  assert.equal(fruitHitsCar({ ...fruit, x: 4 }, { x: 0, y: .34, z: 3.2 }), false);
});

test("impact sends the car and obstacle in opposite directions", () => {
  assert.deepEqual(impactDirections(2, 0), { carDirection: -1, objectDirection: 1 });
  assert.deepEqual(impactDirections(-2, 0), { carDirection: 1, objectDirection: -1 });
  assert.deepEqual(impactDirections(0, 0, -1), { carDirection: -1, objectDirection: 1 });
});
