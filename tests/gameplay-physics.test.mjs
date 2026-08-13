import assert from "node:assert/strict";
import test from "node:test";
import {
  JET_ALTITUDE,
  fallingFruitSpawnY,
  flightAltitudeStep,
  fruitHitsCar,
  groundObstacleCanDamage,
  impactDirections,
} from "../public/game-physics.js";

test("Jet rises smoothly to flight altitude and lands smoothly", () => {
  let altitude = 0;
  for (let frame = 0; frame < 240; frame++) altitude = flightAltitudeStep(altitude, true, 1 / 60);
  assert.ok(altitude > JET_ALTITUDE - .01 && altitude <= JET_ALTITUDE);

  for (let frame = 0; frame < 120; frame++) altitude = flightAltitudeStep(altitude, false, 1 / 60);
  assert.ok(altitude < .02);
});

test("ground obstacles cannot damage a flying Jet but retain jump rules on the ground", () => {
  const base = { jumpY: 0, impactY: 0, jumpable: false, clearance: 0 };
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 4, flightY: 6.2 }), false);
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 0, flightY: .71 }), false);
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 0, flightY: 0 }), true);
  assert.equal(groundObstacleCanDamage({ ...base, jetTimer: 0, flightY: 0, jumpable: true, jumpY: 1, clearance: .6 }), false);
});

test("falling fruit can be timed for both ground and Jet-height threats", () => {
  const velocity = -1.8, gravity = 9.1, travelTime = 1.55;
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
